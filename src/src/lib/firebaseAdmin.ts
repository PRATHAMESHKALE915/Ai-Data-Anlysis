import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
const projectId = process.env.VITE_FIREBASE_PROJECT_ID || "ai-data-analysis-9805c";

if (!getApps().length) {
  initializeApp({
    projectId,
  });
}

export const adminAuth = getAuth();
