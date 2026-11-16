/**
 * Variant-aware shopping bag context.
 * Cart lines persist productId + optional variantId + quantity and re-hydrate
 * against current Hostinger catalogue data so prices and stock remain authoritative.
 */
import React, {
  createContext, useContext, useReducer, useEffect, useState,
  useCallback, useMemo, ReactNode
} from 'react';
import { Product, ProductVariant } from '../types/product';
import { CartLine, CartItem } from '../types/cart';
import { productService } from '../services';

const STORAGE_KEY = 'sarine_cart_lines_v1';
const lineKey = (productId: string, variantId?: string) => `${productId}::${variantId || 'default'}`;

function loadStoredLines(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item =>
      item && typeof item.productId === 'string' && item.productId.trim() &&
      typeof item.quantity === 'number' && Number.isInteger(item.quantity) && item.quantity > 0 &&
      (item.variantId === undefined || typeof item.variantId === 'string')
    ).map(item => ({
      productId: item.productId,
      ...(item.variantId ? { variantId: item.variantId } : {}),
      quantity: item.quantity
    }));
  } catch (error) {
    console.warn('[CartContext] Failed to read cart:', error);
    return [];
  }
}

function saveStoredLines(lines: CartLine[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lines)); }
  catch (error) { console.warn('[CartContext] Failed to save cart:', error); }
}

interface CartState {
  lines: CartLine[];
  productsByLineKey: Record<string, Product>;
  isHydrating: boolean;
  isDrawerOpen: boolean;
  availabilityNotice: string | null;
}

