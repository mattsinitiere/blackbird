import qrcode from "qrcode-generator";

/**
 * A QR code as a module grid, for drawing on a canvas (the exported player
 * card, components/PlayerCard.js). Error correction H (30%) so the
 * Blackbird mark can sit in the middle and it still scans. Pure.
 * @returns {{ n: number, dark: (r: number, c: number) => boolean }}
 */
export function qrMatrix(text) {
  const q = qrcode(0, "H");
  q.addData(String(text));
  q.make();
  const n = q.getModuleCount();
  return { n, dark: (r, c) => r >= 0 && c >= 0 && r < n && c < n && q.isDark(r, c) };
}

/** Whether (r, c) is inside one of the three 7×7 corner finder squares. */
export function inFinder(n, r, c) {
  return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
}
