import { requireAdmin, fail } from '../_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await requireAdmin(req);
    const body = req.body || {};
    const report = {
      errorId: String(body.errorId || '').slice(0, 80),
      route: String(body.route || '').slice(0, 160),
      appVersion: String(body.appVersion || '').slice(0, 40),
      category: String(body.category || '').slice(0, 80),
      device: ['mobile-or-tablet', 'desktop'].includes(body.device) ? body.device : 'unknown',
      integration: String(body.integration || 'none').slice(0, 60),
    };
    console.error('[BillEase production error]', report);
    return res.status(202).json({ accepted: true });
  } catch (error) {
    return fail(res, error);
  }
}
