export type PostalResult = { locality: string; district: string; state: string };
export type Result<T> = { ok: true; value: T } | { ok: false; message: string };
export interface PostalLookupProvider { lookup(pin: string, token: string): Promise<Result<PostalResult[]>> }

function reportIntegrationFailure(integration: string, category: string, token: string) {
  const report = {
    errorId: `integration_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    route: window.location.pathname,
    appVersion: '0.0.0',
    category,
    device: /Android|iPhone|Mobile/i.test(navigator.userAgent) ? 'mobile-or-tablet' : 'desktop',
    integration,
  };
  fetch('/api/errors/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(report),
    keepalive: true,
  }).catch(() => undefined);
}

async function call<T>(url: string, token: string, init: RequestInit, retry = true, integration = 'unknown'): Promise<Result<T>> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    if (response.ok) return { ok: true, value: body as T };
    if (retry && response.status >= 500) return call<T>(url, token, init, false, integration);
    reportIntegrationFailure(integration, `HTTP_${response.status}`, token);
    return { ok: false, message: String(body.error || 'Integration unavailable') };
  } catch (error) {
    reportIntegrationFailure(integration, error instanceof DOMException && error.name === 'AbortError' ? 'Timeout' : 'NetworkError', token);
    return { ok: false, message: error instanceof DOMException && error.name === 'AbortError' ? 'Request timed out' : 'Integration unavailable' };
  } finally { window.clearTimeout(timer); }
}

export const postalProvider: PostalLookupProvider = {
  async lookup(pin, token) {
    const normalized = pin.replace(/\D/g, '');
    if (!/^\d{6}$/.test(normalized)) return { ok: false, message: 'Enter a six-digit PIN.' };
    const key = `billease.pin.${normalized}`;
    try { const cached = localStorage.getItem(key); if (cached) return { ok: true, value: JSON.parse(cached) }; } catch {}
    const result = await call<PostalResult[]>('/api/postal/lookup', token, { method: 'POST', body: JSON.stringify({ pin: normalized }) }, true, 'pin-lookup');
    if (result.ok) {
      try { localStorage.setItem(key, JSON.stringify(result.value)); } catch { /* Cache is optional. */ }
    }
    return result;
  },
};
