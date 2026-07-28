import { verifyAdminRequest } from '../../server/auth/verifyAdminRequest';
import { HttpError } from '../../server/http/errors';
import { getEvolutionConfiguration } from '../../server/providers/evolutionGoProvider';

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  try {
    await verifyAdminRequest(request);
    if (!getEvolutionConfiguration().configured) {
      return response.status(503).json({ ok: false, error: 'WhatsApp integration is not configured.' });
    }

    return response.status(503).json({
      ok: false,
      error: 'WhatsApp document delivery is not enabled.',
    });
  } catch (error) {
    if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
      return response.status(error.status).json({
        ok: false,
        error: error.status === 401 ? 'Unauthorized.' : 'Admin access denied.',
      });
    }
    return response.status(500).json({ ok: false, error: 'WhatsApp integration is unavailable.' });
  }
}
