const UNSUPPORTED_COLOR_PATTERNS = ['oklch(', 'oklab(', 'lch(', 'lab(', 'color-mix(', 'color('];

const STYLE_FALLBACKS: Array<{
  property: keyof CSSStyleDeclaration;
  fallback: string;
  preserveTransparent?: boolean;
}> = [
  { property: 'color', fallback: '#111111' },
  { property: 'backgroundColor', fallback: '#ffffff', preserveTransparent: true },
  { property: 'borderTopColor', fallback: '#d1d5db' },
  { property: 'borderRightColor', fallback: '#d1d5db' },
  { property: 'borderBottomColor', fallback: '#d1d5db' },
  { property: 'borderLeftColor', fallback: '#d1d5db' },
  { property: 'outlineColor', fallback: '#d1d5db' },
  { property: 'textDecorationColor', fallback: '#111111' },
  { property: 'fill', fallback: '#111111' },
  { property: 'stroke', fallback: '#111111' },
  { property: 'boxShadow', fallback: 'none' },
  { property: 'textShadow', fallback: 'none' },
  { property: 'backgroundImage', fallback: 'none' },
  { property: 'filter', fallback: 'none' },
  { property: 'backdropFilter', fallback: 'none' },
];

function hasUnsupportedColor(value: string) {
  const lower = value.toLowerCase();
  return UNSUPPORTED_COLOR_PATTERNS.some((pattern) => lower.includes(pattern));
}

function isTransparent(value: string) {
  const lower = value.trim().toLowerCase();
  return lower === 'transparent' || lower === 'rgba(0, 0, 0, 0)' || lower === 'rgb(0 0 0 / 0)';
}

function sanitizeElement(element: HTMLElement) {
  STYLE_FALLBACKS.forEach(({ property, fallback, preserveTransparent }) => {
    const value = element.style[property];
    if (!value || !hasUnsupportedColor(value)) return;
    if (preserveTransparent && isTransparent(value)) return;
    element.style.setProperty(property.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`), fallback, 'important');
  });
}

export function sanitizeForHtml2Canvas(root: Document | HTMLElement) {
  const container = root instanceof Document ? root.body : root;
  if (!container) return;
  sanitizeElement(container as HTMLElement);
  const nodes = container.querySelectorAll<HTMLElement>('*');
  nodes.forEach((node) => sanitizeElement(node));
}
