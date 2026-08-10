import { Component, ErrorInfo, ReactNode } from 'react';
import { useLanguage } from '../../context/LanguageContext';

type State = { failed: boolean; errorId: string };
type Props = { children: ReactNode; area?: string; restorePath?: string };

function ErrorFallback({ errorId, restorePath }: { errorId: string; restorePath?: string }) {
  const { t } = useLanguage();
  return (
    <main className="flex min-h-[50dvh] items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-lg rounded-2xl border bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-stone-900">{t('somethingWentWrong')}</h1>
        <p className="mt-2 text-stone-600">{t('sectionDisplayFailed')}</p>
        <p className="mt-4 font-mono text-xs text-stone-500">{t('errorReference')}: {errorId}</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button onClick={() => window.location.reload()} className="min-h-12 rounded-xl bg-emerald-700 px-4 font-semibold text-white">{t('reloadSection')}</button>
          <button onClick={() => { window.location.href = '/'; }} className="min-h-12 rounded-xl border px-4 font-semibold">{t('backToDashboard')}</button>
          {restorePath && <button onClick={() => { window.location.href = restorePath; }} className="min-h-12 rounded-xl border border-emerald-200 bg-emerald-50 px-4 font-semibold text-emerald-800">{t('restoreLatestLocalDraft')}</button>}
          <button onClick={() => navigator.clipboard.writeText(errorId).catch(() => window.prompt(t('copyThisErrorReference'), errorId))} className="min-h-12 rounded-xl border px-4 font-semibold">{t('copyErrorReference')}</button>
        </div>
      </div>
    </main>
  );
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, errorId: '' };
  static getDerivedStateFromError() {
    const errorId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `ui_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return { failed: true, errorId };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    const report = { errorId: this.state.errorId, area: this.props.area || 'application', route: window.location.pathname, category: error.name || 'UIError' };
    if (import.meta.env.DEV) console.error('[BillEase render error]', report, error, info);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return <ErrorFallback errorId={this.state.errorId} restorePath={this.props.restorePath} />;
  }
}
