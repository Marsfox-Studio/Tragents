export const CSS_VARS = {
  bg: '--tg-bg',
  bgElevated: '--tg-bg-elevated',
  bgSidebar: '--tg-bg-sidebar',
  bgInput: '--tg-bg-input',
  fg: '--tg-fg',
  fgMuted: '--tg-fg-muted',
  fgSubtle: '--tg-fg-subtle',
  primary: '--tg-primary',
  primaryFg: '--tg-primary-fg',
  primaryHover: '--tg-primary-hover',
  accent: '--tg-accent',
  border: '--tg-border',
  borderStrong: '--tg-border-strong',
  ring: '--tg-ring',
  success: '--tg-success',
  warning: '--tg-warning',
  danger: '--tg-danger',
} as const;

export const RADII = {
  none: '0',
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '20px',
  '2xl': '28px',
  full: '999px',
} as const;

export const SPACING = {
  sidebarWidth: '240px',
  sidebarCollapsedWidth: '64px',
  topbarHeight: '56px',
} as const;

export const FONT_STACK = {
  sans: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable Text", "Segoe UI", Inter, system-ui, sans-serif',
  display:
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI Variable Display", Inter, system-ui, sans-serif',
  mono: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace',
} as const;
