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
import type { Appointment } from './definitions';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const getDb = () => {
  const { firestore } = initializeFirebase();
  return firestore;
};

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
    console.error("Error saving appointment:", error);
    throw error;
  }
}

export async function deleteAppointment(id: string): Promise<void> {
  const db = getDb();
  const docRef = doc(db, 'appointments', id);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting appointment:", error);
    throw error;
  }
}

export async function getAppointments(): Promise<Appointment[]> {
    const db = getDb();
    const collectionRef = collection(db, 'appointments');
    try {
        const snapshot = await getDocs(collectionRef);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                date: (data.date as Timestamp).toDate().toISOString(), // Always convert Timestamp to ISO string for client
                patient: data.patient,
            } as Appointment;
        });
    } catch (error) {
        console.error("Error getting appointments:", error);
        throw error;
    }
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
          date: (data.date as Timestamp).toDate().toISOString(),
          patient: data.patient
      } as Appointment;
    });
  } catch(error) {
     console.error("Error getting appointments for clinic:", error);
     throw error;
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
          date: (data.date as Timestamp).toDate().toISOString(),
          patient: data.patient
      } as Appointment;
    });
    return appointments;
  } catch(error) {
     console.error("Error getting appointments by date:", error);
     throw error;
  }
}

export function updateAppointmentStatus(
  appointmentId: string,
  status: 'Atendida' | 'Cancelada'
): void {
  const db = getDb();
  const docRef = doc(db, 'appointments', appointmentId);

  // Perform the update. If it fails, log the actual error to the console.
  updateDoc(docRef, { status }).catch(err => {
    console.error(`Failed to update status for appointment ${appointmentId}:`, err);
  });
}
