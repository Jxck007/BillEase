export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export function sendSafeError(response: any, error: unknown) {
  const status = error instanceof HttpError ? error.status : 500;
  const code = error instanceof HttpError ? error.code : 'INTERNAL_ERROR';
  const message = error instanceof HttpError && status < 500
    ? error.message
    : 'Integration unavailable';
  return response.status(status).json({ success: false, code, error: message });
}
