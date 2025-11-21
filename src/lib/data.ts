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
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { initializeFirebase } from '@/firebase';
import type { Appointment } from './definitions';

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

  await setDoc(docRef, dataToSave);
  return appointment.id;
}

export async function getAppointments(): Promise<Appointment[]> {
  const db = await getDb();
  const appointmentCollection = collection(db, 'appointments');
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
}

export async function getAppointmentById(id: string): Promise<Appointment | null> {
    const db = await getDb();
    const docRef = doc(db, 'appointments', id);
    const docSnap = await getDoc(docRef);

    if(docSnap.exists()) {
        const data = docSnap.data();
        const date = (data.date as Timestamp).toDate().toISOString();
        return { ...data, id: docSnap.id, date } as Appointment;
    }
    return null;
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

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    const date = (data.date as Timestamp).toDate().toISOString();
    return { ...data, id: doc.id, date } as Appointment;
  });
}

export async function deleteAppointment(id: string): Promise<void> {
  const db = await getDb();
  await deleteDoc(doc(db, 'appointments', id));
}

// ========== Announcements ==========

export async function getAnnouncements(): Promise<string[]> {
  const db = await getDb();
  const docRef = doc(db, 'settings', 'announcements');
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    // Make sure to handle the case where messages might be undefined
    return docSnap.data().messages || [];
  }
  return [
    'Recuerda traer tu cartilla de vacunación.',
    'El uso de cubrebocas es opcional en las instalaciones.',
  ]; // Default if not set
}

export async function updateAnnouncements(
  newAnnouncements: string[]
): Promise<boolean> {
  try {
    const db = await getDb();
    await setDoc(doc(db, 'settings', 'announcements'), {
      messages: newAnnouncements.slice(0, 4),
    });
    return true;
  } catch (error) {
    console.error('Error updating announcements: ', error);
    return false;
  }
}

// ========== Slots Configuration ==========

export async function getSlotsConfiguration(): Promise<{ [key: string]: number }> {
  const db = await getDb();
  const docRef = doc(db, 'settings', 'slots');
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
    '1': 15,
    '2': 15,
    '3': 15,
    '4': 15,
    '5': 15,
    '6': 15,
  };
}

export async function updateSlotsConfiguration(newConfig: {
  [key: string]: number;
}): Promise<boolean> {
  try {
    const db = await getDb();
    await setDoc(doc(db, 'settings', 'slots'), { config: newConfig });
    return true;
  } catch (error) {
    console.error('Error updating slots config: ', error);
    return false;
  }
}