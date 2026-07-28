import { verifyAdminRequest } from '../server/auth/verifyAdminRequest.ts';
import { sendSafeError } from '../server/http/errors.ts';

export const requireAdmin = verifyAdminRequest;
export const fail = sendSafeError;
