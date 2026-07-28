import { verifyAdminRequest } from '../../server/auth/verifyAdminRequest';
import { sendSafeError } from '../../server/http/errors';
import { getEvolutionConfiguration, getEvolutionGoStatus } from '../../server/providers/evolutionGoProvider';
import { getResendConfiguration } from '../../server/providers/resendEmailProvider';

const STATUS_CACHE_MS = 30_000;
let whatsappCache: { expiresAt: number; value: Awaited<ReturnType<typeof getEvolutionGoStatus>> } | null = null;

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') return response.status(405).json({ success: false, code: 'METHOD_NOT_ALLOWED', error: 'Method not allowed' });

  try {
    await verifyAdminRequest(request);
    const emailConfigured = getResendConfiguration().configured;
    const evolutionConfigured = getEvolutionConfiguration().configured;
    if (!evolutionConfigured) {
      whatsappCache = {
        expiresAt: Date.now() + STATUS_CACHE_MS,
        value: { configured: false, available: false, instanceConnected: false },
      };
    } else if (!whatsappCache || whatsappCache.expiresAt <= Date.now() || !whatsappCache.value.configured) {
      whatsappCache = {
        expiresAt: Date.now() + STATUS_CACHE_MS,
        value: await getEvolutionGoStatus(),
      };
    }

    response.setHeader('Cache-Control', 'private, max-age=15, stale-while-revalidate=30');
    return response.json({
      email: {
        configured: emailConfigured,
        available: emailConfigured,
      },
      whatsapp: whatsappCache.value,
      postal: Boolean(process.env.POSTAL_LOOKUP_URL?.trim().includes('{pin}')),
      signature: true,
    });
  } catch (error) {
    return sendSafeError(response, error);
  }
}
