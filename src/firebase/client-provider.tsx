'use client';

import React, { useMemo, type ReactNode, useEffect } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  // By calling initializeFirebase() here, we ensure that the singleton
  // instance is created or retrieved on the client-side.
  // The useMemo with an empty dependency array ensures this runs only once per component instance.
  const services = useMemo(() => initializeFirebase(), []);

  useEffect(() => {
    const { auth } = services;
    
    // Subscribe to auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // If there is no user, sign in anonymously.
      // This is crucial for security rules that require request.auth != null
      if (!user) {
        signInAnonymously(auth).catch(error => {
            // We still log this error because a failure to sign in anonymously is a critical setup issue.
            console.error("Anonymous sign-in failed:", error);
        });
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();

  }, [services]); // Depend on the services object from useMemo.

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
