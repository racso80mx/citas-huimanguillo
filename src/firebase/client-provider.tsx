'use client';

import React, { useMemo, type ReactNode, useEffect } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { signInAnonymously } from 'firebase/auth';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  // Initialize Firebase on the client side, once per component mount.
  // Memoization ensures this only runs once.
  const firebaseServices = useMemo(() => {
    return initializeFirebase();
  }, []);

  useEffect(() => {
    const { auth } = firebaseServices;
    
    // Check if a user is already signed in. If not, sign in anonymously.
    // This is crucial for server-side rendering and for clients who haven't
    // logged in with a specific provider yet. It ensures that security rules
    // requiring any level of authentication (`request.auth != null`) pass.
    if (!auth.currentUser) {
        signInAnonymously(auth).catch(error => {
            console.error("Anonymous sign-in failed during initial load", error);
        });
    }

    // Additionally, you can subscribe to auth state changes to handle cases
    // where a user might sign out.
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (!user) {
        // User signed out, so sign in anonymously again to maintain a session.
        signInAnonymously(auth).catch(error => {
            console.error("Anonymous sign-in failed after state change", error);
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
