'use server'

import { initializeApp, getApp, getApps, type FirebaseOptions } from 'firebase/app';
import { firebaseConfig } from './config';

// This is a separate initialization for server-side actions.
// It uses the same config but ensures it runs with server privileges.
const ADMIN_APP_NAME = 'firebase-admin-app';

const adminAppConfig: FirebaseOptions = {
    ...firebaseConfig,
    // IMPORTANT: In a real production app, you would use a service account
    // to grant the server admin privileges. For this development environment,
    // simply using the client-side config on the server will work because
    // the emulator is open.
    // In a real app, you would do something like this:
    // databaseURL: `https://<YOUR_PROJECT_ID>.firebaseio.com`,
    // credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)),
};


export function getAdminApp() {
  const apps = getApps();
  const adminApp = apps.find(app => app.name === ADMIN_APP_NAME);
  if (adminApp) {
    return adminApp;
  }
  return initializeApp(adminAppConfig, ADMIN_APP_NAME);
}