type CartAction =
  | { type: 'HYDRATION_START' }
  | { type: 'HYDRATION_SUCCESS'; payload: { validLines: CartLine[]; productsByLineKey: Record<string, Product>; hasAdjustments: boolean } }
  | { type: 'ADD_ITEM'; payload: { product: Product; quantity: number; variant?: ProductVariant } }
  | { type: 'REMOVE_ITEM'; payload: { productId: string; variantId?: string } }
  | { type: 'UPDATE_QUANTITY'; payload: { productId: string; variantId?: string; quantity: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_DRAWER'; payload: boolean }
  | { type: 'DISMISS_NOTICE' };

function getLineStock(product: Product, variant?: ProductVariant) {
  return variant ? variant.stock : product.stock;
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'HYDRATION_START':
      return { ...state, isHydrating: true };
    case 'HYDRATION_SUCCESS':
      saveStoredLines(action.payload.validLines);
      return {
        ...state,
        lines: action.payload.validLines,
        productsByLineKey: action.payload.productsByLineKey,
        isHydrating: false,
        availabilityNotice: action.payload.hasAdjustments
          ? 'Some items in your bag were updated because their selected size, colour or availability changed.'
          : null
      };
    case 'ADD_ITEM': {
      const { product, quantity, variant } = action.payload;
      if (product.status !== 'active' || (product.variants?.length && (!variant || variant.status !== 'active'))) return state;
      const stock = getLineStock(product, variant);
      if (stock <= 0) return state;
      const variantId = variant?.id;
      const key = lineKey(product.id, variantId);
      const existing = state.lines.find(line => lineKey(line.productId, line.variantId) === key);
      const nextLines = existing
        ? state.lines.map(line => lineKey(line.productId, line.variantId) === key
          ? { ...line, quantity: Math.min(line.quantity + quantity, stock) }
          : line)
        : [...state.lines, { productId: product.id, ...(variantId ? { variantId } : {}), quantity: Math.min(Math.max(1, quantity), stock) }];
      saveStoredLines(nextLines);
      return {
        ...state,
        lines: nextLines,
        productsByLineKey: { ...state.productsByLineKey, [key]: product },
        isDrawerOpen: true
      };
    }
    case 'REMOVE_ITEM': {
      const key = lineKey(action.payload.productId, action.payload.variantId);
      const nextLines = state.lines.filter(line => lineKey(line.productId, line.variantId) !== key);
      saveStoredLines(nextLines);
      const nextProducts = { ...state.productsByLineKey };
      delete nextProducts[key];
      return { ...state, lines: nextLines, productsByLineKey: nextProducts };
    }
    case 'UPDATE_QUANTITY': {
      const key = lineKey(action.payload.productId, action.payload.variantId);
      const product = state.productsByLineKey[key];
      const variant = product?.variants?.find(item => item.id === action.payload.variantId);
      const maxStock = product ? getLineStock(product, variant) : 99;
      const quantity = Math.min(Math.max(1, action.payload.quantity), maxStock);
      const nextLines = state.lines.map(line =>
        lineKey(line.productId, line.variantId) === key ? { ...line, quantity } : line
      );
      saveStoredLines(nextLines);
      return { ...state, lines: nextLines };
    }
    case 'CLEAR_CART':
      saveStoredLines([]);
      return { ...state, lines: [] };
    case 'SET_DRAWER':
      return { ...state, isDrawerOpen: action.payload };
    case 'DISMISS_NOTICE':
      return { ...state, availabilityNotice: null };
    default:
      return state;
  }
}

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  isHydrating: boolean;
  isDrawerOpen: boolean;
  availabilityNotice: string | null;
  addItem: (product: Product, quantity?: number, variant?: ProductVariant) => void;
  removeItem: (productId: string, variantId?: string) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  dismissNotice: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, {
    lines: loadStoredLines(),
    productsByLineKey: {},
    isHydrating: true,
    isDrawerOpen: false,
    availabilityNotice: null
  });

  useEffect(() => {
    let cancelled = false;
    async function hydrateCart() {
      const stored = loadStoredLines();
      if (!stored.length) {
        if (!cancelled) dispatch({ type: 'HYDRATION_SUCCESS', payload: { validLines: [], productsByLineKey: {}, hasAdjustments: false } });
        return;
      }
      dispatch({ type: 'HYDRATION_START' });
      try {
        const products = await productService.getProductsByIds([...new Set(stored.map(line => line.productId))], { includeAll: true });
        const productMap = new Map(products.map(product => [product.id, product]));
        const validLines: CartLine[] = [];
        const productsByLineKey: Record<string, Product> = {};
        let hasAdjustments = false;
        for (const line of stored) {
          const product = productMap.get(line.productId);
          if (!product || product.status !== 'active') { hasAdjustments = true; continue; }
          const hasVariants = Boolean(product.variants?.length);
          const variant = hasVariants ? product.variants?.find(item => item.id === line.variantId && item.status === 'active') : undefined;
          if ((hasVariants && !variant) || (!hasVariants && line.variantId)) { hasAdjustments = true; continue; }
          const stock = getLineStock(product, variant);
          if (stock <= 0) { hasAdjustments = true; continue; }
          const quantity = Math.min(line.quantity, stock);
          if (quantity !== line.quantity) hasAdjustments = true;
          const normalized = { productId: line.productId, ...(variant ? { variantId: variant.id } : {}), quantity };
          validLines.push(normalized);
          productsByLineKey[lineKey(line.productId, variant?.id)] = product;
        }
        if (!cancelled) dispatch({ type: 'HYDRATION_SUCCESS', payload: { validLines, productsByLineKey, hasAdjustments } });
      } catch (error) {
        console.error('[CartContext] Error re-hydrating cart:', error);
        if (!cancelled) dispatch({ type: 'HYDRATION_SUCCESS', payload: { validLines: stored, productsByLineKey: {}, hasAdjustments: false } });
      }
    }
    void hydrateCart();
    return () => { cancelled = true; };
  }, []);

  const addItem = useCallback((product: Product, quantity = 1, variant?: ProductVariant) => {
    dispatch({ type: 'ADD_ITEM', payload: { product, quantity, variant } });
  }, []);
  const removeItem = useCallback((productId: string, variantId?: string) => dispatch({ type: 'REMOVE_ITEM', payload: { productId, variantId } }), []);
  const updateQuantity = useCallback((productId: string, quantity: number, variantId?: string) => dispatch({ type: 'UPDATE_QUANTITY', payload: { productId, quantity, variantId } }), []);
  const clearCart = useCallback(() => dispatch({ type: 'CLEAR_CART' }), []);
  const openDrawer = useCallback(() => dispatch({ type: 'SET_DRAWER', payload: true }), []);
  const closeDrawer = useCallback(() => dispatch({ type: 'SET_DRAWER', payload: false }), []);
  const dismissNotice = useCallback(() => dispatch({ type: 'DISMISS_NOTICE' }), []);

  const hydratedItems = useMemo<CartItem[]>(() => state.lines.map(line => {
    const product = state.productsByLineKey[lineKey(line.productId, line.variantId)];
    if (!product) return null;
    const variant = product.variants?.find(item => item.id === line.variantId);
    const unitPrice = variant?.price ?? product.price;
    return {
      productId: line.productId,
      ...(variant ? { variantId: variant.id, variant } : {}),
      product,
      quantity: line.quantity,
      unitPrice,
      lineTotal: unitPrice * line.quantity
    };
  }).filter((item): item is CartItem => item !== null), [state.lines, state.productsByLineKey]);

  const itemCount = useMemo(() => state.lines.reduce((sum, line) => sum + line.quantity, 0), [state.lines]);
  const subtotal = useMemo(() => hydratedItems.reduce((sum, item) => sum + item.lineTotal, 0), [hydratedItems]);
  const value = useMemo<CartContextValue>(() => ({
    items: hydratedItems, itemCount, subtotal, isHydrating: state.isHydrating,
    isDrawerOpen: state.isDrawerOpen, availabilityNotice: state.availabilityNotice,
    addItem, removeItem, updateQuantity, clearCart, openDrawer, closeDrawer, dismissNotice
  }), [hydratedItems, itemCount, subtotal, state.isHydrating, state.isDrawerOpen, state.availabilityNotice, addItem, removeItem, updateQuantity, clearCart, openDrawer, closeDrawer, dismissNotice]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
}
