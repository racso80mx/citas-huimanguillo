'use server';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  writeBatch,
  CollectionReference,
  DocumentReference,
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { initializeFirebase } from '@/firebase';
import type { Appointment, Colonia } from './definitions';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

// This function must be called to get the firestore instance
const getDb = async () => {
  const { firestore, auth } = initializeFirebase();

  // On the server, we need to be authenticated to read data, even if rules are public
  // We'll use anonymous auth for this.
  if (typeof window === 'undefined') {
    // Check if there's already a user
    if (!auth.currentUser) {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Anonymous sign-in failed", error);
        // Depending on the use case, you might want to throw the error
        // or handle it gracefully. For a public-read site, we might
        // want to proceed if rules allow, but here we'll log and continue.
      }
    }
  }

  return firestore;
};

// ========== Appointments ==========

export async function addAppointment(
  appointment: Appointment
): Promise<string> {
  const db = await getDb();
  const appointmentCollection = collection(db, 'appointments');
  // Firestore will auto-generate an ID if we use addDoc.
  // The passed `appointment` object already has a client-generated UUID.
  // We will use setDoc with a new doc ref to use our own ID.
  const docRef = doc(appointmentCollection, appointment.id);
  
  // Convert date string to Firestore Timestamp before saving
  const dataToSave = {
    ...appointment,
    date: Timestamp.fromDate(new Date(appointment.date)),
  };

  await setDoc(docRef, dataToSave).catch(error => {
     errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: docRef.path,
        operation: 'create',
        requestResourceData: dataToSave,
      })
    )
    // Re-throw the original error if you need to handle it further up the chain
    throw error;
  });

  return appointment.id;
}

export async function getAppointments(): Promise<Appointment[]> {
  const db = await getDb();
  const appointmentCollection = collection(db, 'appointments');
  
  try {
    const snapshot = await getDocs(appointmentCollection);
    const appointments = snapshot.docs.map((doc) => {
      const data = doc.data();
      // Convert Firestore Timestamp back to ISO string for consistency
      const date = (data.date as Timestamp).toDate().toISOString();
      return { ...data, id: doc.id, date } as Appointment;
    });

    return appointments.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  } catch (error) {
     errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: appointmentCollection.path,
        operation: 'list',
      })
    )
    throw error;
  }
}

export async function getAppointmentById(id: string): Promise<Appointment | null> {
    const db = await getDb();
    const docRef = doc(db, 'appointments', id);
    try {
      const docSnap = await getDoc(docRef);

      if(docSnap.exists()) {
          const data = docSnap.data();
          const date = (data.date as Timestamp).toDate().toISOString();
          return { ...data, id: docSnap.id, date } as Appointment;
      }
      return null;
    } catch(error) {
       errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'get',
        })
      )
      throw error;
    }
}

export async function getAppointmentsByDate(
  date: Date
): Promise<Appointment[]> {
  const db = await getDb();
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const q = query(
    collection(db, 'appointments'),
    where('date', '>=', Timestamp.fromDate(startOfDay)),
    where('date', '<=', Timestamp.fromDate(endOfDay))
  );

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      const date = (data.date as Timestamp).toDate().toISOString();
      return { ...data, id: doc.id, date } as Appointment;
    });
  } catch(error) {
     errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: 'appointments', // Path of the collection
        operation: 'list',
      })
    )
    throw error;
  }
}

export async function deleteAppointment(id: string): Promise<void> {
  const db = await getDb();
  const docRef = doc(db, 'appointments', id);
  await deleteDoc(docRef).catch(error => {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: docRef.path,
        operation: 'delete',
      })
    );
    throw error;
  });
}

// ========== Announcements ==========

export async function getAnnouncements(): Promise<string[]> {
  const db = await getDb();
  const docRef = doc(db, 'settings', 'announcements');
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      // Make sure to handle the case where messages might be undefined
      return docSnap.data().messages || [];
    }
    return [
      'Recuerda traer tu cartilla de vacunación.',
      'El uso de cubrebocas es opcional en las instalaciones.',
    ]; // Default if not set
  } catch(error) {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: docRef.path,
        operation: 'get',
      })
    )
    throw error;
  }
}

export async function updateAnnouncements(
  newAnnouncements: string[]
): Promise<boolean> {
    const db = await getDb();
    const docRef = doc(db, 'settings', 'announcements');
    const data = { messages: newAnnouncements.slice(0, 4) };
    
    await setDoc(docRef, data).catch(error => {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: docRef.path,
            operation: 'write',
            requestResourceData: data,
          })
        );
        throw error;
    });
    return true;
}

// ========== Slots Configuration ==========

