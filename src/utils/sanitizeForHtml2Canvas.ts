const UNSUPPORTED_COLOR_PATTERNS = ['oklch(', 'oklab(', 'lch(', 'lab(', 'color-mix(', 'color('];

const STYLE_FALLBACKS: Array<{
  property: keyof CSSStyleDeclaration;
  cssName: string;
  fallback: string;
  preserveTransparent?: boolean;
}> = [
  { property: 'color', cssName: 'color', fallback: '#111111' },
  { property: 'backgroundColor', cssName: 'background-color', fallback: '#ffffff', preserveTransparent: true },
  { property: 'borderTopColor', cssName: 'border-top-color', fallback: '#d1d5db' },
  { property: 'borderRightColor', cssName: 'border-right-color', fallback: '#d1d5db' },
  { property: 'borderBottomColor', cssName: 'border-bottom-color', fallback: '#d1d5db' },
  { property: 'borderLeftColor', cssName: 'border-left-color', fallback: '#d1d5db' },
  { property: 'outlineColor', cssName: 'outline-color', fallback: '#d1d5db' },
  { property: 'textDecorationColor', cssName: 'text-decoration-color', fallback: '#111111' },
  { property: 'fill', cssName: 'fill', fallback: '#111111' },
  { property: 'stroke', cssName: 'stroke', fallback: '#111111' },
  { property: 'boxShadow', cssName: 'box-shadow', fallback: 'none' },
  { property: 'textShadow', cssName: 'text-shadow', fallback: 'none' },
  { property: 'backgroundImage', cssName: 'background-image', fallback: 'none' },
  { property: 'filter', cssName: 'filter', fallback: 'none' },
  { property: 'backdropFilter', cssName: 'backdrop-filter', fallback: 'none' },
];

function hasUnsupportedColor(value: string) {
  const lower = value.toLowerCase();
  return UNSUPPORTED_COLOR_PATTERNS.some((pattern) => lower.includes(pattern));
}

function isTransparent(value: string) {
  const lower = value.trim().toLowerCase();
  return lower === 'transparent' || lower === 'rgba(0, 0, 0, 0)' || lower === 'rgb(0 0 0 / 0)';
}

function sanitizeElement(element: HTMLElement, win: Window) {
  const computed = win.getComputedStyle(element);

  STYLE_FALLBACKS.forEach(({ property, cssName, fallback, preserveTransparent }) => {
    const inlineValue = String(element.style[property] || '').trim();
    const computedValue = String(computed[property] || computed.getPropertyValue(cssName) || '').trim();
    const candidateValue = inlineValue || computedValue;

    if (!candidateValue) return;

    if (preserveTransparent && isTransparent(candidateValue)) {
      element.style.setProperty(cssName, 'transparent', 'important');
      return;
    }

    if (hasUnsupportedColor(candidateValue)) {
      element.style.setProperty(cssName, fallback, 'important');
      return;
    }

    element.style.setProperty(cssName, computedValue || candidateValue, 'important');
  });
}

export function sanitizeForHtml2Canvas(root: Document | HTMLElement) {
  const container = root instanceof Document ? root.body : root;
  if (!container) return;
  const win = container.ownerDocument.defaultView;
  if (!win) return;
  sanitizeElement(container as HTMLElement, win);
  const nodes = container.querySelectorAll<HTMLElement>('*');
  nodes.forEach((node) => sanitizeElement(node, win));
}
