/**
 * ScrollToTop component for SARINE.
 *
 * Ensures consistent, instant scroll-to-top behavior across all internal route
 * changes, header/footer navigation, product cards, category switches, and browser
 * Back/Forward history navigation, while preserving intentional in-page anchor (#hash) navigation.
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export function ScrollToTop() {
  const { pathname, search, hash } = useLocation();
  const prevPathnameRef = useRef<string | null>(null);
  const prevSearchRef = useRef<string | null>(null);

  // Disable browser's premature scroll restoration in SPAs to prevent
  // users from being left at broken intermediate scroll offsets on Back/Forward.
  useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      const original = window.history.scrollRestoration;
      window.history.scrollRestoration = 'manual';
      return () => {
        window.history.scrollRestoration = original;
      };
    }
  }, []);

  useEffect(() => {
    // 1. In-page anchor navigation (e.g. #reviews, #categories)
    if (hash) {
      const targetId = decodeURIComponent(hash.replace(/^#/, ''));
      const scrollToAnchor = () => {
        const element = document.getElementById(targetId);
        if (element) {
          // Account for SARINE's sticky luxury header height (~110px)
          const headerOffset = 110;
          const elementPosition = element.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

          window.scrollTo({
            top: Math.max(0, offsetPosition),
            behavior: 'smooth'
          });
          return true;
        }
        return false;
      };

      if (!scrollToAnchor()) {
        // If element is not rendered yet (e.g. dynamic fetch or mount), retry on next animation frame
        const frameId = requestAnimationFrame(() => {
          scrollToAnchor();
        });
        return () => cancelAnimationFrame(frameId);
      }

      prevPathnameRef.current = pathname;
      prevSearchRef.current = search;
      return;
    }

    // 2. Route change detection (pathname or search changes)
    const pathnameChanged = prevPathnameRef.current !== pathname;
    const searchChanged = prevSearchRef.current !== search;

    if (pathnameChanged || searchChanged) {
      // Instant scrolling without distracting animation as required
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'auto'
      });

      // Defensive scroll resets for browser root elements
      if (document.documentElement) {
        document.documentElement.scrollTop = 0;
      }
      if (document.body) {
        document.body.scrollTop = 0;
      }
    }

    prevPathnameRef.current = pathname;
    prevSearchRef.current = search;
  }, [pathname, search, hash]);

  return null;
}
