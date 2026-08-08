import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDrxxHsjqTMevW8Trrtq8BG7yRuehI1YeQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ai-data-analysis-9805c.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "ai-data-analysis-9805c",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "ai-data-analysis-9805c.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "680407260953",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:680407260953:web:4197365fb084286cda2f88",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-CT2ZSMQ0ME",
  firestoreDatabaseId: "(default)"
};
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

// Test connection on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client appears offline or unable to connect.');
    }
  }
}
testConnection();
