import { requireAdmin, fail } from '../_auth.js';

async function fetchPostalProvider(url, retry = true) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (retry && response.status >= 500) return fetchPostalProvider(url, false);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await requireAdmin(req);
    const pin = String(req.body?.pin || '').replace(/\D/g, '');
    if (!/^\d{6}$/.test(pin)) return res.status(400).json({ error: 'Invalid PIN code' });
    const postalUrl = process.env.POSTAL_LOOKUP_URL?.trim() || '';
    if (!postalUrl.includes('{pin}')) return res.status(503).json({ error: 'PIN lookup is not configured' });
    const response = await fetchPostalProvider(postalUrl.replace('{pin}', encodeURIComponent(pin)));
    if (!response.ok) return res.status(502).json({ error: 'Postal provider unavailable' });
    const payload = await response.json();
    const offices = Array.isArray(payload) ? (payload[0]?.PostOffice || payload) : (payload.PostOffice || payload.results || []);
    const results = offices.map((x) => ({ locality: String(x.Name || x.locality || ''), district: String(x.District || x.district || ''), state: String(x.State || x.state || '') })).filter((x) => x.locality && x.district && x.state);
    return results.length ? res.json(results) : res.status(404).json({ error: 'No locality found' });
  } catch (error) { return fail(res, error); }
}
