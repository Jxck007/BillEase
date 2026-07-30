import { verifyAdminRequest } from '../server/auth/verifyAdminRequest.js';
import { sendSafeError } from '../server/http/errors.js';

export const requireAdmin = verifyAdminRequest;
export const fail = sendSafeError;
