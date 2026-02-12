import { initializeApp, getApp, getApps, type FirebaseOptions } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

// This is a separate initialization for server-side actions.
// It uses the same config but ensures it runs with server privileges.
const ADMIN_APP_NAME = 'firebase-admin-app-server';

const adminAppConfig: FirebaseOptions = {
    ...firebaseConfig,
};


export function getAdminApp() {
  const apps = getApps();
  const adminApp = apps.find(app => app.name === ADMIN_APP_NAME);
  if (adminApp) {
    return adminApp;
  }
  return initializeApp(adminAppConfig, ADMIN_APP_NAME);
}

// Export the Firestore instance for server-side use
export const adminDb = getFirestore(getAdminApp());
