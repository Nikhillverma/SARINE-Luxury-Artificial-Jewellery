import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ID = 'sarine-cbcce';

interface TestResult {
  num: number;
  title: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(num: number, title: string, passed: boolean, details: string) {
  results.push({ num, title, passed, details });
  const statusStr = passed ? 'PASS' : 'FAIL';
  console.log(`[${statusStr}] Scenario ${num}: ${title}`);
  if (details) {
    console.log(`       ${details}`);
  }
}

async function runTests() {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  console.log('Initializing Rules Test Environment with firestore.rules...');
  let testEnv: RulesTestEnvironment;
  try {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: rulesContent,
        host: '127.0.0.1',
        port: 8080
      }
    });
  } catch (err: any) {
    console.error('Failed to initialize test environment:', err);
    process.exit(1);
  }

  try {
    // Seed initial test data using withSecurityRulesDisabled
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      
      // Categories
      await setDoc(doc(db, 'categories', 'cat-rings'), { name: 'Rings', slug: 'rings' });

      // Products
      await setDoc(doc(db, 'products', 'prod-active-1'), {
        name: 'Diamond Solitaire Ring',
        status: 'active',
        price: 45000
      });
      await setDoc(doc(db, 'products', 'prod-draft-1'), {
        name: 'Unreleased Emerald Pendant',
        status: 'draft',
        price: 90000
      });
      await setDoc(doc(db, 'products', 'prod-inactive-1'), {
        name: 'Archived Gold Bangle',
        status: 'inactive',
        price: 32000
      });

      // Users
      await setDoc(doc(db, 'users', 'cust-a-uid'), {
        email: 'customer.a@example.com',
        name: 'Customer A'
      });
      await setDoc(doc(db, 'users', 'cust-b-uid'), {
        email: 'customer.b@example.com',
        name: 'Customer B'
      });

      // Admins collection
      await setDoc(doc(db, 'admins', 'admin-record-1'), {
        role: 'superadmin',
        createdAt: new Date().toISOString()
      });

      // Orders:
      // 1. Owned by Customer A via top-level userId
      await setDoc(doc(db, 'orders', 'order-top-uid-a'), {
        userId: 'cust-a-uid',
        createdAt: '2026-10-01T10:00:00Z',
        total: 5000,
        customer: { name: 'Customer A' }
      });

      // 2. Owned by Customer A via nested customer.userId
      await setDoc(doc(db, 'orders', 'order-nested-uid-a'), {
        createdAt: '2026-10-02T10:00:00Z',
        total: 8000,
        customer: { userId: 'cust-a-uid', name: 'Customer A' }
      });

      // 3. Owned by Customer B via nested customer.userId
      await setDoc(doc(db, 'orders', 'order-nested-uid-b'), {
        createdAt: '2026-10-03T10:00:00Z',
        total: 12000,
        customer: { userId: 'cust-b-uid', name: 'Customer B' }
      });

      // 4. Owned by verified email (guest checkout by customer.c@example.com)
      await setDoc(doc(db, 'orders', 'order-email-c'), {
        createdAt: '2026-10-04T10:00:00Z',
        total: 15000,
        customer: { email: 'customer.c@example.com', name: 'Customer C' }
      });

      // 5. Malformed orders
      await setDoc(doc(db, 'orders', 'order-malformed-null'), {
        createdAt: '2026-10-05T10:00:00Z',
        total: 3000,
        customer: null
      });
      await setDoc(doc(db, 'orders', 'order-malformed-string'), {
        createdAt: '2026-10-06T10:00:00Z',
        total: 4000,
        customer: 'Invalid customer string'
      });
      await setDoc(doc(db, 'orders', 'order-malformed-empty'), {
        createdAt: '2026-10-07T10:00:00Z',
        total: 2000
      });
      await setDoc(doc(db, 'orders', 'order-malformed-null-email'), {
        createdAt: '2026-10-08T10:00:00Z',
        total: 1000,
        customer: { email: null }
      });
    });

    // Setup Test Contexts
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    
    const adminVerifiedDb = testEnv.authenticatedContext('admin-uid-123', {
      email: 'nikhilvermav1999@gmail.com',
      email_verified: true
    }).firestore();

    const adminUnverifiedDb = testEnv.authenticatedContext('unverified-admin-uid', {
      email: 'nikhilvermav1999@gmail.com',
      email_verified: false
    }).firestore();

    const customerADb = testEnv.authenticatedContext('cust-a-uid', {
      email: 'customer.a@example.com',
      email_verified: true
    }).firestore();

    const customerBDb = testEnv.authenticatedContext('cust-b-uid', {
      email: 'customer.b@example.com',
      email_verified: true
    }).firestore();

    const customerCVerifiedDb = testEnv.authenticatedContext('random-guest-uid', {
      email: 'customer.c@example.com',
      email_verified: true
    }).firestore();

    const customerCUnverifiedDb = testEnv.authenticatedContext('random-guest-uid-2', {
      email: 'customer.c@example.com',
      email_verified: false
    }).firestore();

    const customerAttackerDb = testEnv.authenticatedContext('attacker-uid', {
      email: 'attacker@example.com',
      email_verified: true
    }).firestore();

    // =========================================================================
    // SCENARIO 1: Unauthenticated visitor can read categories and active products
    // =========================================================================
    try {
      await assertSucceeds(getDoc(doc(unauthDb, 'categories', 'cat-rings')));
      await assertSucceeds(getDoc(doc(unauthDb, 'products', 'prod-active-1')));
      record(1, 'Unauthenticated visitor can read categories and active products', true,
        'Visitor successfully read category doc and active product doc.');
    } catch (e: any) {
      record(1, 'Unauthenticated visitor can read categories and active products', false, e.message);
    }

    // =========================================================================
    // SCENARIO 2: Unauthenticated visitor cannot read inactive products, orders, users, or admins
    // =========================================================================
    try {
      await assertFails(getDoc(doc(unauthDb, 'products', 'prod-draft-1')));
      await assertFails(getDoc(doc(unauthDb, 'products', 'prod-inactive-1')));
      await assertFails(getDoc(doc(unauthDb, 'orders', 'order-top-uid-a')));
      await assertFails(getDoc(doc(unauthDb, 'users', 'cust-a-uid')));
      await assertFails(getDoc(doc(unauthDb, 'admins', 'admin-record-1')));
      record(2, 'Unauthenticated visitor cannot read inactive products, orders, users, or admins', true,
        'Read operations for draft/inactive products, orders, users, and admin docs were all denied.');
    } catch (e: any) {
      record(2, 'Unauthenticated visitor cannot read inactive products, orders, users, or admins', false, e.message);
    }

    // =========================================================================
    // SCENARIO 3: Verified admin nikhilvermav1999@gmail.com can read all products, orders, and users
    // =========================================================================
    try {
      await assertSucceeds(getDoc(doc(adminVerifiedDb, 'products', 'prod-active-1')));
      await assertSucceeds(getDoc(doc(adminVerifiedDb, 'products', 'prod-draft-1')));
      await assertSucceeds(getDoc(doc(adminVerifiedDb, 'products', 'prod-inactive-1')));
      await assertSucceeds(getDoc(doc(adminVerifiedDb, 'orders', 'order-nested-uid-a')));
      await assertSucceeds(getDoc(doc(adminVerifiedDb, 'orders', 'order-nested-uid-b')));
      await assertSucceeds(getDoc(doc(adminVerifiedDb, 'users', 'cust-a-uid')));
      await assertSucceeds(getDoc(doc(adminVerifiedDb, 'users', 'cust-b-uid')));
      await assertSucceeds(getDoc(doc(adminVerifiedDb, 'admins', 'admin-record-1')));
      record(3, 'Verified admin nikhilvermav1999@gmail.com can read all products, orders, and users', true,
        'Verified admin granted read access to active/draft/inactive products, all customer orders, users, and admins.');
    } catch (e: any) {
      record(3, 'Verified admin nikhilvermav1999@gmail.com can read all products, orders, and users', false, e.message);
    }

    // =========================================================================
    // SCENARIO 4: Unverified account using the same email cannot obtain admin access through the email condition
    // =========================================================================
    try {
      await assertFails(getDoc(doc(adminUnverifiedDb, 'products', 'prod-draft-1')));
      await assertFails(getDoc(doc(adminUnverifiedDb, 'orders', 'order-nested-uid-a')));
      await assertFails(getDoc(doc(adminUnverifiedDb, 'users', 'cust-a-uid')));
      await assertFails(getDoc(doc(adminUnverifiedDb, 'admins', 'admin-record-1')));
      record(4, 'Unverified account using the same email cannot obtain admin access through the email condition', true,
        'Unverified email nikhilvermav1999@gmail.com (email_verified: false) was denied admin access across all collections.');
    } catch (e: any) {
      record(4, 'Unverified account using the same email cannot obtain admin access through the email condition', false, e.message);
    }

    // =========================================================================
    // SCENARIO 5: Customer A can read their own orders but cannot read Customer B's orders
    // =========================================================================
    try {
      // Customer A reads their top-level userId order -> succeeds
      await assertSucceeds(getDoc(doc(customerADb, 'orders', 'order-top-uid-a')));
      // Customer A reads their nested customer.userId order -> succeeds
      await assertSucceeds(getDoc(doc(customerADb, 'orders', 'order-nested-uid-a')));
      // Customer A attempts to read Customer B's order -> fails
      await assertFails(getDoc(doc(customerADb, 'orders', 'order-nested-uid-b')));
      // Customer B reads Customer B's order -> succeeds
      await assertSucceeds(getDoc(doc(customerBDb, 'orders', 'order-nested-uid-b')));
      record(5, "Customer A can read their own orders but cannot read Customer B's orders", true,
        'Customer A granted access to own orders (top-level and nested UID) and strictly denied access to Customer B order.');
    } catch (e: any) {
      record(5, "Customer A can read their own orders but cannot read Customer B's orders", false, e.message);
    }

    // =========================================================================
    // SCENARIO 6: Customer email ownership works only with a verified Firebase email
    // =========================================================================
    try {
      // Customer C with verified email matches order-email-c -> succeeds
      await assertSucceeds(getDoc(doc(customerCVerifiedDb, 'orders', 'order-email-c')));
      
      // Case-insensitivity test (CUSTOMER.C@EXAMPLE.COM) -> succeeds
      const upperCaseDb = testEnv.authenticatedContext('random-guest-upper', {
        email: 'CUSTOMER.C@EXAMPLE.COM',
        email_verified: true
      }).firestore();
      await assertSucceeds(getDoc(doc(upperCaseDb, 'orders', 'order-email-c')));

      // Customer C with unverified email attempts to read order-email-c -> fails
      await assertFails(getDoc(doc(customerCUnverifiedDb, 'orders', 'order-email-c')));

      // Attacker with different verified email attempts to read order-email-c -> fails
      await assertFails(getDoc(doc(customerAttackerDb, 'orders', 'order-email-c')));

      record(6, 'Customer email ownership works only with a verified Firebase email', true,
        'Email matching verified against customer.email (case-insensitive) and strictly blocked unverified/mismatched emails.');
    } catch (e: any) {
      record(6, 'Customer email ownership works only with a verified Firebase email', false, e.message);
    }

    // =========================================================================
    // SCENARIO 7: Customers cannot read other users' profiles
    // =========================================================================
    try {
      // Customer A reads their own profile -> succeeds
      await assertSucceeds(getDoc(doc(customerADb, 'users', 'cust-a-uid')));
      // Customer A attempts to read Customer B profile -> fails
      await assertFails(getDoc(doc(customerADb, 'users', 'cust-b-uid')));
      // Customer B attempts to read Customer A profile -> fails
      await assertFails(getDoc(doc(customerBDb, 'users', 'cust-a-uid')));
      record(7, "Customers cannot read other users' profiles", true,
        'Users can read only /users/{auth.uid}. Cross-user document reads are denied.');
    } catch (e: any) {
      record(7, "Customers cannot read other users' profiles", false, e.message);
    }

    // =========================================================================
    // SCENARIO 8: No client can create, update, or delete documents in protected collections
    // =========================================================================
    try {
      // 1. Categories
      await assertFails(setDoc(doc(unauthDb, 'categories', 'new-cat'), { name: 'New' }));
      await assertFails(updateDoc(doc(adminVerifiedDb, 'categories', 'cat-rings'), { name: 'Hacked' }));
      await assertFails(deleteDoc(doc(adminVerifiedDb, 'categories', 'cat-rings')));

      // 2. Products
      await assertFails(setDoc(doc(customerADb, 'products', 'new-prod'), { name: 'Free Ring', price: 0 }));
      await assertFails(updateDoc(doc(adminVerifiedDb, 'products', 'prod-active-1'), { price: 1 }));
      await assertFails(deleteDoc(doc(adminVerifiedDb, 'products', 'prod-active-1')));

      // 3. Orders
      await assertFails(setDoc(doc(customerADb, 'orders', 'new-order-fraud'), { total: 0, userId: 'cust-a-uid' }));
      await assertFails(updateDoc(doc(customerADb, 'orders', 'order-top-uid-a'), { total: 0 }));
      await assertFails(deleteDoc(doc(customerADb, 'orders', 'order-top-uid-a')));

      // 4. Users
      await assertFails(setDoc(doc(customerADb, 'users', 'new-user'), { role: 'admin' }));
      await assertFails(updateDoc(doc(customerADb, 'users', 'cust-a-uid'), { role: 'admin' }));
      await assertFails(deleteDoc(doc(customerADb, 'users', 'cust-a-uid')));

      // 5. Admins
      await assertFails(setDoc(doc(customerADb, 'admins', 'cust-a-uid'), { role: 'admin' }));
      await assertFails(updateDoc(doc(adminVerifiedDb, 'admins', 'admin-record-1'), { role: 'demoted' }));
      await assertFails(deleteDoc(doc(adminVerifiedDb, 'admins', 'admin-record-1')));

      record(8, 'No client can create, update, or delete documents in protected collections', true,
        'All client writes (create/update/delete) across categories, products, orders, users, and admins were rejected.');
    } catch (e: any) {
      record(8, 'No client can create, update, or delete documents in protected collections', false, e.message);
    }

    // =========================================================================
    // SCENARIO 9: A malformed customer field (null, string, or missing) does not grant order access
    // =========================================================================
    try {
      // Customer A attempts to read order with customer: null -> denied
      await assertFails(getDoc(doc(customerADb, 'orders', 'order-malformed-null')));
      // Customer A attempts to read order with customer: "string" -> denied
      await assertFails(getDoc(doc(customerADb, 'orders', 'order-malformed-string')));
      // Customer A attempts to read order with no customer field -> denied
      await assertFails(getDoc(doc(customerADb, 'orders', 'order-malformed-empty')));
      // Customer with verified email attempts to read order with customer: { email: null } -> denied
      await assertFails(getDoc(doc(customerCVerifiedDb, 'orders', 'order-malformed-null-email')));

      // Verified admin reads all malformed orders -> succeeds without rule evaluation crashes
      await assertSucceeds(getDoc(doc(adminVerifiedDb, 'orders', 'order-malformed-null')));
      await assertSucceeds(getDoc(doc(adminVerifiedDb, 'orders', 'order-malformed-string')));
      await assertSucceeds(getDoc(doc(adminVerifiedDb, 'orders', 'order-malformed-empty')));
      await assertSucceeds(getDoc(doc(adminVerifiedDb, 'orders', 'order-malformed-null-email')));

      record(9, 'A malformed customer field (null, string, or missing) does not grant order access', true,
        'Defensive guards safely evaluate to false without runtime CEL error; verified admin retains access.');
    } catch (e: any) {
      record(9, 'A malformed customer field (null, string, or missing) does not grant order access', false, e.message);
    }

    // =========================================================================
    // SCENARIO 10: Check that all existing storefront and admin query patterns are compatible
    // =========================================================================
    try {
      // 1. Storefront: visitor lists categories
      await assertSucceeds(getDocs(collection(unauthDb, 'categories')));

      // 2. Storefront: visitor queries active products
      const activeProductsQuery = query(
        collection(unauthDb, 'products'),
        where('status', '==', 'active')
      );
      await assertSucceeds(getDocs(activeProductsQuery));

      // 3. Storefront: visitor attempting to query ALL products without status filter -> fails
      await assertFails(getDocs(collection(unauthDb, 'products')));

      // 4. Admin Dashboard: verified admin queries ALL products
      await assertSucceeds(getDocs(collection(adminVerifiedDb, 'products')));

      // 5. Admin Dashboard: verified admin queries ALL orders ordered by createdAt
      const adminOrdersQuery = query(
        collection(adminVerifiedDb, 'orders'),
        orderBy('createdAt', 'desc')
      );
      await assertSucceeds(getDocs(adminOrdersQuery));

      // 6. Admin Dashboard: verified admin counts registered users via collection(users)
      await assertSucceeds(getDocs(collection(adminVerifiedDb, 'users')));

      // 7. Admin Customers Page: verified admin queries orders collection
      await assertSucceeds(getDocs(collection(adminVerifiedDb, 'orders')));

      // 8. Ordinary customer attempting to query all orders collection -> fails
      await assertFails(getDocs(collection(customerADb, 'orders')));

      // 9. Ordinary customer attempting to query all users collection -> fails
      await assertFails(getDocs(collection(customerADb, 'users')));

      record(10, 'Check that all existing storefront and admin query patterns are compatible', true,
        'Storefront active-product filtering, category listing, and admin-wide product/order/user queries all succeed.');
    } catch (e: any) {
      record(10, 'Check that all existing storefront and admin query patterns are compatible', false, e.message);
    }

  } finally {
    await testEnv.cleanup();
  }

  // Summary
  console.log('\n======================================================');
  console.log('TEST EXECUTION SUMMARY:');
  const allPassed = results.every(r => r.passed);
  console.log(`Total Scenarios: ${results.length}`);
  console.log(`Passed: ${results.filter(r => r.passed).length}`);
  console.log(`Failed: ${results.filter(r => !r.passed).length}`);
  console.log(`Overall Status: ${allPassed ? 'ALL PASSED' : 'FAILURES DETECTED'}`);
  console.log('======================================================');
}

runTests().catch(err => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
