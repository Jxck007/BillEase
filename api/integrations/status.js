import { requireAdmin, fail } from '../_auth.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await requireAdmin(req);
    return res.json({
      email: Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim()),
      postal: Boolean(process.env.POSTAL_LOOKUP_URL?.trim().includes('{pin}')),
      signature: true,
      gst: false,
      barcode: false,
      ocr: false,
      ai: false,
    });
  }
  catch (error) { return fail(res, error); }
}
