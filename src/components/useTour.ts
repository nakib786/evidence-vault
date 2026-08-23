/**
 * Runs the driver.js walkthrough across the app's screens.
 *
 * driver.js drives one flat list of steps at a time, but our tour spans screens whose
 * elements only exist while that screen is mounted. So the hook restarts driver with the
 * current screen's steps whenever the screen changes, and keeps a single `active` flag as
 * the source of truth for whether the tour is running at all.
 *
 * driver.js is loaded dynamically. Nobody who skips the tour should pay for its bundle.
 *
 * The tour also autoplays: each step dwells for `AUTOPLAY_MS`, shown as a thin progress bar
 * across the top of the popover, then advances on its own — so the whole app can narrate
 * itself hands-off. A toggle button injected into the popover footer pauses or resumes that
 * clock; it never disables the tour's other exits (Escape, the overlay, the close button,
 * or the app's own "End tour" control all still work immediately, autoplay or not).
 *
 * Reaching the end of one section's steps — by autoplay or by clicking "Done" — never stops
 * the tour on its own. It calls `onSectionEnd` instead, and leaves the actual decision to
 * the caller: `App.tsx` uses it to drive the real app one step further (capture a sample
 * file, fill in a jurisdiction, unlock the vault, open a record...), which changes `section`
 * and lets this hook pick the walkthrough back up wherever the app actually is now. That
 * indirection is what lets one continuous tour cross screens the tour itself knows nothing
 * about, rather than stopping every time it reaches a screen boundary.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Driver } from 'driver.js';
import { AUTOPLAY_MS, TOUR_STEPS, type TourSection } from '../lib/tour';

const PAUSE_ICON =
  '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor">' +
  '<rect x="5.5" y="4.5" width="4.2" height="15" rx="1"/><rect x="14.3" y="4.5" width="4.2" height="15" rx="1"/>' +
  '</svg>';
const PLAY_ICON =
  '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor">' +
  '<path d="M7.5 4.7v14.6a1 1 0 0 0 1.53.85l11.6-7.3a1 1 0 0 0 0-1.7l-11.6-7.3a1 1 0 0 0-1.53.85z"/>' +
  '</svg>';

export function useTour(section: TourSection, onSectionEnd: () => void) {
  const [active, setActive] = useState(false);
  const driverRef = useRef<Driver | null>(null);
  const activeRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playingRef = useRef(true);

  // Always the latest `onSectionEnd`, without making it a dependency of the effect below —
  // that effect must only restart driver when the section itself changes, not on every
  // render where the App component happens to hand in a new function identity.
  const onSectionEndRef = useRef(onSectionEnd);
  useEffect(() => {
    onSectionEndRef.current = onSectionEnd;
  });

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    setActive(false);
    clearTimer();
    driverRef.current?.destroy();
    driverRef.current = null;
  }, [clearTimer]);

  const start = useCallback(() => {
    activeRef.current = true;
    playingRef.current = true;
    setActive(true);
  }, []);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;

    (async () => {
      const [{ driver }] = await Promise.all([
        import('driver.js'),
        import('driver.js/dist/driver.css'),
      ]);
      if (cancelled || !activeRef.current) return;

      const steps = TOUR_STEPS[section] ?? [];
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

      // Schedules this step's auto-advance. Re-armed on every highlight (including manual
      // Next/Back), so a person driving the tour by hand always gets a fresh dwell window
      // rather than inheriting whatever was left on the previous step's clock.
      const scheduleAutoAdvance = () => {
        clearTimer();
        if (!playingRef.current) return;
        timerRef.current = setTimeout(() => {
          const current = driverRef.current;
          if (!current) return;
          if (current.hasNextStep()) {
            current.moveNext();
          } else {
            onSectionEndRef.current();
          }
        }, AUTOPLAY_MS);
      };

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
          scheduleAutoAdvance();
        },
        // "Done" only ever appears on a section's last step — hand off the same way
        // autoplay does when it reaches the end of that step on its own, rather than
        // closing the tour outright.
        onDoneClick: () => onSectionEndRef.current(),
        // Fires for the close button, the overlay, and the Escape key alike. Unlike
        // reaching the end of a section, these are always an explicit exit.
        onDestroyStarted: () => {
          clearTimer();
          stop();
        },
        /**
         * driver.js rebuilds the popover from scratch for every step (not just re-renders
         * it in place), so a plain CSS animation on a freshly created bar restarts cleanly
         * on its own — no manual reset needed. The play/pause button is a normal descendant
         * of `.driver-popover`, which driver.js already re-enables pointer events on, so it
         * needs no special wiring to be clickable under the tour's overlay.
         */
        onPopoverRender: (popover) => {
          const bar = document.createElement('div');
          bar.className = 'ev-tour-autobar';
          const fill = document.createElement('div');
          fill.className = 'ev-tour-autobar-fill';
          fill.style.animationDuration = `${AUTOPLAY_MS}ms`;
          fill.style.animationPlayState = playingRef.current ? 'running' : 'paused';
          bar.appendChild(fill);
          popover.wrapper.insertBefore(bar, popover.wrapper.firstChild);

          const toggle = document.createElement('button');
          toggle.type = 'button';
          toggle.className = 'ev-tour-playpause';
          const render = () => {
            toggle.innerHTML = playingRef.current ? PAUSE_ICON : PLAY_ICON;
            toggle.setAttribute(
              'aria-label',
              playingRef.current ? 'Pause the automatic tour' : 'Resume the automatic tour',
            );
          };
          render();
          toggle.addEventListener('click', () => {
            playingRef.current = !playingRef.current;
            render();
            if (playingRef.current) {
              // Restarting the fill (rather than resuming mid-animation) keeps the visible
              // bar and the JS timer in lockstep — both always represent a full, fresh
              // AUTOPLAY_MS window from the moment autoplay resumes.
              fill.style.animation = 'none';
              void fill.offsetWidth;
              fill.style.animation = '';
              fill.style.animationDuration = `${AUTOPLAY_MS}ms`;
              fill.style.animationPlayState = 'running';
              scheduleAutoAdvance();
            } else {
              fill.style.animationPlayState = 'paused';
              clearTimer();
            }
          });
          popover.footer.insertBefore(toggle, popover.footerButtons);
        },
      });
      driverRef.current = d;
      d.drive();
    })();

    return () => {
      cancelled = true;
      clearTimer();
      driverRef.current?.destroy();
      driverRef.current = null;
    };
  }, [active, section, stop, clearTimer]);

  // Tearing the tour down if the component unmounts avoids a stranded overlay.
  useEffect(() => () => {
    clearTimer();
    driverRef.current?.destroy();
  }, [clearTimer]);

  return { active, start, stop };
}
