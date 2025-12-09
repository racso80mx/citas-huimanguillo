'use client';

import React, { useMemo, type ReactNode, useEffect } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    return initializeFirebase();
  }, []);

  useEffect(() => {
    const { auth } = firebaseServices;
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // If no user is signed in (e.g., initial load or after a sign-out),
      // sign in anonymously. This ensures that security rules requiring
      // `request.auth != null` can pass for public actions like booking.
      if (!user) {
        signInAnonymously(auth).catch(error => {
            console.error("Anonymous sign-in failed:", error);
        });
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();

  }, [firebaseServices]);

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
