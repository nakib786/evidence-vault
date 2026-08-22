/**
 * Runs the driver.js walkthrough across the app's screens.
 *
 * driver.js drives one flat list of steps at a time, but our tour spans screens whose
 * elements only exist while that screen is mounted. So the hook restarts driver with the
 * current screen's steps whenever the screen changes, and keeps a single `active` flag as
 * the source of truth for whether the tour is running at all.
 *
 * driver.js is loaded dynamically. Nobody who skips the tour should pay for its bundle.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Driver } from 'driver.js';
import { TOUR_STEPS, hasSeenTour, markTourSeen } from '../lib/tour';
import type { Step } from '../lib/types';

export function useTour(step: Step) {
  const [active, setActive] = useState(false);
  const driverRef = useRef<Driver | null>(null);
  const activeRef = useRef(false);

  const stop = useCallback(() => {
    activeRef.current = false;
    setActive(false);
    markTourSeen();
    driverRef.current?.destroy();
    driverRef.current = null;
  }, []);

  const start = useCallback(() => {
    activeRef.current = true;
    setActive(true);
  }, []);

  /** True when the user has never been offered the tour. */
  const shouldOffer = useCallback(() => !hasSeenTour(), []);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;

    (async () => {
      const [{ driver }] = await Promise.all([
        import('driver.js'),
        import('driver.js/dist/driver.css'),
      ]);
      if (cancelled || !activeRef.current) return;

      const steps = TOUR_STEPS[step] ?? [];
      if (steps.length === 0) return;

      // Anchors for the current screen may not be painted yet on a fresh transition.
      const present = steps.filter((s) => document.querySelector(s.anchor));
      if (present.length === 0) return;

      // Start from the top. The tour is usually launched from a dialog, and whatever the
      // page was scrolled to beforehand makes the first highlight land unpredictably.
      window.scrollTo({ top: 0, behavior: 'auto' });
      // Yield one task so the dialog can leave the top layer and layout can settle before
      // driver.js measures. Deliberately setTimeout rather than requestAnimationFrame:
      // rAF is suspended outright in a backgrounded tab, so waiting on it means the tour
      // silently never starts for anyone whose browser throttles it.
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (cancelled || !activeRef.current) return;

      driverRef.current?.destroy();
      const d = driver({
        showProgress: true,
        allowClose: true,
        overlayOpacity: 0.6,
        stagePadding: 6,
        stageRadius: 14,
        popoverClass: 'ev-tour',
        nextBtnText: 'Next',
        prevBtnText: 'Back',
        doneBtnText: 'Done',
        steps: present.map((s) => ({
          element: s.anchor,
          popover: { title: s.title, description: s.description },
        })),
        /**
         * driver.js leaves `driver-active-element` on elements it has finished with, and
         * that class carries a z-index that lifts them above the dimming overlay. After a
         * few steps every card visited so far is still lit up, which defeats the point.
         * Strip it from everything except the element being highlighted right now.
         */
        onHighlightStarted: (element) => {
          document.querySelectorAll('.driver-active-element').forEach((el) => {
            if (el !== element) el.classList.remove('driver-active-element');
          });
        },
        // Fires for the close button, the overlay, and the Escape key alike.
        onDestroyStarted: () => {
          stop();
        },
      });
      driverRef.current = d;
      d.drive();
    })();

    return () => {
      cancelled = true;
      driverRef.current?.destroy();
      driverRef.current = null;
    };
  }, [active, step, stop]);

  // Tearing the tour down if the component unmounts avoids a stranded overlay.
  useEffect(() => () => driverRef.current?.destroy(), []);

  return { active, start, stop, shouldOffer };
}
