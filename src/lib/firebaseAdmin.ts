import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let _app: App | undefined;

function getAdminApp(): App {
  if (_app) return _app;
  if (getApps().length > 0) {
    _app = getApps()[0];
    return _app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID
    || process.env.VITE_FIREBASE_PROJECT_ID
    || "ai-data-analysis-9805c";

  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (privateKey && clientEmail) {
    _app = initializeApp({ credential: cert({ projectId, privateKey, clientEmail }) });
  } else {
    // No service account — init with just projectId (works for Auth emulator or if using ADC)
    _app = initializeApp({ projectId });
  }

  return _app;
}

export const adminAuth = new Proxy({} as ReturnType<typeof getAuth>, {
  get(_target, prop) {
    return (getAuth(getAdminApp()) as any)[prop];
  }
});
