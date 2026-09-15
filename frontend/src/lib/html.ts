/* html.ts — HTML escaping for the few places that build markup as a string.
 *
 * The app is otherwise pure JSX (React escapes for us). Two paths are not:
 *  - `lib/print.ts` writes a whole document into a popup via `document.write`;
 *  - the receipt/report builders compose `<tr>/<td>` fragments that end up there.
 * Both interpolate server data (member names, narration, remarks, numbers) into
 * markup, and the popup is same-origin, so an unescaped value would execute as
 * script in the app's own origin (SRS §24).
 *
 * Escape every interpolated *value*; never the surrounding template. */

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape a value for interpolation into HTML text or a quoted attribute. */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (char) => ENTITIES[char] ?? char);
}
