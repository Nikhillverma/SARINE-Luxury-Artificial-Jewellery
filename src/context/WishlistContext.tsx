/**
 * Wishlist Context and Hook for SARINE.
 * Provides persistent wishlist state, toggle actions, and seamless cart migration.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode
} from 'react';
import { Product } from '../types/product';
import { productService } from '../services';

const STORAGE_KEY = 'sarine_wishlist_v1';

interface WishlistContextValue {
  wishlistIds: string[];
  wishlistProducts: Product[];
  count: number;
  loading: boolean;
  isWishlistOpen: boolean;
  isInWishlist: (productId: string) => boolean;
  toggleWishlist: (product: Product) => void;
  removeFromWishlist: (productId: string) => void;
  openWishlist: () => void;
  closeWishlist: () => void;
  clearWishlist: () => void;
}

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined);

function loadStoredIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((id) => typeof id === 'string' && id.trim() !== '');
    }
    return [];
  } catch (err) {
    console.warn('[WishlistContext] Failed to load wishlist from storage:', err);
    return [];
  }
}

function saveStoredIds(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch (err) {
    console.warn('[WishlistContext] Failed to save wishlist to storage:', err);
  }
}

export const WishlistProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [wishlistIds, setWishlistIds] = useState<string[]>(loadStoredIds);
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isWishlistOpen, setIsWishlistOpen] = useState<boolean>(false);

  // Sync products when wishlistIds change
  useEffect(() => {
    let isCancelled = false;

    async function fetchProducts() {
      if (wishlistIds.length === 0) {
        setWishlistProducts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const products = await productService.getProductsByIds(wishlistIds, { includeAll: true });
        if (!isCancelled) {
          // Filter to active items
          const activeOnly = products.filter((p) => p.status === 'active');
          setWishlistProducts(activeOnly);
        }
      } catch (err) {
        console.error('[WishlistContext] Error fetching wishlist products:', err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    fetchProducts();

    return () => {
      isCancelled = true;
    };
  }, [wishlistIds]);

  const isInWishlist = useCallback(
    (productId: string) => {
      return wishlistIds.includes(productId);
    },
    [wishlistIds]
  );

  const toggleWishlist = useCallback((product: Product) => {
    setWishlistIds((prev) => {
      let next: string[];
      if (prev.includes(product.id)) {
        next = prev.filter((id) => id !== product.id);
      } else {
        next = [product.id, ...prev];
      }
      saveStoredIds(next);
      return next;
    });
  }, []);

  const removeFromWishlist = useCallback((productId: string) => {
    setWishlistIds((prev) => {
      const next = prev.filter((id) => id !== productId);
      saveStoredIds(next);
      return next;
    });
  }, []);

  const clearWishlist = useCallback(() => {
    setWishlistIds([]);
    saveStoredIds([]);
    setWishlistProducts([]);
  }, []);

  const openWishlist = useCallback(() => setIsWishlistOpen(true), []);
  const closeWishlist = useCallback(() => setIsWishlistOpen(false), []);

  const value = useMemo<WishlistContextValue>(
    () => ({
      wishlistIds,
      wishlistProducts,
      count: wishlistIds.length,
      loading,
      isWishlistOpen,
      isInWishlist,
      toggleWishlist,
      removeFromWishlist,
      openWishlist,
      closeWishlist,
      clearWishlist
    }),
    [
      wishlistIds,
      wishlistProducts,
      loading,
      isWishlistOpen,
      isInWishlist,
      toggleWishlist,
      removeFromWishlist,
      openWishlist,
      closeWishlist,
      clearWishlist
    ]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}
