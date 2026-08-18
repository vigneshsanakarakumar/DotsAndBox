/**
 * Firebase Configuration
 * ────────────────────────────────────────────────────────────────────────────
 * SETUP INSTRUCTIONS (one time):
 *  1. Go to https://console.firebase.google.com
 *  2. Create a project (or use existing)
 *  3. Project Settings → Add App → Web App
 *  4. Copy the firebaseConfig object values into the fields below
 *  5. In Firebase Console → Authentication → Sign-in method → Enable:
 *       • Google
 *       • Email/Password
 *  6. In Firebase Console → Firestore → Create database (start in test mode)
 * ────────────────────────────────────────────────────────────────────────────
 */

export const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

// Set to true once you have filled in real values above.
export const FIREBASE_CONFIGURED = false;
