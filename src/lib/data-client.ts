'use client';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import type { Appointment, Clinic, Colonia } from './definitions';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const getDb = () => {
  const { firestore } = initializeFirebase();
  return firestore;
};

const handleFirestoreError = (
  error: any,
  context: {
    path: string;
    operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
    requestResourceData?: any;
  }
) => {
  const permissionError = new FirestorePermissionError({
    path: context.path,
    operation: context.operation,
    requestResourceData: context.requestResourceData,
  });
  errorEmitter.emit('permission-error', permissionError);
  throw permissionError;
};

export const getCollection = async <T>(collectionName: string): Promise<T[]> => {
    const db = getDb();
    const collectionRef = collection(db, collectionName);
    try {
        const snapshot = await getDocs(collectionRef);
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as T));
    } catch (error) {
        handleFirestoreError(error, { path: collectionName, operation: 'list' });
        return []; // Should not be reached due to throw
    }
};

export const getDocument = async <T>(collectionName: string, docId: string): Promise<T | null> => {
    const db = getDb();
    if (!docId) {
        console.warn(`getDocument called with undefined or null docId for collection ${collectionName}`);
        return null;
    }
    const docRef = doc(db, collectionName, docId);
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { ...docSnap.data(), id: docSnap.id } as T;
        }
        return null;
    } catch (error) {
        handleFirestoreError(error, { path: docRef.path, operation: 'get' });
        return null; // Should not be reached due to throw
    }
}

// ========== Appointments ==========

export async function saveAppointment(
  appointment: Appointment
): Promise<Appointment | null> {
  const db = getDb();
  const docRef = doc(db, 'appointments', appointment.id);

  const dataToSave = {
    ...appointment,
    date: Timestamp.fromDate(new Date(appointment.date)),
  };

  try {
    await setDoc(docRef, dataToSave);
    return appointment;
  } catch (error) {
    handleFirestoreError(error, {
      path: docRef.path,
      operation: 'create',
      requestResourceData: dataToSave,
    });
    return null;
  }
}

export async function deleteAppointment(id: string): Promise<void> {
  const db = getDb();
  const docRef = doc(db, 'appointments', id);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, { path: docRef.path, operation: 'delete' });
  }
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: 'Atendida' | 'Cancelada'
): Promise<boolean> {
  const db = getDb();
  const docRef = doc(db, 'appointments', appointmentId);
  try {
    await updateDoc(docRef, { status });
    return true;
  } catch (error) {
    handleFirestoreError(error, {
      path: docRef.path,
      operation: 'update',
      requestResourceData: { status },
    });
    return false;
  }
}

export async function getAppointments(): Promise<Appointment[]> {
    const appointments = await getCollection<any>('appointments');
    return appointments.map((app: any) => ({
        ...app,
        date: (app.date as Timestamp).toDate().toISOString(),
    }));
}

export async function getAppointmentsForClinic(clinicId: string): Promise<Appointment[]> {
  const db = getDb();
  const q = query(
    collection(db, 'appointments'),
    where('clinicId', '==', clinicId)
  );

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return { 
          ...data, 
          id: doc.id, 
          date: (data.date as Timestamp).toDate().toISOString() 
      } as Appointment;
    });
  } catch(error) {
     handleFirestoreError(error, { path: 'appointments', operation: 'list' });
     return [];
  }
}


export async function getAppointmentsByDate(date: Date): Promise<Appointment[]> {
  const db = getDb();
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
    const appointments = snapshot.docs.map((doc) => {
      const data = doc.data();
      return { 
          ...data, 
          id: doc.id, 
          date: (data.date as Timestamp).toDate().toISOString() 
      } as Appointment;
    });
    return appointments;
  } catch(error) {
     handleFirestoreError(error, { path: 'appointments', operation: 'list' });
     return [];
  }
}
