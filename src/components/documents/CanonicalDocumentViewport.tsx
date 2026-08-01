import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Maximize2, Minimize2, ScanLine, ZoomIn, ZoomOut } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAccessibleOverlay } from '../../hooks/useAccessibleOverlay';

const MM_TO_PX = 96 / 25.4;

type Props = {
  children: ReactNode;
  documentRef: RefObject<HTMLDivElement | null>;
  containedFullScreen?: boolean;
  onFullScreenChange?: (fullScreen: boolean) => void;
};

export default function CanonicalDocumentViewport({ children, documentRef, containedFullScreen = false, onFullScreenChange }: Props) {
  const { language } = useLanguage();
  const text = (english: string, tamil: string) => language === 'ta' ? tamil : english;
  const stageRef = useRef<HTMLDivElement>(null);
  const closeFullScreenRef = useRef<HTMLButtonElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [fullScreen, setFullScreen] = useState(false);
  const [viewMode, setViewMode] = useState<'content' | 'page'>('content');
  const [preview, setPreview] = useState({ scale: 1, height: 0, width: 0 });
  const setFullScreenState = useCallback((value: boolean) => {
    setFullScreen(value);
    onFullScreenChange?.(value);
  }, [onFullScreenChange]);

  const updatePreview = useCallback(() => {
    const viewport = viewportRef.current;
    const documentRoot = documentRef.current;
    if (!viewport || !documentRoot) return;
    const footer = documentRoot.querySelector<HTMLElement>('.document-final-footer');
    let contentHeight = documentRoot.scrollHeight;
    if (footer && viewMode === 'page') {
      footer.style.marginTop = '0px';
      const pageHeight = documentRoot.clientWidth * (297 / 210);
      const bottomMargin = Number.parseFloat(window.getComputedStyle(documentRoot).paddingBottom) || 0;
      contentHeight = footer.offsetTop;
      const contentBottom = footer.getBoundingClientRect().bottom - documentRoot.getBoundingClientRect().top;
      const pages = Math.max(1, Math.ceil((contentBottom + bottomMargin - 2) / pageHeight));
      const gap = Math.max(0, (pages * pageHeight) - bottomMargin - contentBottom);
      footer.style.marginTop = `${gap}px`;
    } else if (footer) footer.style.marginTop = '';
    const horizontalPadding = fullScreen ? 32 : 0;
    const availableWidth = Math.max(1, viewport.clientWidth - horizontalPadding);
    const documentWidth = 210 * MM_TO_PX;
    const fitScale = availableWidth / documentWidth;
    const maximumScale = fullScreen ? 1.6 : 1;
    const scale = Math.min(maximumScale, Math.max(0.25, fitScale * zoom));
    setPreview({
      scale,
      height: Math.ceil((viewMode === 'content' && !fullScreen ? contentHeight : documentRoot.scrollHeight) * scale),
      width: Math.ceil(Math.max(viewport.clientWidth, documentWidth * scale)),
    });
  }, [documentRef, fullScreen, viewMode, zoom]);

  useEffect(() => {
    updatePreview();
    const observer = new ResizeObserver(updatePreview);
    if (viewportRef.current) observer.observe(viewportRef.current);
    if (documentRef.current) observer.observe(documentRef.current);
    return () => observer.disconnect();
  }, [children, documentRef, updatePreview]);

  const closePreview = useCallback(() => {
    if (window.history.state?.billEaseDocumentPreview) window.history.back();
    else setFullScreenState(false);
  }, [setFullScreenState]);

  useAccessibleOverlay({
    open: fullScreen && !containedFullScreen,
    containerRef: stageRef,
    initialFocusRef: closeFullScreenRef,
    onClose: closePreview,
  });

  useEffect(() => {
    if (!fullScreen || containedFullScreen) return;
    window.history.pushState({ ...window.history.state, billEaseDocumentPreview: true }, '');

    const closeFromHistory = () => setFullScreenState(false);
    window.addEventListener('popstate', closeFromHistory);
    return () => {
      window.removeEventListener('popstate', closeFromHistory);
    };
  }, [containedFullScreen, fullScreen, setFullScreenState]);

  useEffect(() => {
    const closeForTopOverlay = () => {
      if (!fullScreen || containedFullScreen) return;
      setFullScreenState(false);
      window.setTimeout(() => window.dispatchEvent(new Event('billease:document-fullscreen-closed')), 0);
    };
    window.addEventListener('billease:close-document-fullscreen', closeForTopOverlay);
    return () => window.removeEventListener('billease:close-document-fullscreen', closeForTopOverlay);
  }, [containedFullScreen, fullScreen, setFullScreenState]);

  const previewStage = (
    <section
      ref={stageRef}
      role={fullScreen && !containedFullScreen ? 'dialog' : undefined}
      aria-modal={fullScreen && !containedFullScreen ? true : undefined}
      aria-label={fullScreen && !containedFullScreen ? text('Full screen document preview', 'முழுத்திரை ஆவண முன்னோட்டம்') : undefined}
      className={fullScreen
        ? `${containedFullScreen ? 'h-full' : 'fixed inset-0 z-[var(--z-document-fullscreen)] h-[100dvh]'} canonical-preview-stage canonical-preview-fullscreen flex flex-col bg-stone-200 print:static print:h-auto`
        : 'canonical-preview-stage'}
    >
      <div className="canonical-preview-toolbar flex flex-wrap items-center gap-2 print:hidden">
        <button type="button" onClick={() => { setZoom(1); setViewMode('content'); }} className={`preview-control ${viewMode === 'content' ? 'preview-control-active' : ''}`} aria-pressed={viewMode === 'content'}><ScanLine size={17} />{text('Fit Content', 'உள்ளடக்கத்தைப் பொருத்து')}</button>
        <button type="button" onClick={() => { setZoom(1); setViewMode('page'); }} className={`preview-control ${viewMode === 'page' ? 'preview-control-active' : ''}`} aria-pressed={viewMode === 'page'}><FileText size={17} />{text('Full A4', 'முழு A4')}</button>
        <button ref={fullScreen ? closeFullScreenRef : undefined} type="button" onClick={() => { if (fullScreen) closePreview(); else { setViewMode('page'); setFullScreenState(true); } }} className="preview-control">
          {fullScreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          {fullScreen ? text('Close Full Screen', 'முழுத்திரையை மூடு') : text('Full Screen', 'முழுத்திரை')}
        </button>
        <div className="ml-auto flex items-center rounded-xl border border-stone-200 bg-white">
          <button type="button" onClick={() => setZoom((current) => Math.max(0.6, current - 0.1))} className="flex min-h-12 min-w-12 items-center justify-center" aria-label={text('Zoom out', 'சிறிதாக்கு')}><ZoomOut size={18} /></button>
          <span className="min-w-14 text-center text-sm font-semibold text-stone-700">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((current) => Math.min(1.6, current + 0.1))} className="flex min-h-12 min-w-12 items-center justify-center" aria-label={text('Zoom in', 'பெரிதாக்கு')}><ZoomIn size={18} /></button>
        </div>
      </div>
      <div
        ref={viewportRef}
        className={`canonical-preview-viewport bg-stone-100 print:overflow-visible print:bg-white ${fullScreen ? 'min-h-0 flex-1 overflow-auto overscroll-contain' : 'rounded-xl overflow-hidden'}`}
      >
        <div className="canonical-preview-canvas" style={{ height: preview.height || undefined, width: preview.width || undefined }}>
          <div className="canonical-preview-transform" style={{ transform: `translateX(-50%) scale(${preview.scale})` }}>
            <div ref={documentRef} className={`canonical-a4-document bg-white text-black ${viewMode === 'content' && !fullScreen ? 'preview-fit-content' : ''}`} data-export-root="true">
              {children}
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  return fullScreen && !containedFullScreen ? createPortal(previewStage, document.body) : previewStage;
}
