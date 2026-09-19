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
//
// ## The expand-then-measure dance, and why it must not drive the observer
//
// Measuring needs every child laid out at full width, but the steady state has some of them
// hidden. So a re-measure expands first (`setShown(count)`), lets that render land, and measures
// on the pass after. That is a deliberate two-step and it is why `shown` briefly returns to
// `count` during any re-fit.
//
// The ResizeObserver must therefore be set up ONCE and must not depend on `shown`. It used to be
// created inside an effect keyed on `[fit, shown, count]`, so every change of `shown` tore the
// observer down and built a new one — and `observe()` delivers its callback immediately, with
// the size the element already has. That initial delivery re-entered the dance:
//
//   shown = n  ->  effect re-runs  ->  new observer  ->  immediate callback  ->  setShown(count)
//   shown = count  ->  effect re-runs  ->  new observer  ->  immediate callback  ->  fit()
//   fit() -> setShown(n)  ->  round again, forever
//
// It never showed while everything fit, because then `fit()` computes `n === count`, `setShown`
// bails on an unchanged value and the effect does not re-run. The loop starts the first time a
// row actually overflows — which, in the application bar, was the day it went past seven items.
// Its visible symptom is not a spinning CPU but an overflow menu that will not stay open:
// `shown` returns to `count` sixty times a second, so anything watching "is something hidden"
// sees it go false and closes.
//
// Hence: observe once, keep the live values in refs, and ignore a delivery that reports a width
// the row already had.

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

  // Read inside the observer callback, which outlives the render that created it.
  const costRef = useRef(costOfHidden);
  costRef.current = costOfHidden;
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const countRef = useRef(count);
  countRef.current = count;

  // The width the last re-fit was made against. An observer delivery reporting this same width
  // is the initial one, or a layout change that did not move the row — either way there is
  // nothing to re-measure, and acting on it is what closed the loop above.
  const widthRef = useRef(-1);

  // A new set of children invalidates every measurement taken for the old one.
  useLayoutEffect(() => {
    naturalRef.current = null;
    widthRef.current = -1;
    setShown(count);
  }, [signature, count]);

  const fit = useCallback(() => {
    const row = ref.current;
    if (!row) return;
    const kids = Array.from(row.children) as HTMLElement[];
    const total = countRef.current;

    if (!naturalRef.current) {
      // Not everything is on screen at full width yet, so there is nothing worth measuring.
      // Expanding first is what the caller's next render does; this runs again after it.
      if (shownRef.current < total || kids.length < total) return;
      naturalRef.current = kids.slice(0, total).map((k) => k.getBoundingClientRect().width);
    }

    const natural = naturalRef.current;
    const avail = row.clientWidth;
    widthRef.current = avail;
    let n = total;
    while (n > 0) {
      const used =
        natural.slice(0, n).reduce((a, b) => a + b, 0) + costRef.current(total - n);
      if (used <= avail) break;
      n--;
    }
    setShown(n);
  }, []);

  // Runs after every render, which is what completes the expand-then-measure dance: the render
  // that expanded lands, then this measures it.
  useLayoutEffect(() => {
    fit();
  });

  // Set up once. Deliberately not keyed on `shown` — see the note at the top of this file.
  useLayoutEffect(() => {
    const row = ref.current;
    if (!row) return;

    const ro = new ResizeObserver(() => {
      // The row got wider or narrower, so re-measure from scratch: a child's natural width can
      // change with the row's (a label wrapping, a control shrinking to its own minimum).
      if (row.clientWidth === widthRef.current) return;
      widthRef.current = row.clientWidth;
      naturalRef.current = null;
      if (shownRef.current === countRef.current) fit();
      else setShown(countRef.current);
    });
    ro.observe(row);
    return () => ro.disconnect();
  }, [fit]);

  return { ref, shown };
}
