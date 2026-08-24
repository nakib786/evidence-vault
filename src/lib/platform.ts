/** Small, dependency-free platform checks shared by anything that behaves differently on iOS. */

/**
 * Safari and Chrome on iOS/iPadOS both use WebKit, and WebKit is stricter than
 * Chromium/Android about permission-gated APIs (install prompts, geolocation): no
 * `beforeinstallprompt`, and — for geolocation specifically — a request only succeeds if the
 * device's own Settings > Privacy & Security > Location Services has that specific browser
 * switched on, in addition to the per-site permission the page itself asks for. Android/desktop
 * Chrome has just the one, single-prompt permission model. Callers use this to show that extra
 * step only where it actually applies, rather than confusing an Android user with iOS-only
 * instructions.
 */
export function isIosWebkit(): boolean {
  const ua = navigator.userAgent;
  const isIosDevice = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ reports as "Macintosh" but, unlike a real Mac, has touch support.
  const isIpadDesktopMode = /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  return isIosDevice || isIpadDesktopMode;
}
