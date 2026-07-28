import { HttpError } from '../http/errors';

type EvolutionConfiguration = {
  configured: boolean;
  apiUrl?: string;
  apiKey?: string;
  instanceId?: string;
  instanceName?: string;
};

export function getEvolutionConfiguration(): EvolutionConfiguration {
  const apiUrl = process.env.EVOLUTION_API_URL?.trim().replace(/\/+$/, '');
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();
  const instanceId = process.env.EVOLUTION_INSTANCE_ID?.trim();
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME?.trim();
  const validUrl = Boolean(apiUrl && /^https?:\/\//i.test(apiUrl));
  const validKey = Boolean(apiKey && apiKey.length <= 500 && !/[\r\n]/.test(apiKey));
  const validInstanceId = Boolean(instanceId && instanceId.length <= 160 && /^[a-zA-Z0-9_-]+$/.test(instanceId));
  const validInstanceName = Boolean(instanceName && instanceName.length <= 160 && !/[\r\n]/.test(instanceName));
  return {
    configured: validUrl && validKey && validInstanceId && validInstanceName,
    apiUrl,
    apiKey,
    instanceId,
    instanceName,
  };
}

function evolutionHeaders(configuration: EvolutionConfiguration) {
  return {
    apikey: String(configuration.apiKey),
    instanceId: String(configuration.instanceId),
    instanceName: String(configuration.instanceName),
  };
}

function pickMessageId(payload: any): string | null {
  const value = payload?.data?.Info?.ID
    || payload?.data?.Info?.Id
    || payload?.data?.info?.id
    || payload?.data?.key?.id
    || payload?.data?.id
    || payload?.key?.id
    || payload?.messageId
    || payload?.id;
  return typeof value === 'string' ? value : null;
}

export async function sendDocumentWithEvolutionGo(input: {
  recipientNumber: string;
  caption: string;
  filename: string;
  pdf: Buffer;
  idempotencyKey: string;
}) {
  const configuration = getEvolutionConfiguration();
  if (!configuration.configured) {
    throw new HttpError(503, 'PROVIDER_NOT_CONFIGURED', 'WhatsApp provider is not configured');
  }

  const form = new FormData();
  form.set('number', input.recipientNumber);
  form.set('type', 'document');
  form.set('caption', input.caption);
  form.set('filename', input.filename);
  form.set('id', input.idempotencyKey);
  form.set('file', new Blob([input.pdf], { type: 'application/pdf' }), input.filename);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${configuration.apiUrl}/send/media`, {
      method: 'POST',
      signal: controller.signal,
      headers: evolutionHeaders(configuration),
      body: form,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = response.status === 401 || response.status === 403
        ? 'EVOLUTION_AUTH_FAILED'
        : response.status === 404
          ? 'EVOLUTION_ENDPOINT_NOT_FOUND'
          : 'EVOLUTION_SEND_REJECTED';
      throw new HttpError(502, code, 'WhatsApp provider rejected the request');
    }
    return { messageId: pickMessageId(payload) };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const code = error instanceof Error && error.name === 'AbortError'
      ? 'EVOLUTION_TIMEOUT'
      : 'EVOLUTION_UNAVAILABLE';
    throw new HttpError(502, code, 'WhatsApp provider is unavailable');
  } finally {
    clearTimeout(timeout);
  }
}

function connectedFromPayload(payload: any) {
  const data = payload?.data ?? payload;
  const connected = typeof data?.Connected === 'boolean' ? data.Connected : data?.connected;
  const loggedIn = typeof data?.LoggedIn === 'boolean' ? data.LoggedIn : data?.loggedIn;
  if (typeof connected === 'boolean' && typeof loggedIn === 'boolean') {
    return connected && loggedIn;
  }
  if (typeof connected === 'boolean') return connected;
  const value = String(data?.state || data?.status || data?.connectionStatus || '').toLowerCase();
  return ['open', 'connected', 'online', 'ready'].includes(value);
}

export async function getEvolutionGoStatus() {
  const configuration = getEvolutionConfiguration();
  if (!configuration.configured) {
    return { configured: false, available: false, instanceConnected: false };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_500);
  try {
    const response = await fetch(`${configuration.apiUrl}/instance/status`, {
      signal: controller.signal,
      headers: evolutionHeaders(configuration),
    });
    const payload = await response.json().catch(() => ({}));
    return {
      configured: true,
      available: response.ok,
      instanceConnected: response.ok && connectedFromPayload(payload),
    };
  } catch {
    return { configured: true, available: false, instanceConnected: false };
  } finally {
    clearTimeout(timeout);
  }
}
