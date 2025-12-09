'use server';

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
  writeBatch,
  updateDoc,
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import type {
  Appointment,
  Clinic,
  Colonia,
  User,
  Patient,
} from './definitions';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import fs from 'fs/promises';
import path from 'path';

// Import static data
import clinicsData from './data/clinics.json';
import coloniasData from './data/colonias.json';
import announcementsData from './data/announcements.json';

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

// =======================
// JSON File Operations
// =======================
const dataFilePath = (filename: string) => path.join(process.cwd(), 'src', 'lib', 'data', filename);

async function writeJsonFile(filename: string, data: any): Promise<void> {
    try {
        console.warn(`Writing to static file ${filename}. A server restart is required for changes to take effect in the booking UI.`);
        await fs.writeFile(dataFilePath(filename), JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
        console.error(`Failed to write to static file ${filename}`, e);
        // This is a dev-time convenience, so we don't throw an error in production
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
    const db = getDb();
    const collectionRef = collection(db, 'appointments');

    try {
        const snapshot = await getDocs(collectionRef);
        const appointments = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                date: (data.date as Timestamp).toDate().toISOString()
            } as Appointment & { patientId: string };
        });

        const patientIds = [...new Set(appointments.map(app => app.patientId).filter(Boolean))];
        if (patientIds.length === 0) {
            return appointments.map(app => ({...app, patient: {} as Patient}));
        }

        const patientsRef = collection(db, 'patients');
        const patientsQuery = query(patientsRef, where('id', 'in', patientIds));
        const patientsSnapshot = await getDocs(patientsQuery);
        const patientsMap = new Map<string, Patient>();
        patientsSnapshot.docs.forEach(doc => {
            patientsMap.set(doc.id, { ...doc.data(), id: doc.id } as Patient);
        });

        return appointments.map(app => ({
            ...app,
            patient: patientsMap.get(app.patientId) || {} as Patient,
        })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    } catch (error) {
         handleFirestoreError(error, { path: 'appointments', operation: 'list' });
        return [];
    }
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
      return {
        ...data,
        id: doc.id,
        date: (data.date as Timestamp).toDate().toISOString(),
      } as Appointment;
    });

    const enrichedAppointments = await Promise.all(
      appointments
        .filter((app) => !!app.patientId)
        .map(async (app) => {
          const patient = await getDocument<Patient>('patients', app.patientId);
          if (!patient) return null;
          return { ...app, patient: { ...patient } };
        })
    );

    return enrichedAppointments.filter((app) => app !== null) as Appointment[];
  } catch (error) {
    handleFirestoreError(error, { path: 'appointments', operation: 'list' });
    return [];
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

// ========== Users (For Auth) ==========
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

export async function getUsers(): Promise<User[]> {
  return getCollection<User>('users');
}

export const getUserByUID = async (uid: string): Promise<User | null> => {
  try {
    return await getDocument<User>('users', uid);
  } catch (error) {
    console.error('Could not fetch user profile for UID:', uid, error);
    return null;
  }
};

// ========== Patients ==========
export const findPatientByCURP = async (
  curp: string
): Promise<Patient | null> => {
  const db = getDb();
  const q = query(
    collection(db, 'patients'),
    where('curp', '==', curp.toUpperCase())
  );
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
};

export const savePatient = async (patient: Patient): Promise<string> => {
  const db = getDb();
  const docRef = doc(db, 'patients', patient.id);
  try {
    await setDoc(docRef, patient, { merge: true });
    return patient.id;
  } catch(error) {
    handleFirestoreError(error, { path: docRef.path, operation: 'write', requestResourceData: patient });
    throw error; // Rethrow to be caught by the calling function
  }
};

// ========== Announcements ==========

export const getAnnouncements = async (): Promise<string[]> => {
  // Read from static JSON file
  return announcementsData.messages;
};

export const updateAnnouncements = async (
  newAnnouncements: string[]
): Promise<{ success: boolean; message?: string }> => {
  const data = { messages: newAnnouncements.slice(0, 4) };
  // Write to static file (for next server start)
  await writeJsonFile('announcements.json', data);

  // Write to Firestore for persistence
  const db = getDb();
  const docRef = doc(db, 'settings', 'announcements');
  try {
    await setDoc(docRef, data);
    return { success: true };
  } catch (error) {
    handleFirestoreError(error, {
      path: docRef.path,
      operation: 'write',
      requestResourceData: data,
    });
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// ========== Clinics Configuration ==========

export async function getClinics(): Promise<Clinic[]> {
  // Read from static JSON file
  return clinicsData as Clinic[];
}

export async function updateClinics(
  clinics: Clinic[]
): Promise<{ success: boolean; message?: string }> {
  // Write to static file (for next server start)
  await writeJsonFile('clinics.json', clinics);

  // Write to Firestore for persistence
  const db = getDb();
  const batch = writeBatch(db);
  const collectionRef = collection(db, 'clinics');

  try {
    const existingDocsSnapshot = await getDocs(collectionRef);
    const existingIds = new Set(existingDocsSnapshot.docs.map((d) => d.id));

    clinics.forEach((clinic) => {
      const { id, ...data } = clinic;
      const docRef = doc(collectionRef, id);
      batch.set(docRef, data);
      existingIds.delete(id);
    });

    existingIds.forEach((idToDelete) => {
      batch.delete(doc(collectionRef, idToDelete));
    });

    await batch.commit();
    return { success: true };
  } catch (error) {
    handleFirestoreError(error, {
      path: 'clinics',
      operation: 'write',
      requestResourceData: clinics,
    });
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ========== Colonias Configuration ==========

export async function getColonias(): Promise<Colonia[]> {
  // Read from static JSON file
  return coloniasData as Colonia[];
}

export async function updateColonias(
  colonias: Colonia[]
): Promise<{ success: boolean; message?: string }> {
    // Write to static file
    await writeJsonFile('colonias.json', colonias);

    // Write to Firestore
    const db = getDb();
    const batch = writeBatch(db);
    const collectionRef = collection(db, 'colonias');

    try {
        const existingDocsSnapshot = await getDocs(collectionRef);
        const existingIds = new Set(existingDocsSnapshot.docs.map(d => d.id));

        colonias.forEach(colonia => {
            const { id, ...data } = colonia;
            const docRef = doc(collectionRef, id);
            batch.set(docRef, data);
            existingIds.delete(id);
        });

        existingIds.forEach(idToDelete => {
            batch.delete(doc(collectionRef, idToDelete));
        });

        await batch.commit();
        return { success: true };
    } catch (error) {
        handleFirestoreError(error, {
            path: 'colonias',
            operation: 'write',
            requestResourceData: { info: 'Batch operation on colonias collection.', data: colonias }
        });
        return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
}

// ========== Reports Auth ==========
export async function verifyClinicPassword(
  clinicId: string,
  passwordAttempt: string
): Promise<{ isValid: boolean; error?: string }> {
  try {
    const clinics = await getClinics(); // Reads from JSON now
    const clinic = clinics.find((c) => c.id === clinicId);

    if (!clinic) {
      return { isValid: false, error: 'El núcleo básico seleccionado no existe.' };
    }

    if (clinic.password === passwordAttempt) {
      return { isValid: true };
    }
    return { isValid: false, error: 'La contraseña es incorrecta.' };
  } catch (error) {
    console.error('Error verifying clinic password', error);
    return {
      isValid: false,
      error: 'Ocurrió un error al verificar la contraseña.',
    };
  }
}