"use client";

// How many of a row's leading children fit across it.
//
// The ribbon shelf and the application bar both have the same problem: more controls than width,
// and no honest way to scroll a 30-odd pixel strip. Both answer it the way a CAD ribbon does —
// keep the leading items at full size and give the trailing ones to an overflow — so the count
// is worked out here once rather than twice.
//
// The measurement has one rule behind it: a child's natural width is only readable while it is
// actually rendered at that width. A collapsed panel measures its button and an item in an
// overflow menu is not in the row at all, so the widths are cached from the render where
// everything is shown, and any change to what the row holds throws that cache away. Keeping a
// previous tab's measurements and applying them to a new tab's panels is what let panels run off
// the right-hand edge of a shelf that cannot scroll.

import { useCallback, useLayoutEffect, useRef, useState } from "react";

export interface FitCount<T extends HTMLElement> {
  ref: React.RefObject<T | null>;
  /** How many leading children to render at full size. The rest go to the overflow. */
  shown: number;
}

/**
 * @param count      children in the row
 * @param signature  what the row holds — change it and the cached widths are dropped
 * @param costOfHidden  width the overflow itself takes, given how many children are in it
 */
export function useFitCount<T extends HTMLElement>(
  count: number,
  signature: string,
  costOfHidden: (hidden: number) => number
): FitCount<T> {
  const ref = useRef<T | null>(null);
  const naturalRef = useRef<number[] | null>(null);
  const [shown, setShown] = useState(count);

  const costRef = useRef(costOfHidden);
  costRef.current = costOfHidden;

  // A new set of children invalidates every measurement taken for the old one.
  useLayoutEffect(() => {
    naturalRef.current = null;
    setShown(count);
  }, [signature, count]);

  const fit = useCallback(() => {
    const row = ref.current;
    if (!row) return;
    const kids = Array.from(row.children) as HTMLElement[];

    if (!naturalRef.current) {
      // Not everything is on screen at full width yet, so there is nothing worth measuring.
      // Expanding first is what the caller's next render does; this runs again after it.
      if (shown < count || kids.length < count) return;
      naturalRef.current = kids.slice(0, count).map((k) => k.getBoundingClientRect().width);
    }

    const natural = naturalRef.current;
    const avail = row.clientWidth;
    let n = count;
    while (n > 0) {
      const used =
        natural.slice(0, n).reduce((a, b) => a + b, 0) + costRef.current(count - n);
      if (used <= avail) break;
      n--;
    }
    setShown(n);
  }, [count, shown]);

  useLayoutEffect(() => {
    const row = ref.current;
    if (!row) return;
    fit();

    const ro = new ResizeObserver(() => {
      // The row got wider or narrower, so re-measure from scratch: a child's natural width can
      // change with the row's (a label wrapping, a control shrinking to its own minimum).
      naturalRef.current = null;
      if (shown === count) fit();
      else setShown(count);
    });
    ro.observe(row);
    return () => ro.disconnect();
  }, [fit, shown, count]);

  return { ref, shown };
}
