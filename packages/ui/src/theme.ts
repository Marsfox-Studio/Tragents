import { BRAND_PALETTES, type BrandPalette, type ThemeMode } from '@tragents/shared';

export interface ResolvedTheme {
  palette: BrandPalette;
  mode: ThemeMode;
  effective: 'light' | 'dark';
}

function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

export function applyTheme(
  _palette: BrandPalette,
  mode: ThemeMode,
  root: HTMLElement = document.documentElement,
): ResolvedTheme {
  const effective = resolveMode(mode);
  root.dataset.theme = effective;
  root.dataset.palette = 'mono';
  root.style.colorScheme = effective;
  return { palette: 'mono', mode, effective };
}

/** Watch system color scheme. Returns an unsubscribe. */
export function watchSystemMode(onChange: (effective: 'light' | 'dark') => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => onChange(e.matches ? 'dark' : 'light');
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}

export function listPalettes() {
  return BRAND_PALETTES;
}

export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

export function hexWithAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean,
    16,
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

