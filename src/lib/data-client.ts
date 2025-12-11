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
  writeBatch,
} from 'firebase/firestore';
import { initializeFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { Appointment, LabAppointment, XRayAppointment, UltrasoundAppointment, Patient } from './definitions';
import { v4 as uuidv4 } from 'uuid';

const getDb = () => {
  const { firestore } = initializeFirebase();
  return firestore;
};

// =====================================================================
// Generic Data Access Functions
// =====================================================================

export const getCollection = async <T>(collectionName: string): Promise<T[]> => {
    const db = getDb();
    const collectionRef = collection(db, collectionName);
    try {
        const snapshot = await getDocs(collectionRef);
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as T));
    } catch (error) {
        console.error(`Error getting collection ${collectionName}:`, error);
        throw error;
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
        console.error(`Error getting document ${docId} from ${collectionName}:`, error);
        throw error;
    }
}

const getPatientsFromAppointments = async <T extends { patientId: string }>(appointments: T[]): Promise<Record<string, Patient>> => {
    const db = getDb();
    const patientIds = [...new Set(appointments.map(app => app.patientId))];
    const patients: Record<string, Patient> = {};

    // Firestore 'in' query supports up to 30 items. We batch them.
    while (patientIds.length) {
        const batchIds = patientIds.splice(0, 30);
        if (batchIds.length > 0) {
            const q = query(collection(db, 'patients'), where('id', 'in', batchIds));
            const snapshot = await getDocs(q);
            snapshot.forEach(doc => {
                patients[doc.id] = { ...doc.data(), id: doc.id } as Patient;
            });
        }
    }
    return patients;
};

const enrichAppointmentsWithPatients = async <T extends { patientId: string }>(appointments: T[]): Promise<(T & { patient: Patient })[]> => {
    if (appointments.length === 0) return [];
    const patients = await getPatientsFromAppointments(appointments);
    return appointments.map(app => ({
        ...app,
        patient: patients[app.patientId]
    })).filter(app => app.patient); // Filter out appointments where patient data might be missing
};

// =====================================================================
// Appointments
// =====================================================================

export async function saveAppointment(
  appointmentData: Omit<Appointment, 'id' | 'patientId' | 'patient'>,
  patientData: Omit<Patient, 'id'>,
): Promise<Appointment> {
  const db = getDb();
  const batch = writeBatch(db);

  const patientId = uuidv4();
  const patientRef = doc(db, 'patients', patientId);
  const patientToSave: Patient = { id: patientId, ...patientData };
  batch.set(patientRef, patientToSave);

  const appointmentId = uuidv4();
  const appointmentRef = doc(db, 'appointments', appointmentId);
  const appointmentToSave = {
      ...appointmentData,
      id: appointmentId,
      patientId: patientId, // Reference the patient ID
      date: Timestamp.fromDate(new Date(appointmentData.date)),
  };
  batch.set(appointmentRef, appointmentToSave);

  await batch.commit().catch(serverError => {
      const permissionError = new FirestorePermissionError({
          path: `appointments/${appointmentId}`,
          operation: 'create',
          requestResourceData: appointmentToSave
      });
      errorEmitter.emit('permission-error', permissionError);
      throw permissionError; // Re-throw to be caught by the caller
  });

  return {
    ...appointmentData,
    id: appointmentId,
    patientId: patientId,
    patient: patientToSave,
  };
}


export async function deleteAppointment(id: string): Promise<void> {
  const db = getDb();
  const docRef = doc(db, 'appointments', id);
  await deleteDoc(docRef).catch(serverError => {
      const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
      });
      errorEmitter.emit('permission-error', permissionError);
      throw permissionError;
  });
}

export async function getAppointments(): Promise<(Appointment & { patient: Patient })[]> {
    const db = getDb();
    const collectionRef = collection(db, 'appointments');
    try {
        const snapshot = await getDocs(collectionRef);
        const appointments = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                date: (data.date as Timestamp).toDate().toISOString(),
            } as Appointment;
        });
        return await enrichAppointmentsWithPatients(appointments);
    } catch (error) {
        console.error("Error getting appointments:", error);
        throw error;
    }
}


