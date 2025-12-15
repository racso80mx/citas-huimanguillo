'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// This structure holds all our initialized Firebase services.
interface FirebaseServices {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}

// A private, module-level variable to hold the initialized services.
// This acts as a singleton instance.
let firebaseServices: FirebaseServices | null = null;

/**
 * Initializes Firebase services using a singleton pattern.
 * This function ensures that Firebase is initialized only once, providing a
 * stable and single instance of services throughout the application's lifecycle.
 * It's safe to call this function multiple times; it will return the existing
 * instance after the first initialization.
 *
 * @returns {FirebaseServices} An object containing the initialized FirebaseApp, Auth, and Firestore instances.
 */
export function initializeFirebase(): FirebaseServices {
  // If the services have already been initialized, return the existing instance.
  if (firebaseServices) {
    return firebaseServices;
  }

  // Check if any Firebase app has already been initialized (e.g., by another part of the codebase).
  // This is a safety check.
  const apps = getApps();
  const app = apps.length > 0 ? getApp() : initializeApp(firebaseConfig);

  // Create the services object.
  const services: FirebaseServices = {
    firebaseApp: app,
    auth: getAuth(app),
    firestore: getFirestore(app),
  };

  // Store the initialized services in the module-level variable.
  firebaseServices = services;

  return services;
}

// Re-export other necessary modules.
export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
