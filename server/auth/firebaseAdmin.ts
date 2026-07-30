import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export class FirebaseAdminConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FirebaseAdminConfigurationError';
  }
}

function readServiceAccount() {
  const raw = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    throw new FirebaseAdminConfigurationError('FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON is not configured.');
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new FirebaseAdminConfigurationError('FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON contains invalid JSON.');
  }

  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new FirebaseAdminConfigurationError('Firebase Admin service-account credentials are incomplete.');
  }

  return {
    projectId: String(parsed.project_id),
    clientEmail: String(parsed.client_email),
    privateKey: String(parsed.private_key).replace(/\\n/g, '\n'),
  };
}

function ensureFirebaseAdminApp() {
  if (getApps().length) return;
  const serviceAccount = readServiceAccount();
  initializeApp({ credential: cert(serviceAccount) });
}

export function getFirebaseAdmin() {
  ensureFirebaseAdminApp();
  return {
    auth: getAuth(),
    db: getFirestore(),
  };
}
