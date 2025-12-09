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
import type { Appointment, Clinic, Colonia, User, Patient } from './definitions';
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

const getCollection = async <T>(collectionName: string): Promise<T[]> => {
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

const getDocument = async <T>(collectionName: string, docId: string): Promise<T | null> => {
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { patient, ...appointmentData } = appointment;

  const dataToSave = {
    ...appointmentData,
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

export async function getAppointments(): Promise<Appointment[]> {
    const appointments = await getCollection<any>('appointments');
    
    const enrichedAppointmentsPromises = appointments
        .filter(app => !!app.patientId)
        .map(async (app) => {
            try {
                const patient = await getDocument<Patient>('patients', app.patientId);
                if (!patient) return null;

                return {
                    ...app,
                    date: (app.date as Timestamp).toDate().toISOString(),
                    patient: { ...patient },
                };
            } catch (error) {
                console.error(`Failed to enrich appointment ${app.id} for patient ${app.patientId}:`, error);
                return null;
            }
        });

    const settledAppointments = await Promise.all(enrichedAppointmentsPromises);
    
    return settledAppointments
        .filter((app): app is Appointment => app !== null)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};


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
      return { ...data, id: doc.id, date: (data.date as Timestamp).toDate().toISOString() } as Appointment;
    });

    const enrichedAppointments = await Promise.all(
        appointments
            .filter(app => !!app.patientId)
            .map(async (app) => {
            const patient = await getDocument<Patient>('patients', app.patientId);
            if (!patient) return null;
            return { ...app, patient: { ...patient } };
        })
    );

    return enrichedAppointments.filter(app => app !== null) as Appointment[];

  } catch(error) {
     handleFirestoreError(error, { path: 'appointments', operation: 'list' });
     return [];
  }
}

// ========== Patients ==========
export const findPatientByCURP = async (curp: string): Promise<Patient | null> => {
    const db = getDb();
    const q = query(collection(db, 'patients'), where('curp', '==', curp.toUpperCase()));
    try {
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as Patient;
        }
        return null;
    } catch (error) {
        handleFirestoreError(error, { path: 'patients', operation: 'list' });
        return null;
    }
}

export const savePatient = async(patient: Patient): Promise<string> => {
    const db = getDb();
    const docRef = doc(db, 'patients', patient.id);
    try {
      await setDoc(docRef, patient, { merge: true });
      return patient.id;
    } catch(error) {
      handleFirestoreError(error, { path: docRef.path, operation: 'write', requestResourceData: patient });
      throw error; // Rethrow to be caught by the calling function
    }
}

// ========== Config data from Firestore for Admin panel ==========

export async function getClinics(): Promise<Clinic[]> {
    return getCollection<Clinic>('clinics');
};

export async function getColonias(): Promise<Colonia[]> {
    return getCollection<Colonia>('colonias');
}

export const getAnnouncements = async (): Promise<string[]> => {
  try {
      const settings = await getDocument<{ messages?: string[] }>('settings', 'announcements');
      return settings?.messages || [];
  } catch (error) {
      console.error("Failed to get announcements from Firestore, returning empty. Error:", error);
      return [];
  }
}