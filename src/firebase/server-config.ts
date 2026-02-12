import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

// This simplified function ensures a single, default instance of the Firebase app is used on the server.
// This is the standard and most robust pattern for Next.js server environments.
function getAppInstance() {
  if (getApps().length) {
    return getApp();
  }
  return initializeApp(firebaseConfig);
}

// Export the correctly initialized Firestore instance for all server-side use.
export const adminDb = getFirestore(getAppInstance());
