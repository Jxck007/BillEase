import { Component, ErrorInfo, ReactNode } from 'react';

type State = { failed: boolean; errorId: string };
type Props = { children: ReactNode; area?: string; restorePath?: string };
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
    return <main className="flex min-h-[50dvh] items-center justify-center bg-stone-50 p-4"><div className="w-full max-w-lg rounded-2xl border bg-white p-6 text-center shadow-sm"><h1 className="text-2xl font-bold text-stone-900">Something went wrong</h1><p className="mt-2 text-stone-600">BillEase could not display this {this.props.area || 'section'}. Your saved records and local drafts were not changed.</p><p className="mt-4 font-mono text-xs text-stone-500">Error reference: {this.state.errorId}</p><div className="mt-6 grid gap-2 sm:grid-cols-2"><button onClick={() => window.location.reload()} className="min-h-12 rounded-xl bg-emerald-600 px-4 font-semibold text-white">Reload section</button><button onClick={() => { window.location.href = '/'; }} className="min-h-12 rounded-xl border px-4 font-semibold">Return to dashboard</button>{this.props.restorePath && <button onClick={() => { window.location.href = this.props.restorePath as string; }} className="min-h-12 rounded-xl border border-emerald-200 bg-emerald-50 px-4 font-semibold text-emerald-800">Restore latest local draft</button>}<button onClick={() => navigator.clipboard.writeText(this.state.errorId).catch(() => window.prompt('Copy this error reference:', this.state.errorId))} className="min-h-12 rounded-xl border px-4 font-semibold">Copy error reference</button></div></div></main>;
  }
}