export async function getSlotsConfiguration(): Promise<{ [key: string]: number }> {
  const db = await getDb();
  const docRef = doc(db, 'settings', 'slots');
  try {
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      // Ensure the keys are strings, as they will be from the form.
      const config = docSnap.data().config || {};
      const stringKeyConfig: {[key: string]: number} = {};
      for (const key in config) {
          stringKeyConfig[String(key)] = config[key];
      }
      return stringKeyConfig;
    }
    // Default configuration if not set in Firestore
    return {
      '1': 15, '2': 15, '3': 15, '4': 15,
      '5': 15, '6': 15, '7': 15, '8': 15,
    };
  } catch(error) {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: docRef.path,
        operation: 'get',
      })
    )
    throw error;
  }
}

export async function updateSlotsConfiguration(newConfig: {
  [key: string]: number;
}): Promise<boolean> {
    const db = await getDb();
    const docRef = doc(db, 'settings', 'slots');
    const data = { config: newConfig };

    await setDoc(docRef, data).catch(error => {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: docRef.path,
            operation: 'write',
            requestResourceData: data,
          })
        );
        throw error;
    });

    return true;
}

// ========== Weekend Booking Configuration ==========

export async function getWeekendBookingConfig(): Promise<{ enabled: boolean }> {
  const db = await getDb();
  const docRef = doc(db, 'settings', 'weekendBooking');
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return (docSnap.data() as { enabled: boolean }) || { enabled: false };
    }
    return { enabled: false }; // Default to disabled
  } catch (error) {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: docRef.path,
        operation: 'get',
      })
    )
    throw error;
  }
}

export async function updateWeekendBookingConfig(config: { enabled: boolean }): Promise<boolean> {
    const db = await getDb();
    const docRef = doc(db, 'settings', 'weekendBooking');
    
    await setDoc(docRef, config).catch(error => {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: docRef.path,
            operation: 'write',
            requestResourceData: config,
          })
        );
        throw error;
    });
    
    return true;
}

// ========== Colonias Configuration ==========

export async function getColonias(): Promise<Colonia[]> {
  const db = await getDb();
  const collectionRef = collection(db, 'colonias');
  try {
    const snapshot = await getDocs(collectionRef);
    if (snapshot.empty) {
      // Default data if collection is empty
      const defaultColonias = [
        { id: 'centro-id', nombre: 'Centro', nucleo: 1 },
        { id: 'pueblo-nuevo-id', nombre: 'Pueblo Nuevo', nucleo: 1 },
      ];
      // Optional: You could write these defaults to Firestore here
      // This would only run once when the collection is first accessed and found empty.
      const batch = writeBatch(db);
      defaultColonias.forEach(col => {
        const docRef = doc(db, 'colonias', col.id);
        batch.set(docRef, { nombre: col.nombre, nucleo: col.nucleo });
      });
      await batch.commit().catch(error => {
        // If the initial seeding fails, emit an error but still return defaults for UI
         errorEmitter.emit(
            'permission-error',
            new FirestorePermissionError({
                path: collectionRef.path,
                operation: 'write',
                requestResourceData: {info: "Batch write for default colonias failed."}
            })
        );
      });

      return defaultColonias;
    }
    return snapshot.docs.map(doc => ({...doc.data(), id: doc.id } as Colonia)).sort((a, b) => a.nombre.localeCompare(b.nombre));
  } catch(error) {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: collectionRef.path,
        operation: 'list',
      })
    )
    throw error;
  }
}

export async function updateColonias(colonias: Colonia[]): Promise<boolean> {
    const db = await getDb();
    const batch = writeBatch(db);
    const collectionRef = collection(db, 'colonias');

    // Get a list of documents currently in the collection
    const existingDocsSnapshot = await getDocs(collectionRef).catch(error => {
        // If we can't even read the collection, that's a permission error that needs to be surfaced
        errorEmitter.emit(
            'permission-error',
            new FirestorePermissionError({
                path: collectionRef.path,
                operation: 'list',
            })
        );
        throw error;
    });
    const existingIds = new Set(existingDocsSnapshot.docs.map(d => d.id));

    // Batch set/update operations for the provided colonias
    colonias.forEach(colonia => {
        const { id, ...data } = colonia;
        const docRef = doc(collectionRef, id); // Use the existing ID
        batch.set(docRef, data);
        existingIds.delete(id); // Remove from the set of IDs to be deleted
    });

    // Batch delete operations for colonias that were removed in the UI
    existingIds.forEach(idToDelete => {
        batch.delete(doc(collectionRef, idToDelete));
    });

    await batch.commit().catch(error => {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: collectionRef.path, // The error is on the batch commit, relates to the collection
            operation: 'write', // Batch can contain set, update, delete
            requestResourceData: {info: 'Batch operation on colonias collection.', data: colonias}
          })
        );
        throw error;
    });
    return true;
}

    