export async function getAppointmentsForClinic(clinicId: string): Promise<(Appointment & { patient: Patient })[]> {
  const db = getDb();
  const q = query(
    collection(db, 'appointments'),
    where('clinicId', '==', clinicId)
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
    return await enrichAppointmentsWithPatients(appointments);
  } catch(error) {
     console.error("Error getting appointments for clinic:", error);
     throw error;
  }
}


export async function getAppointmentsByDate(date: Date): Promise<(Appointment & { patient: Patient })[]> {
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
    return await enrichAppointmentsWithPatients(appointments);
  } catch(error) {
     console.error("Error getting appointments by date:", error);
     throw error;
  }
}


// ========== Lab Appointments ==========

export async function saveLabAppointment(
  appointmentData: Omit<LabAppointment, 'id' | 'patientId' | 'patient'>,
  patientData: Omit<Patient, 'id'>,
): Promise<LabAppointment> {
  const db = getDb();
  const batch = writeBatch(db);

  const patientId = uuidv4();
  const patientRef = doc(db, 'patients', patientId);
  const patientToSave: Patient = { id: patientId, ...patientData };
  batch.set(patientRef, patientToSave);
  
  const id = uuidv4();
  const docRef = doc(db, 'lab-appointments', id);
  const appointmentToSave = {
    ...appointmentData,
    id,
    patientId: patientId, // Reference patient
    date: Timestamp.fromDate(new Date(appointmentData.date)),
  };

  batch.set(docRef, appointmentToSave)
  
  await batch.commit().catch(serverError => {
      const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'create',
          requestResourceData: appointmentToSave
      });
      errorEmitter.emit('permission-error', permissionError);
      throw permissionError;
  });

  return {
    ...appointmentData,
    id: id,
    patientId: patientId,
    patient: patientToSave,
  };
}


export async function deleteLabAppointment(id: string): Promise<void> {
  const db = getDb();
  const docRef = doc(db, 'lab-appointments', id);
  await deleteDoc(docRef).catch(serverError => {
      const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
      });
      errorEmitter.emit('permission-error', permissionError);
      throw permissionError;
  });
}

export async function getLabAppointments(): Promise<(LabAppointment & { patient: Patient })[]> {
    const db = getDb();
    const collectionRef = collection(db, 'lab-appointments');
    try {
        const snapshot = await getDocs(collectionRef);
        const appointments = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                date: (data.date as Timestamp).toDate().toISOString(),
            } as LabAppointment;
        });
        return await enrichAppointmentsWithPatients(appointments);
    } catch (error) {
        console.error("Error getting lab appointments:", error);
        throw error;
    }
}

export async function getLabAppointmentsByDate(date: Date): Promise<(LabAppointment & { patient: Patient })[]> {
  const db = getDb();
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const q = query(
    collection(db, 'lab-appointments'),
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
      } as LabAppointment;
    });
    return await enrichAppointmentsWithPatients(appointments);
  } catch(error) {
     console.error("Error getting lab appointments by date:", error);
     throw error;
  }
}

// ========== X-Ray Appointments ==========

export async function saveXRayAppointment(
  appointmentData: Omit<XRayAppointment, 'id' | 'patientId' | 'patient'>,
  patientData: Omit<Patient, 'id'>,
): Promise<XRayAppointment> {
  const db = getDb();
  const batch = writeBatch(db);

  const patientId = uuidv4();
  const patientRef = doc(db, 'patients', patientId);
  const patientToSave: Patient = { id: patientId, ...patientData };
  batch.set(patientRef, patientToSave);

  const id = uuidv4();
  const docRef = doc(db, 'x-ray-appointments', id);
  const dataToSave = {
    ...appointmentData,
    id,
    patientId: patientId,
    date: Timestamp.fromDate(new Date(appointmentData.date)),
  };

  batch.set(docRef, dataToSave);

  await batch.commit().catch(serverError => {
      const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'create',
          requestResourceData: dataToSave
      });
      errorEmitter.emit('permission-error', permissionError);
      throw permissionError;
  });
  return {
      ...appointmentData,
      id,
      patientId: patientId,
      patient: patientToSave,
  };
}


