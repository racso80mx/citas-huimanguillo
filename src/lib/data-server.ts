'use server';

import { getAdminApp } from '@/firebase/server-config';
import {
  getFirestore,
  collection,
  getDocs,
  Timestamp,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';
import type {
  Appointment,
  LabAppointment,
  XRayAppointment,
  UltrasoundAppointment,
  Patient,
} from './definitions';

// Initialize admin app and Firestore instance
let db: Firestore;
try {
  const adminApp = getAdminApp();
  db = getFirestore(adminApp);
} catch (e) {
    console.error("Failed to initialize admin Firestore instance", e);
    throw new Error("Failed to initialize admin Firestore instance. Check server configuration.");
}


const getPatientsFromAppointments = async <T extends { patientId: string }>(
  appointments: T[]
): Promise<Record<string, Patient>> => {
  if (appointments.length === 0) return {};
  const patientIds = [...new Set(appointments.map((app) => app.patientId).filter((id) => id))];
  if (patientIds.length === 0) return {};
  const patients: Record<string, Patient> = {};

  // Firestore 'in' query supports up to 30 items. We batch them.
  for (let i = 0; i < patientIds.length; i += 30) {
    const batchIds = patientIds.slice(i, i + 30);
    if (batchIds.length > 0) {
      const q = query(collection(db, 'patients'), where('id', 'in', batchIds));
      const snapshot = await getDocs(q);
      snapshot.forEach((doc) => {
        patients[doc.id] = { ...doc.data(), id: doc.id } as Patient;
      });
    }
  }
  return patients;
};

const enrichAppointmentsWithPatients = async <T extends { patientId: string }>(
  appointments: T[]
): Promise<(T & { patient: Patient })[]> => {
  if (appointments.length === 0) return [];
  const patients = await getPatientsFromAppointments(appointments);
  return appointments
    .map((app) => ({
      ...app,
      patient: patients[app.patientId],
    }))
    .filter((app) => app.patient); // Filter out appointments where patient data might be missing
};


async function getAllAppointmentsFromServer(): Promise<(Appointment & { patient: Patient; })[]> {
  const collectionRef = collection(db, 'appointments');
  try {
    const snapshot = await getDocs(collectionRef);
    const appointments = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        date: (data.date as Timestamp).toDate().toISOString(),
      } as Appointment;
    });
    return await enrichAppointmentsWithPatients(appointments);
  } catch (error) {
    console.error('Error getting appointments from server:', error);
    throw new Error('Could not fetch appointments from server.');
  }
}

async function getAllLabAppointmentsFromServer(): Promise<(LabAppointment & { patient: Patient; })[]> {
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
        console.error("Error getting lab appointments from server:", error);
        throw new Error('Could not fetch lab appointments from server.');
    }
}

async function getAllXRayAppointmentsFromServer(): Promise<(XRayAppointment & { patient: Patient; })[]> {
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
        console.error("Error getting x-ray appointments from server:", error);
        throw new Error('Could not fetch x-ray appointments from server.');
    }
}

async function getAllUltrasoundAppointmentsFromServer(): Promise<(UltrasoundAppointment & { patient: Patient; })[]> {
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
        console.error("Error getting ultrasound appointments from server:", error);
        throw new Error('Could not fetch ultrasound appointments from server.');
    }
}


export async function getAppointmentsByDate(date: Date) {
    const allAppointments = await getAllAppointmentsFromServer();
    const dateString = date.toISOString().split('T')[0];
    return allAppointments.filter(app => app.date.startsWith(dateString));
}

export async function getLabAppointmentsByDate(date: Date) {
    const allAppointments = await getAllLabAppointmentsFromServer();
    const dateString = date.toISOString().split('T')[0];
    return allAppointments.filter(app => app.date.startsWith(dateString));
}

export async function getXRayAppointmentsByDate(date: Date) {
    const allAppointments = await getAllXRayAppointmentsFromServer();
    const dateString = date.toISOString().split('T')[0];
    return allAppointments.filter(app => app.date.startsWith(dateString));
}

export async function getUltrasoundAppointmentsByDate(date: Date) {
    const allAppointments = await getAllUltrasoundAppointmentsFromServer();
    const dateString = date.toISOString().split('T')[0];
    return allAppointments.filter(app => app.date.startsWith(dateString));
}