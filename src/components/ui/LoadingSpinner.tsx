interface LoadingSpinnerProps {
  /** Show as full-screen centered loader with background */
  fullScreen?: boolean;
  /** Optional description text shown below the spinner */
  text?: string;
  /** Size of the spinner (default: 8 → h-8 w-8) */
  size?: number;
  /** For inline/button spinners (smaller, no padding) */
  inline?: boolean;
  /** Use white colors for dark backgrounds (e.g. buttons on gradient) */
  light?: boolean;
}

function Spinner({ size = 8, light = false }: { size: number; light?: boolean }) {
  const borderSize = size >= 8 ? 'border-4' : 'border-2';
  const borderColor = light ? 'border-white/20 border-t-white' : 'border-emerald-200 border-t-emerald-600';
  return (
    <div
      className={`${borderSize} ${borderColor} rounded-full animate-spin`}
      style={{ width: `${size * 4}px`, height: `${size * 4}px` }}
      role="status"
      aria-label="Loading"
    />
  );
}

export default function LoadingSpinner({
  fullScreen = false,
  text,
  size = 8,
  inline = false,
  light = false,
}: LoadingSpinnerProps) {
  const spinner = <Spinner size={size} light={light} />;

  // Inline spinner (for buttons, small indicators)
  if (inline) {
    return spinner;
  }

  // Full-screen loading state
  if (fullScreen) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="flex flex-col items-center gap-4">
          {spinner}
          {text && (
            <p className="text-sm font-medium text-stone-500">{text}</p>
          )}
        </div>
      </div>
    );
  }

  // Centered inline (used inside Suspense fallbacks, modals, etc.)
  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        {spinner}
        {text && (
          <p className="text-sm font-medium text-stone-500">{text}</p>
        )}
      </div>
    </div>
  );
}
