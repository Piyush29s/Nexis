import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  setDoc,
  writeBatch,
  serverTimestamp,
  collection,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);

// ─── Emulator connections ─────────────────────────────────────────
// MUST happen synchronously at module load time, immediately after
// getAuth / getFirestore, BEFORE any reads/writes.
// The window flags prevent double-connection on Vite HMR reloads.
// Each call is wrapped in try/catch to handle the edge case where
// the SDK throws "already started" on hot module replacement.
if (import.meta.env.DEV) {
  if (!window.__FIREBASE_AUTH_EMULATOR_CONNECTED__) {
    try {
      connectAuthEmulator(auth, "http://localhost:9099", {
        disableWarnings: true,
      });
    } catch (e) {
      console.warn("Auth emulator already connected:", e.message);
    }
    window.__FIREBASE_AUTH_EMULATOR_CONNECTED__ = true;
  }

  if (!window.__FIREBASE_FIRESTORE_EMULATOR_CONNECTED__) {
    try {
      connectFirestoreEmulator(firestore, "localhost", 8080);
    } catch (e) {
      console.warn("Firestore emulator already connected:", e.message);
    }
    window.__FIREBASE_FIRESTORE_EMULATOR_CONNECTED__ = true;
  }
}

export { auth, firestore, doc, getDoc, setDoc, writeBatch, serverTimestamp, collection };
export default app;
