export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ success: false, code: 'METHOD_NOT_ALLOWED', error: 'Method not allowed' });
  }

  try {
    const [{ verifyAdminRequest }, { getResendConfiguration }] = await Promise.all([
      import('../../server/auth/verifyAdminRequest.js'),
      import('../../server/providers/resendEmailProvider.js'),
    ]);
    await verifyAdminRequest(request);
    const emailConfigured = getResendConfiguration().configured;

    response.setHeader('Cache-Control', 'private, max-age=15, stale-while-revalidate=30');
    return response.json({
      email: {
        configured: emailConfigured,
        available: emailConfigured,
      },
      postal: Boolean(process.env.POSTAL_LOOKUP_URL?.trim().includes('{pin}')),
    });
  } catch (error) {
    const { sendSafeError } = await import('../../server/http/errors.js');
    return sendSafeError(response, error);
  }
}
