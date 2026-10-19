/**
 * Shopping Bag Context and Reducer for SARINE.
 *
 * Implements:
 * - Minimal localStorage persistence (only productId and quantity).
 * - Full re-hydration against live IProductService on load.
 * - Automatic dropping of inactive items and stock-capping of stale quantities.
 * - Reducer-driven actions: addItem, removeItem, updateQuantity, clearCart.
 * - Derived metrics: itemCount, subtotal.
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode
} from 'react';
import { Product } from '../types/product';
import { CartLine, CartItem } from '../types/cart';
import { productService } from '../services';

const STORAGE_KEY = 'sarine_cart_lines_v1';

// Safe localStorage helpers that never throw even if cookies/storage are disabled
function loadStoredLines(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item.productId === 'string' &&
        item.productId.trim() !== '' &&
        typeof item.quantity === 'number' &&
        item.quantity > 0
    );
  } catch (err) {
    console.warn('[CartContext] Failed to read cart from localStorage:', err);
    return [];
  }
}

function saveStoredLines(lines: CartLine[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch (err) {
    console.warn('[CartContext] Failed to save cart to localStorage:', err);
  }
}

// State shape
interface CartState {
  lines: CartLine[];
  productsById: Record<string, Product>;
  isHydrating: boolean;
  isDrawerOpen: boolean;
  availabilityNotice: string | null;
}

// Action types
type CartAction =
  | { type: 'HYDRATION_START' }
  | {
      type: 'HYDRATION_SUCCESS';
      payload: {
        validLines: CartLine[];
        productsById: Record<string, Product>;
        hasAdjustments: boolean;
      };
    }
  | { type: 'ADD_ITEM'; payload: { product: Product; quantity: number } }
  | { type: 'REMOVE_ITEM'; payload: { productId: string } }
  | { type: 'UPDATE_QUANTITY'; payload: { productId: string; quantity: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_DRAWER'; payload: boolean }
  | { type: 'DISMISS_NOTICE' };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'HYDRATION_START':
      return { ...state, isHydrating: true };

    case 'HYDRATION_SUCCESS': {
      const { validLines, productsById, hasAdjustments } = action.payload;
      saveStoredLines(validLines);
      return {
        ...state,
        lines: validLines,
        productsById,
        isHydrating: false,
        availabilityNotice: hasAdjustments
          ? 'Some items in your bag were updated because their availability changed.'
          : null
      };
    }

    case 'ADD_ITEM': {
      const { product, quantity } = action.payload;
      if (product.status !== 'active' || product.stock <= 0) {
        return state;
      }

      const existingIndex = state.lines.findIndex((l) => l.productId === product.id);
      let newLines: CartLine[];

      if (existingIndex > -1) {
        newLines = state.lines.map((l, idx) => {
          if (idx !== existingIndex) return l;
          const desired = l.quantity + quantity;
          const capped = Math.min(desired, product.stock);
          return { ...l, quantity: capped };
        });
      } else {
        const initialQty = Math.min(Math.max(1, quantity), product.stock);
        newLines = [...state.lines, { productId: product.id, quantity: initialQty }];
      }

      saveStoredLines(newLines);
      return {
        ...state,
        lines: newLines,
        productsById: { ...state.productsById, [product.id]: product },
        isDrawerOpen: true // automatically open drawer on add
      };
    }

    case 'REMOVE_ITEM': {
      const newLines = state.lines.filter((l) => l.productId !== action.payload.productId);
      saveStoredLines(newLines);
      return {
        ...state,
        lines: newLines
      };
    }

    case 'UPDATE_QUANTITY': {
      const { productId, quantity } = action.payload;
      const product = state.productsById[productId];
      const maxStock = product ? product.stock : 99;

      // Clamp between 1 and maxStock
      const clampedQty = Math.min(Math.max(1, quantity), maxStock);

      const newLines = state.lines.map((l) =>
        l.productId === productId ? { ...l, quantity: clampedQty } : l
      );

      saveStoredLines(newLines);
      return {
        ...state,
        lines: newLines
      };
    }

    case 'CLEAR_CART': {
      saveStoredLines([]);
      return {
        ...state,
        lines: []
      };
    }

    case 'SET_DRAWER':
      return {
        ...state,
        isDrawerOpen: action.payload
      };

    case 'DISMISS_NOTICE':
      return {
        ...state,
        availabilityNotice: null
      };

    default:
      return state;
  }
}

// Context interface
interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  isHydrating: boolean;
  isDrawerOpen: boolean;
  availabilityNotice: string | null;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  dismissNotice: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, {
    lines: loadStoredLines(),
    productsById: {},
    isHydrating: true,
    isDrawerOpen: false,
    availabilityNotice: null
  });

  // Re-fetch current live product entities on initial load to ensure valid prices and stock
  useEffect(() => {
    let isCancelled = false;

    async function hydrateCart() {
      const stored = loadStoredLines();
      if (stored.length === 0) {
        if (!isCancelled) {
          dispatch({
            type: 'HYDRATION_SUCCESS',
            payload: { validLines: [], productsById: {}, hasAdjustments: false }
          });
        }
        return;
      }

      dispatch({ type: 'HYDRATION_START' });

      try {
        const ids = stored.map((l) => l.productId);
        // Request products (including drafts if needed for verification, but active only in shop)
        const products = await productService.getProductsByIds(ids, { includeAll: true });
        const productMap: Record<string, Product> = {};
        for (const p of products) {
          productMap[p.id] = p;
        }

        const validLines: CartLine[] = [];
        let hasAdjustments = false;

        for (const line of stored) {
          const product = productMap[line.productId];
          // Drop items that no longer exist or are not active or out of stock
          if (!product || product.status !== 'active' || product.stock <= 0) {
            hasAdjustments = true;
            continue;
          }

          // Cap quantities that exceed current stock
          let finalQty = line.quantity;
          if (finalQty > product.stock) {
            finalQty = product.stock;
            hasAdjustments = true;
          }

          if (finalQty > 0) {
            validLines.push({ productId: line.productId, quantity: finalQty });
          }
        }

        if (!isCancelled) {
          dispatch({
            type: 'HYDRATION_SUCCESS',
            payload: {
              validLines,
              productsById: productMap,
              hasAdjustments
            }
          });
        }
      } catch (err) {
        console.error('[CartContext] Error re-hydrating cart:', err);
        if (!isCancelled) {
          dispatch({
            type: 'HYDRATION_SUCCESS',
            payload: { validLines: stored, productsById: {}, hasAdjustments: false }
          });
        }
      }
    }

    hydrateCart();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Action dispatches
  const addItem = useCallback((product: Product, quantity = 1) => {
    dispatch({ type: 'ADD_ITEM', payload: { product, quantity } });
  }, []);

  const removeItem = useCallback((productId: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { productId } });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { productId, quantity } });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' });
  }, []);

  const openDrawer = useCallback(() => {
    dispatch({ type: 'SET_DRAWER', payload: true });
  }, []);

  const closeDrawer = useCallback(() => {
    dispatch({ type: 'SET_DRAWER', payload: false });
  }, []);

  const dismissNotice = useCallback(() => {
    dispatch({ type: 'DISMISS_NOTICE' });
  }, []);

  // Derived values: items, itemCount, subtotal
  const hydratedItems = useMemo<CartItem[]>(() => {
    return state.lines
      .map((line) => {
        const product = state.productsById[line.productId];
        if (!product) return null;
        return {
          productId: line.productId,
          product,
          quantity: line.quantity,
          unitPrice: product.price,
          lineTotal: product.price * line.quantity
        };
      })
      .filter((item): item is CartItem => item !== null);
  }, [state.lines, state.productsById]);

  const itemCount = useMemo(() => {
    return state.lines.reduce((sum, line) => sum + line.quantity, 0);
  }, [state.lines]);

  const subtotal = useMemo(() => {
    return hydratedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  }, [hydratedItems]);

  const value = useMemo<CartContextValue>(
    () => ({
      items: hydratedItems,
      itemCount,
      subtotal,
      isHydrating: state.isHydrating,
      isDrawerOpen: state.isDrawerOpen,
      availabilityNotice: state.availabilityNotice,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      openDrawer,
      closeDrawer,
      dismissNotice
    }),
    [
      hydratedItems,
      itemCount,
      subtotal,
      state.isHydrating,
      state.isDrawerOpen,
      state.availabilityNotice,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      openDrawer,
      closeDrawer,
      dismissNotice
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
