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
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import type { Appointment, LabAppointment, XRayAppointment, UltrasoundAppointment } from './definitions';
import { v4 as uuidv4 } from 'uuid';

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
                date: (data.date as Timestamp).toDate().toISOString(),
                patient: data.patient || null,
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


// ========== Lab Appointments ==========

export async function saveLabAppointment(
  appointment: Omit<LabAppointment, 'id'>
): Promise<LabAppointment | null> {
  const db = getDb();
  const collectionRef = collection(db, 'lab-appointments');
  const id = uuidv4();
  const dataToSave = {
    ...appointment,
    id,
    date: Timestamp.fromDate(new Date(appointment.date)),
  };

  try {
    await setDoc(doc(collectionRef, id), dataToSave);
    return dataToSave;
  } catch (error) {
    console.error("Error saving lab appointment:", error);
    throw error;
  }
}

export async function deleteLabAppointment(id: string): Promise<void> {
  const db = getDb();
  const docRef = doc(db, 'lab-appointments', id);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting lab appointment:", error);
    throw error;
  }
}

export async function getLabAppointments(): Promise<LabAppointment[]> {
    const db = getDb();
    const collectionRef = collection(db, 'lab-appointments');
    try {
        const snapshot = await getDocs(collectionRef);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                date: (data.date as Timestamp).toDate().toISOString(),
                patient: data.patient || null,
            } as LabAppointment;
        });
    } catch (error) {
        console.error("Error getting lab appointments:", error);
        throw error;
    }
}

export async function getLabAppointmentsByDate(date: Date): Promise<LabAppointment[]> {
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
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
          ...data,
          id: doc.id,
          date: (data.date as Timestamp).toDate().toISOString(),
          patient: data.patient
      } as LabAppointment;
    });
  } catch(error) {
     console.error("Error getting lab appointments by date:", error);
     throw error;
  }
}

// ========== X-Ray Appointments ==========

export async function saveXRayAppointment(
  appointment: Omit<XRayAppointment, 'id'>
): Promise<XRayAppointment | null> {
  const db = getDb();
  const collectionRef = collection(db, 'x-ray-appointments');
  const id = uuidv4();
  const dataToSave = {
    ...appointment,
    id,
    date: Timestamp.fromDate(new Date(appointment.date)),
  };

  try {
    await setDoc(doc(collectionRef, id), dataToSave);
    return dataToSave;
  } catch (error) {
    console.error("Error saving X-Ray appointment:", error);
    throw error;
  }
}

export async function deleteXRayAppointment(id: string): Promise<void> {
  const db = getDb();
  const docRef = doc(db, 'x-ray-appointments', id);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting X-Ray appointment:", error);
    throw error;
  }
}

export async function getXRayAppointments(): Promise<XRayAppointment[]> {
    const db = getDb();
    const collectionRef = collection(db, 'x-ray-appointments');
    try {
        const snapshot = await getDocs(collectionRef);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                date: (data.date as Timestamp).toDate().toISOString(),
                patient: data.patient || null,
            } as XRayAppointment;
        });
    } catch (error) {
        console.error("Error getting X-Ray appointments:", error);
        throw error;
    }
}

export async function getXRayAppointmentsByDate(date: Date): Promise<XRayAppointment[]> {
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
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
          ...data,
          id: doc.id,
          date: (data.date as Timestamp).toDate().toISOString(),
          patient: data.patient
      } as XRayAppointment;
    });
  } catch(error) {
     console.error("Error getting X-Ray appointments by date:", error);
     throw error;
  }
}

// ========== Ultrasound Appointments ==========

export async function saveUltrasoundAppointment(
  appointment: Omit<UltrasoundAppointment, 'id'>
): Promise<UltrasoundAppointment | null> {
  const db = getDb();
  const collectionRef = collection(db, 'ultrasound-appointments');
  const id = uuidv4();
  const dataToSave = {
    ...appointment,
    id,
    date: Timestamp.fromDate(new Date(appointment.date)),
  };

  try {
    await setDoc(doc(collectionRef, id), dataToSave);
    return dataToSave;
  } catch (error) {
    console.error("Error saving Ultrasound appointment:", error);
    throw error;
  }
}

export async function deleteUltrasoundAppointment(id: string): Promise<void> {
  const db = getDb();
  const docRef = doc(db, 'ultrasound-appointments', id);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting Ultrasound appointment:", error);
    throw error;
  }
}

export async function getUltrasoundAppointments(): Promise<UltrasoundAppointment[]> {
    const db = getDb();
    const collectionRef = collection(db, 'ultrasound-appointments');
    try {
        const snapshot = await getDocs(collectionRef);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                date: (data.date as Timestamp).toDate().toISOString(),
                patient: data.patient || null,
            } as UltrasoundAppointment;
        });
    } catch (error) {
        console.error("Error getting Ultrasound appointments:", error);
        throw error;
    }
}

export async function getUltrasoundAppointmentsByDate(date: Date): Promise<UltrasoundAppointment[]> {
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
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
          ...data,
          id: doc.id,
          date: (data.date as Timestamp).toDate().toISOString(),
          patient: data.patient
      } as UltrasoundAppointment;
    });
  } catch(error) {
     console.error("Error getting Ultrasound appointments by date:", error);
     throw error;
  }
}
