// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app;
let auth;
let db;

// Prevent multiple initializations
if (firebaseConfig.apiKey && firebaseConfig.projectId && !getApps().length) {
  try {
    app = initializeApp(firebase_config);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error('Failed to initialize Firebase', e);
  }
} else {
    // If we're on the client side, we can create dummy instances.
    // This is useful for storybook or other environments where you might not have env vars.
    if (typeof window !== 'undefined') {
        app = getApps()[0]; // if already initialized, use that
        if (!app) {
             console.warn("Firebase config not found, using placeholder. Some features may not work.");
             // You can initialize with dummy values if you want to test UI components
             // that depend on these objects but don't actively use them.
             app = initializeApp({apiKey: "dummy", projectId: "dummy"});
        }
        auth = getAuth(app);
        db = getFirestore(app);
    }
}


export { app, auth, db };
