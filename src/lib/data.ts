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
  WriteBatch,
  updateDoc,
} from 'firebase/firestore';
import {
  getAuth as getAdminAuth,
  UserRecord,
  ListUsersResult,
} from 'firebase-admin/auth';
import { initializeAdminApp } from '@/firebase/admin-config';
import { initializeFirebase } from '@/firebase';
import type { Appointment, Clinic, Colonia, User, Patient } from './definitions';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { unstable_cache as cache } from 'next/cache';

const getDb = () => {
  const { firestore } = initializeFirebase();
  return firestore;
};

const getAdminSdk = () => {
  const adminApp = initializeAdminApp();
  return {
    auth: getAdminAuth(adminApp),
  }
}

const handleFirestoreError = (error: any, context: { path: string, operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write', requestResourceData?: any }) => {
    console.error(`Firestore Error [${context.operation}] at '${context.path}':`, error);
    const permissionError = new FirestorePermissionError({
        path: context.path,
        operation: context.operation,
        requestResourceData: context.requestResourceData,
    });
    errorEmitter.emit('permission-error', permissionError);
    // Re-throwing is important for server-side operations to fail explicitly.
    throw permissionError;
}

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

const setDocument = async (collectionName: string, id: string, data: any): Promise<boolean> => {
    const db = getDb();
    const docRef = doc(db, collectionName, id);
    try {
        await setDoc(docRef, data, { merge: true });
        return true;
    } catch(error) {
        handleFirestoreError(error, { path: docRef.path, operation: 'write', requestResourceData: data });
        return false;
    }
}

// ========== Appointments ==========

export async function saveAppointment(appointment: Appointment): Promise<Appointment | null> {
  const db = getDb();
  const docRef = doc(db, 'appointments', appointment.id);
  
  // Don't save the full patient object in the appointment document, only the ID.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { patient, ...appointmentData } = appointment;

  const dataToSave = {
    ...appointmentData,
    date: Timestamp.fromDate(new Date(appointment.date)),
  };

  try {
    await setDoc(docRef, dataToSave);
    return appointment; // Return the full object with patient data for immediate use
  } catch(error) {
    handleFirestoreError(error, { path: docRef.path, operation: 'create', requestResourceData: dataToSave });
    return null;
  }
}

export const getAppointments = cache(async (): Promise<Appointment[]> => {
    const appointments = await getCollection<any>('appointments');
    
    const enrichedAppointmentsPromises = appointments
        .filter(app => !!app.patientId) // Ensure patientId exists
        .map(async (app) => {
            try {
                const patient = await getDocument<Patient>('patients', app.patientId);
                if (!patient) return null; // Skip if patient not found

                return {
                    ...app,
                    date: (app.date as Timestamp).toDate().toISOString(),
                    patient: { ...patient },
                };
            } catch (error) {
                console.error(`Failed to enrich appointment ${app.id} for patient ${app.patientId}:`, error);
                return null; // Skip this appointment on error
            }
        });

    const settledAppointments = await Promise.all(enrichedAppointmentsPromises);
    
    return settledAppointments
        .filter((app): app is Appointment => app !== null) // Filter out nulls
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}, ['appointments'], { revalidate: 10 });


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

    // Enrich with patient data
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

export async function deleteAppointment(id: string): Promise<void> {
  const db = getDb();
  const docRef = doc(db, 'appointments', id);
  try {
    await deleteDoc(docRef)
  } catch (error) {
    handleFirestoreError(error, { path: docRef.path, operation: 'delete' });
  }
}

export async function updateAppointmentStatus(appointmentId: string, status: 'Atendida' | 'Cancelada'): Promise<boolean> {
    const db = getDb();
    const docRef = doc(db, 'appointments', appointmentId);
    try {
        await updateDoc(docRef, { status });
        return true;
    } catch(error) {
        handleFirestoreError(error, { path: docRef.path, operation: 'update', requestResourceData: { status }});
        return false;
    }
}

// ========== Users (For Auth) ==========
export const getUsers = cache(async (): Promise<User[]> => {
    return getCollection<User>('users');
}, ['users'], { revalidate: 10 });


export const getUserByUID = async (uid: string): Promise<User | null> => {
    try {
        return await getDocument<User>('users', uid);
    } catch (error) {
        // This is a special case. If fetching the user profile fails, we don't want to
        // throw a permission error that locks the UI. We just return null.
        // A user not having a profile is a possible state.
        console.error("Could not fetch user profile for UID:", uid, error);
        return null;
    }
};

export async function updateUsers(users: (User & { password?: string })[]) {
    const adminAuth = getAdminSdk().auth;
    const db = getDb();
    const batch = writeBatch(db);

    try {
        for (const userData of users) {
            const { id, email, name, role, clinicId, password } = userData;
            let uid = id;

            // Is it a new user? (check for temporary ID format)
            if (id.startsWith('new-')) {
                let userRecord: UserRecord;
                try {
                    userRecord = await adminAuth.createUser({ email, password, displayName: name });
                    uid = userRecord.uid;
                } catch (error: any) {
                    if (error.code === 'auth/email-already-exists') {
                        userRecord = await adminAuth.getUserByEmail(email);
                        uid = userRecord.uid;
                    } else {
                        throw error;
                    }
                }
            } else if (password) {
                // If password is provided for an existing user, update it.
                await adminAuth.updateUser(uid, { password });
            }

            // Prepare Firestore document
            const userDocRef = doc(db, 'users', uid);
            const userDocData: User = { id: uid, email, name, role };
            if (role === 'doctor' && clinicId) {
                userDocData.clinicId = clinicId;
            }
            batch.set(userDocRef, userDocData);
        }

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        console.error("Error updating users:", error);
        return { success: false, message: error.message };
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
    await setDocument('patients', patient.id, patient);
    return patient.id;
}


// ========== Announcements ==========

export const getAnnouncements = async (): Promise<string[]> => {
  try {
      const settings = await getDocument<{ messages?: string[] }>('settings', 'announcements');
      return settings?.messages || ['Recuerda traer tu cartilla de vacunación.', 'El uso de cubrebocas es opcional en las instalaciones.'];
  } catch (error) {
      console.error("Failed to get announcements, returning default. Error:", error);
      return ['Recuerda traer tu cartilla de vacunación.', 'El uso de cubrebocas es opcional en las instalaciones.'];
  }
}

export const updateAnnouncements = async (newAnnouncements: string[]): Promise<boolean> => {
  return setDocument('settings', 'announcements', { messages: newAnnouncements.slice(0, 4) });
}

// ========== Clinics Configuration ==========

export const getClinics = cache(async(): Promise<Clinic[]> => {
    try {
        const clinics = await getCollection<Clinic>('clinics');
        if (clinics.length === 0) {
            return [{
                id: 'NB1',
                name: 'Núcleo Básico 1',
                doctorName: 'Dr. Ejemplo',
                password: '123',
                dailySlots: 15,
                startTime: '08:00',
                endTime: '13:00',
                weekendBookingEnabled: false,
            }];
        }
        return clinics.sort((a,b) => a.name.localeCompare(b.name));
    } catch (error) {
        console.error("Failed to get clinics, returning default. Error:", error);
         return [{
            id: 'NB1',
            name: 'Núcleo Básico 1',
            doctorName: 'Dr. Ejemplo',
            password: '123',
            dailySlots: 15,
            startTime: '08:00',
            endTime: '13:00',
            weekendBookingEnabled: false,
        }];
    }
}, ['clinics'], { revalidate: 10 });


export async function updateClinics(clinics: Clinic[]): Promise<boolean> {
    const db = getDb();
    const batch = writeBatch(db);
    const collectionRef = collection(db, 'clinics');
    
    try {
      const existingDocsSnapshot = await getDocs(collectionRef);
      const existingIds = new Set(existingDocsSnapshot.docs.map(d => d.id));

      clinics.forEach(clinic => {
          const { id, ...data } = clinic;
          const docRef = doc(collectionRef, id);
          batch.set(docRef, data);
          existingIds.delete(id);
      });

      existingIds.forEach(idToDelete => {
          batch.delete(doc(collectionRef, idToDelete));
      });

      await batch.commit();
      return true;
    } catch(error) {
        handleFirestoreError(error, { path: collectionRef.path, operation: 'write', requestResourceData: clinics});
        return false;
    }
}


// ========== Colonias Configuration ==========

export const getColonias = cache(async (): Promise<Colonia[]> => {
  try {
      const colonias = await getCollection<Colonia>('colonias');
      if (colonias.length === 0) {
          return [
            { id: 'centro-id', name: 'Centro', clinicId: 'NB1' },
            { id: 'pueblo-nuevo-id', name: 'Pueblo Nuevo', clinicId: 'NB1' },
          ];
      }
      return colonias.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
      console.error("Failed to get colonias, returning defaults. Error:", error);
      return [
        { id: 'centro-id', name: 'Centro', clinicId: 'NB1' },
        { id: 'pueblo-nuevo-id', name: 'Pueblo Nuevo', clinicId: 'NB1' },
      ];
  }
}, ['colonias'], { revalidate: 10 });

export async function updateColonias(colonias: Colonia[]): Promise<boolean> {
    const db = getDb();
    const batch = writeBatch(db);
    const collectionRef = collection(db, 'colonias');

    try {
        // Get all existing documents to determine which ones to delete.
        const existingDocsSnapshot = await getDocs(collectionRef);
        const existingIds = new Set(existingDocsSnapshot.docs.map(d => d.id));

        // Set (create or overwrite) the documents from the input array.
        colonias.forEach(colonia => {
            const { id, ...data } = colonia;
            const docRef = doc(collectionRef, id);
            batch.set(docRef, data);
            existingIds.delete(id); // Remove from the set of IDs to delete.
        });

        // Delete any documents that were not in the input array.
        existingIds.forEach(idToDelete => {
            batch.delete(doc(collectionRef, idToDelete));
        });

        await batch.commit();
        return true;
    } catch (error) {
        handleFirestoreError(error, {
            path: 'colonias',
            operation: 'write',
            requestResourceData: { info: 'Batch operation on colonias collection.', data: colonias }
        });
        return false;
    }
}

// ========== Reports Auth ==========
export async function verifyClinicPassword(clinicId: string, passwordAttempt: string): Promise<boolean> {
    try {
        const clinic = await getDocument<Clinic>('clinics', clinicId);
        if (clinic && clinic.password === passwordAttempt) {
            return true;
        }
        return false;
    } catch(error) {
        console.error("Error verifying clinic password", error);
        return false;
    }
}
