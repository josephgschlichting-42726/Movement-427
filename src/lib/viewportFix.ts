/**
 * iOS 26 home-screen web apps with a translucent status bar report a viewport that is
 * short by the top safe area (e.g. screen 852pt, innerHeight 793pt on a 393×852 iPhone),
 * so `bottom: 0` elements float ~59pt above the real bottom edge.
 *
 * We measure the shortfall and expose it as --vh-gap; bottom-anchored UI is pushed down
 * by that amount. Self-correcting: if iOS reports the full height, the gap is 0.
 * Only applied in standalone portrait — in Safari the difference is the browser toolbars.
 */
export function installViewportFix() {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (!standalone) return;

  const update = () => {
    const portrait = window.innerHeight > window.innerWidth;
    const screenH = Math.max(screen.width, screen.height);
    const gap = portrait ? screenH - window.innerHeight : 0;
    // Only correct the known-size shortfall (a status-bar's worth), never anything larger.
    const px = gap > 0 && gap <= 80 ? gap : 0;
    document.documentElement.style.setProperty('--vh-gap', `${px}px`);
  };
  update();
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
}