export async function deleteXRayAppointment(id: string): Promise<void> {
  const db = getDb();
  const docRef = doc(db, 'x-ray-appointments', id);
  await deleteDoc(docRef).catch(serverError => {
      const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
      });
      errorEmitter.emit('permission-error', permissionError);
      throw permissionError;
  });
}


export async function getXRayAppointments(): Promise<(XRayAppointment & { patient: Patient })[]> {
    const db = getDb();
    const collectionRef = collection(db, 'x-ray-appointments');
    try {
        const snapshot = await getDocs(collectionRef);
        const appointments = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                date: (data.date as Timestamp).toDate().toISOString(),
            } as XRayAppointment;
        });
        return await enrichAppointmentsWithPatients(appointments);
    } catch (error) {
        console.error("Error getting X-Ray appointments:", error);
        throw error;
    }
}

export async function getXRayAppointmentsByDate(date: Date): Promise<(XRayAppointment & { patient: Patient })[]> {
  const db = getDb();
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const q = query(
    collection(db, 'x-ray-appointments'),
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
      } as XRayAppointment;
    });
    return await enrichAppointmentsWithPatients(appointments);
  } catch(error) {
     console.error("Error getting X-Ray appointments by date:", error);
     throw error;
  }
}

// ========== Ultrasound Appointments ==========

export async function saveUltrasoundAppointment(
  appointmentData: Omit<UltrasoundAppointment, 'id' | 'patientId' | 'patient'>,
  patientData: Omit<Patient, 'id'>,
): Promise<UltrasoundAppointment> {
  const db = getDb();
  const batch = writeBatch(db);

  const patientId = uuidv4();
  const patientRef = doc(db, 'patients', patientId);
  const patientToSave: Patient = { id: patientId, ...patientData };
  batch.set(patientRef, patientToSave);

  const id = uuidv4();
  const docRef = doc(db, 'ultrasound-appointments', id);
  const dataToSave = {
    ...appointmentData,
    id,
    patientId: patientId,
    date: Timestamp.fromDate(new Date(appointmentData.date)),
  };

  batch.set(docRef, dataToSave);

  await batch.commit().catch(serverError => {
      const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'create',
          requestResourceData: dataToSave
      });
      errorEmitter.emit('permission-error', permissionError);
      throw permissionError;
  });
  return {
    ...appointmentData,
    id,
    patientId: patientId,
    patient: patientToSave,
  };
}

export async function deleteUltrasoundAppointment(id: string): Promise<void> {
  const db = getDb();
  const docRef = doc(db, 'ultrasound-appointments', id);
  await deleteDoc(docRef).catch(serverError => {
      const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
      });
      errorEmitter.emit('permission-error', permissionError);
      throw permissionError;
  });
}

export async function getUltrasoundAppointments(): Promise<(UltrasoundAppointment & { patient: Patient })[]> {
    const db = getDb();
    const collectionRef = collection(db, 'ultrasound-appointments');
    try {
        const snapshot = await getDocs(collectionRef);
        const appointments = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                date: (data.date as Timestamp).toDate().toISOString(),
            } as UltrasoundAppointment;
        });
        return await enrichAppointmentsWithPatients(appointments);
    } catch (error) {
        console.error("Error getting Ultrasound appointments:", error);
        throw error;
    }
}

export async function getUltrasoundAppointmentsByDate(date: Date): Promise<(UltrasoundAppointment & { patient: Patient })[]> {
  const db = getDb();
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const q = query(
    collection(db, 'ultrasound-appointments'),
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
      } as UltrasoundAppointment;
    });
    return await enrichAppointmentsWithPatients(appointments);
  } catch(error) {
     console.error("Error getting Ultrasound appointments by date:", error);
     throw error;
  }
}
