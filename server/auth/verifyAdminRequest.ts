import { HttpError } from '../http/errors';
import { FirebaseAdminConfigurationError, getFirebaseAdmin } from './firebaseAdmin';

export async function verifyAdminRequest(request: any) {
  const authorization = String(request.headers?.authorization || '');
  const match = authorization.match(/^Bearer ([^\s]+)$/i);
  if (!match?.[1]) throw new HttpError(401, 'AUTH_REQUIRED', 'Authentication required');

  let auth;
  let db;
  try {
    ({ auth, db } = getFirebaseAdmin());
  } catch (error) {
    if (error instanceof FirebaseAdminConfigurationError) {
      throw new HttpError(500, 'AUTH_PROVIDER_NOT_CONFIGURED', error.message);
    }
    throw error;
  }
  let decoded;
  try {
    decoded = await auth.verifyIdToken(match[1]);
  } catch {
    throw new HttpError(401, 'AUTH_INVALID', 'Authentication is invalid or expired');
  }

  const admin = await db.doc(`admins/${decoded.uid}`).get();
  const adminData = admin.data();
  if (!admin.exists || adminData?.active !== true || adminData?.role !== 'admin') {
    throw new HttpError(403, 'ADMIN_REQUIRED', 'Admin access required');
  }

  return { db, uid: decoded.uid };
}
