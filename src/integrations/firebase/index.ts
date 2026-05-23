import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Primary app — used for the signed-in user's session
const app = getApps().find((a) => a.name === "[DEFAULT]") ?? initializeApp(firebaseConfig);

// Secondary app — used ONLY for creating new Auth accounts from the admin panel
// without disturbing the admin's own session.
const secondaryApp =
  getApps().find((a) => a.name === "secondary") ??
  initializeApp(firebaseConfig, "secondary");

export const firebaseAuth          = getAuth(app);
export const secondaryFirebaseAuth = getAuth(secondaryApp);
export const db                    = getFirestore(app);
export const googleProvider        = new GoogleAuthProvider();
