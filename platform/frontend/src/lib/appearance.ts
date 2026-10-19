/**
 * Appearance preferences: colour theme (palette) + light/dark mode.
 *
 * The palettes themselves are pure CSS — see the APPEARANCE block in
 * app/globals.css, keyed on `data-theme="<id>"` on <html>. This file is only
 * the list the settings UI renders and the storage/apply plumbing. Adding a
 * theme = one entry here + one `:root[data-theme="…"]` block there.
 *
 * Preferences are stored per browser (localStorage), not per account.
 */

export const PALETTES = [
  { id: 'clay', label: 'Clay', swatch: '#806257' },
  { id: 'black', label: 'Black', swatch: '#18181B' },
  { id: 'blue', label: 'Blue', swatch: '#2563EB' },
  { id: 'cyan', label: 'Cyan', swatch: '#0891B2' },
  { id: 'teal', label: 'Teal', swatch: '#0D9488' },
  { id: 'indigo', label: 'Indigo', swatch: '#4F46E5' },
  { id: 'violet', label: 'Violet', swatch: '#7C3AED' },
  { id: 'magenta', label: 'Magenta', swatch: '#C026D3' },
] as const;

export type PaletteId = (typeof PALETTES)[number]['id'];

export const DEFAULT_PALETTE: PaletteId = 'clay';
export const PALETTE_STORAGE_KEY = 'ai4n-palette';
export const MODE_STORAGE_KEY = 'ai4n-mode';

/** Public marketing/auth pages keep the fixed brand look. */
export const UNTHEMED_PATHS = ['/', '/landing', '/login'];

export function isUnthemedPath(pathname: string | null): boolean {
  return UNTHEMED_PATHS.includes(pathname ?? '/');
}

export function isPaletteId(value: unknown): value is PaletteId {
  return PALETTES.some((p) => p.id === value);
}

/**
 * Runs in <head> before first paint so a saved palette never flashes the
 * default. (Light/dark is handled the same way by next-themes.)
 */
export const PALETTE_INIT_SCRIPT = `(function(){try{var p=location.pathname;if(${JSON.stringify(
  UNTHEMED_PATHS
)}.indexOf(p)>-1)return;var t=localStorage.getItem(${JSON.stringify(
  PALETTE_STORAGE_KEY
)});if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`;
