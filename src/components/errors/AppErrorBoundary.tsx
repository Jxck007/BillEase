import { Component, ErrorInfo, ReactNode } from 'react';

type State = { failed: boolean; errorId: string };
export default class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false, errorId: '' };
  static getDerivedStateFromError() {
    const errorId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `ui_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return { failed: true, errorId };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    const device = /Android|iPhone|Mobile/i.test(navigator.userAgent) ? 'mobile-or-tablet' : 'desktop';
    const report = { errorId: this.state.errorId, route: window.location.pathname, appVersion: '0.0.0', category: error.name || 'UIError', device, integration: 'none' };
    console.error('[BillEase error]', report);
    fetch('/api/errors/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report), keepalive: true }).catch(() => undefined);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="flex min-h-dvh items-center justify-center bg-stone-50 p-4"><div className="w-full max-w-lg rounded-2xl border bg-white p-6 text-center shadow-sm"><h1 className="text-2xl font-bold text-stone-900">Something went wrong</h1><p className="mt-2 text-stone-600">BillEase could not display this screen. Your saved records were not changed.</p><p className="mt-4 font-mono text-xs text-stone-500">Error ID: {this.state.errorId}</p><div className="mt-6 grid gap-2 sm:grid-cols-3"><button onClick={() => window.location.reload()} className="min-h-12 rounded-xl bg-emerald-600 px-4 font-semibold text-white">Retry</button><button onClick={() => { window.location.href = '/'; }} className="min-h-12 rounded-xl border px-4 font-semibold">Back to Dashboard</button><button onClick={() => navigator.clipboard.writeText(this.state.errorId)} className="min-h-12 rounded-xl border px-4 font-semibold">Copy Error ID</button></div></div></main>;
  }
}
