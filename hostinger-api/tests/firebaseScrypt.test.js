import test from "node:test";
import assert from "node:assert/strict";
import { verifyFirebaseScrypt } from "../lib/firebaseScrypt.js";

// Public test vector from Firebase's firebase/scrypt reference repository.
// It is deliberately unrelated to SARINE customer credentials.
const config = {
  memCost: 14,
  rounds: 8,
  saltSeparator: "Bw==",
  signerKey: "jxspr8Ki0RYycVU8zykbdLGjFQ3McFUH0uiiTvC8pVMXAn210wjLNmdZJzxUECKbm0QsEmYUSDzZvpjeJ9WmXA=="
};

test("verifies Firebase's published modified-SCRYPT test vector", async () => {
  const valid = await verifyFirebaseScrypt({
    password: "user1password",
    passwordSalt: "42xEC+ixf3L2lw==",
    passwordHash: "lSrfV15cpx95/sZS2W9c9Kp6i/LVgQNDNC/qzrCnh1SAyZvqmZqAjTdn3aoItz+VHjoZilo78198JAdRuid5lQ==",
    config
  });
  assert.equal(valid, true);
});

test("rejects an incorrect password", async () => {
  const valid = await verifyFirebaseScrypt({
    password: "not-the-password",
    passwordSalt: "42xEC+ixf3L2lw==",
    passwordHash: "lSrfV15cpx95/sZS2W9c9Kp6i/LVgQNDNC/qzrCnh1SAyZvqmZqAjTdn3aoItz+VHjoZilo78198JAdRuid5lQ==",
    config
  });
  assert.equal(valid, false);
});

test("rejects malformed hashes without throwing", async () => {
  const valid = await verifyFirebaseScrypt({
    password: "user1password",
    passwordSalt: "42xEC+ixf3L2lw==",
    passwordHash: "not-base64!",
    config
  });
  assert.equal(valid, false);
});
