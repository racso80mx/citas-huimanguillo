'use client';

import React, { useMemo, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  // By calling initializeFirebase() here, we ensure that the singleton
  // instance is created or retrieved on the client-side.
  // The useMemo with an empty dependency array ensures this runs only once per component instance.
  const services = useMemo(() => initializeFirebase(), []);

  // NOTE: The useEffect that previously handled anonymous sign-in has been removed
  // to prevent an 'auth/configuration-not-found' error. This error suggests
  // Firebase Authentication may not be fully enabled for this project.
  // The app's current security rules are public, so this change allows the app
  // to function without requiring authentication.

  return (
    <FirebaseProvider
      firebaseApp={services.firebaseApp}
      auth={services.auth}
      firestore={services.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
