import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export async function requireAdmin(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw Object.assign(new Error('Authentication required'), { status: 401 });
  if (!process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON) {
    throw Object.assign(new Error('Server authentication is not configured'), { status: 503 });
  }
  if (!getApps().length) {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON);
    } catch {
      throw Object.assign(new Error('Server authentication is not configured'), { status: 503 });
    }
    initializeApp({ credential: cert(serviceAccount) });
  }
  const decoded = await getAuth().verifyIdToken(token);
  const db = getFirestore();
  const record = await db.doc(`admins/${decoded.uid}`).get();
  if (!record.exists || record.data()?.active !== true || record.data()?.role !== 'admin') throw Object.assign(new Error('Not authorized'), { status: 403 });
  return { db, uid: decoded.uid };
}
export function fail(res, error) { const status = Number(error?.status) || 500; return res.status(status).json({ error: status >= 500 ? 'Integration unavailable' : error.message }); }
