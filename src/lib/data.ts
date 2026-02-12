
'use server';

import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  runTransaction, 
  writeBatch, 
  Timestamp, 
  orderBy, 
  limit,
  DocumentReference
} from 'firebase/firestore';
import { adminDb } from '@/firebase/server-config';
import { startOfMonth, isSaturday, isSunday } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

import type {
  Clinic,
  Colonia,
  Appointment,
  Patient,
  LabAppointment,
  LabStudy,
  LabSettings,
  XRayAppointment,
  XRayStudy,
  XRaySettings,
  UltrasoundAppointment,
  UltrasoundStudy,
  UltrasoundSettings,
  VaccineAppointment,
  Vaccine,
  VaccineSettings,
  User,
  ActivityLog,
  AppointmentStatus,
  ModuleSettings,
  PatientType,
} from './definitions';

// =====================================================================
// HELPERS
// =====================================================================

async function getSettingsDoc<T>(docId: string, defaultVal: T): Promise<T> {
  if (!adminDb) throw new Error("Database not initialized.");
  const docRef = doc(adminDb, 'settings', docId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as T;
  }
  return defaultVal;
}

async function setSettingsDoc(docId: string, data: any) {
  if (!adminDb) throw new Error("Database not initialized.");
  const docRef = doc(adminDb, 'settings', docId);
  await setDoc(docRef, data, { merge: true });
  return { success: true };
}

async function getCatalog<T>(collectionName: string): Promise<T[]> {
  if (!adminDb) throw new Error("Database not initialized.");
  const collRef = collection(adminDb, collectionName);
  const snapshot = await getDocs(query(collRef));
  if (snapshot.empty) return [];
  return snapshot.docs.map(d => ({ ...(d.data() as T), id: d.id }));
}

async function updateCatalog<T extends { id?: string }>(collectionName: string, items: T[]) {
  if (!adminDb) throw new Error("Database not initialized.");
  const batch = writeBatch(adminDb);
  const collRef = collection(adminDb, collectionName);

  const snapshot = await getDocs(collRef);
  const existingIds = new Set(snapshot.docs.map(d => d.id));
  const incomingIds = new Set();

  items.forEach(item => {
    let docId = item.id;
    if (!docId || docId.startsWith('new-')) {
        docId = uuidv4();
    }
    incomingIds.add(docId);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...data } = item;
    const docRef = doc(collRef, docId);
    batch.set(docRef, data);
  });

  for (const id of existingIds) {
    if (!incomingIds.has(id)) {
      batch.delete(doc(collRef, id));
    }
  }

  await batch.commit();
  return { success: true };
}

async function enrichAppointmentsWithPatientData(appointments: any[]): Promise<any[]> {
    if (!adminDb) throw new Error("Database not initialized.");
    const patientIds = [...new Set(appointments.map(app => app.patientId).filter(Boolean))];
    if (patientIds.length === 0) {
        return appointments.map(app => ({
            ...app,
            date: app.date instanceof Timestamp ? app.date.toDate().toISOString() : app.date
        }));
    }

    const patients: Record<string, Patient> = {};
    
    // Firestore 'in' query is limited to 30 items. We batch the requests.
    for (let i = 0; i < patientIds.length; i += 30) {
        const batchIds = patientIds.slice(i, i + 30);
        if (batchIds.length > 0) {
            const q = query(collection(adminDb, 'patients'), where('__name__', 'in', batchIds));
            const patientSnapshot = await getDocs(q);
            patientSnapshot.forEach(doc => {
                patients[doc.id] = { id: doc.id, ...doc.data() } as Patient;
            });
        }
    }

    return appointments.map(app => ({
        ...app,
        patient: patients[app.patientId] || null,
        date: app.date instanceof Timestamp ? app.date.toDate().toISOString() : app.date,
    }));
}

async function findOrCreatePatient(patientData: Omit<Patient, 'id'>): Promise<DocumentReference> {
    if (!adminDb) throw new Error("Database not initialized during patient lookup.");
    const patientsCollRef = collection(adminDb, 'patients');

    if (patientData.curp && !patientData.curp.startsWith('RN-')) {
        const qPatient = query(patientsCollRef, where('curp', '==', patientData.curp.toUpperCase()), limit(1));
        const patientSnap = await getDocs(qPatient);
        if (!patientSnap.empty) {
            const patientRef = patientSnap.docs[0].ref;
            await updateDoc(patientRef, patientData); 
            return patientRef;
        }
    }
    
    // If not found, or if it's a newborn
    const newPatientRef = doc(patientsCollRef); // Auto-generate ID
    await setDoc(newPatientRef, patientData);
    return newPatientRef;
}

// =====================================================================
// LOGS
// =====================================================================

export async function getLogs(): Promise<ActivityLog[]> {
    if (!adminDb) throw new Error("Database not initialized.");
    const q = query(collection(adminDb, 'activityLog'), orderBy('timestamp', 'desc'), limit(500));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: (doc.data().timestamp as Timestamp).toDate().toISOString()
    })) as ActivityLog[];
}

export async function logActivity(action: string, details: string) {
    if (!adminDb) {
        console.error("Database not initialized, cannot log activity.");
        return;
    }
    try {
        await addDoc(collection(adminDb, 'activityLog'), {
            action,
            details,
            timestamp: Timestamp.now(),
        });
    } catch (error) {
        console.error("Failed to log activity:", error);
    }
}

// =====================================================================
// SETTINGS
// =====================================================================
export async function getAnnouncements(): Promise<string[]> { const data = await getSettingsDoc<{ messages: string[] }>('announcements', { messages: [] }); return data.messages; }
export async function updateAnnouncements(newAnnouncements: string[]) { return setSettingsDoc('announcements', { messages: newAnnouncements.slice(0, 4) }); }

export async function getModuleSettings(): Promise<ModuleSettings> {
    const defaults = { citasMedicasEnabled: true, laboratorioEnabled: true, rayosXEnabled: true, ultrasoundEnabled: true, vacunasEnabled: true };
    const settings = await getSettingsDoc<ModuleSettings>('moduleSettings', defaults);
    return { ...defaults, ...settings };
}
export async function updateModuleSettings(settings: ModuleSettings) { return setSettingsDoc('moduleSettings', settings); }

export async function getLabSettings(): Promise<LabSettings> { return getSettingsDoc<LabSettings>('labSettings', { dailySlots: 10, weekendBookingEnabled: false, password: '' }); }
export async function updateLabSettings(settings: LabSettings) { return setSettingsDoc('labSettings', settings); }

export async function getXRaySettings(): Promise<XRaySettings> { return getSettingsDoc<XRaySettings>('xraySettings', { dailySlots: 10, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false, password: '' }); }
export async function updateXRaySettings(settings: XRaySettings) { return setSettingsDoc('xraySettings', settings); }

export async function getUltrasoundSettings(): Promise<UltrasoundSettings> { return getSettingsDoc<UltrasoundSettings>('ultrasoundSettings', { dailySlots: 10, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false, password: '' }); }
export async function updateUltrasoundSettings(settings: UltrasoundSettings) { return setSettingsDoc('ultrasoundSettings', settings); }

export async function getVaccineSettings(): Promise<VaccineSettings> { return getSettingsDoc<VaccineSettings>('vaccineSettings', { dailySlots: 20, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false, password: '' }); }
export async function updateVaccineSettings(settings: VaccineSettings) { return setSettingsDoc('vaccineSettings', settings); }

// =====================================================================
// CATALOGS
// =====================================================================
export async function getClinics(): Promise<Clinic[]> { return getCatalog<Clinic>('clinics'); }
export async function updateClinics(clinics: Clinic[]) { return updateCatalog<Clinic>('clinics', clinics); }

export async function getColonias(): Promise<Colonia[]> { return getCatalog<Colonia>('colonias'); }
export async function updateColonias(colonias: Colonia[]) { return updateCatalog<Colonia>('colonias', colonias); }

export async function getUsers(): Promise<User[]> { return getCatalog<User>('users'); }
export async function updateUsers(users: User[]) { return updateCatalog<User>('users', users); }

export async function getLabStudies(): Promise<LabStudy[]> { return getCatalog<LabStudy>('labStudies'); }
export async function updateLabStudies(studies: LabStudy[]) { return updateCatalog<LabStudy>('labStudies', studies); }

export async function getXRayStudies(): Promise<XRayStudy[]> { return getCatalog<XRayStudy>('xrayStudies'); }
export async function updateXRayStudies(studies: XRayStudy[]) { return updateCatalog<XRayStudy>('xrayStudies', studies); }

export async function getUltrasoundStudies(): Promise<UltrasoundStudy[]> { return getCatalog<UltrasoundStudy>('ultrasoundStudies'); }
export async function updateUltrasoundStudies(studies: UltrasoundStudy[]) { return updateCatalog<UltrasoundStudy>('ultrasoundStudies', studies); }

export async function getVaccines(): Promise<Vaccine[]> { return getCatalog<Vaccine>('vaccines'); }
export async function updateVaccines(vaccines: Vaccine[]) { return updateCatalog<Vaccine>('vaccines', vaccines); }

export async function getClinicById(id: string): Promise<Clinic | null> {
    if (!adminDb) return null;
    const docRef = doc(adminDb, 'clinics', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Clinic;
    }
    return null;
}

// =====================================================================
// CORE DATA LOGIC
// =====================================================================

export async function getPatientByCURP(curp: string): Promise<Patient | null> {
  if (!adminDb) throw new Error("Database not initialized.");
  const q = query(collection(adminDb, 'patients'), where('curp', '==', curp.toUpperCase()), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docData = snapshot.docs[0];
  return { ...docData.data(), id: docData.id } as Patient;
}

export async function getAppointments(): Promise<Appointment[]> { if (!adminDb) return []; const snapshot = await getDocs(query(collection(adminDb, 'appointments'), orderBy('date', 'desc'))); return enrichAppointmentsWithPatientData(snapshot.docs.map(d => ({id: d.id, ...d.data()}))); }
export async function getLabAppointments(): Promise<LabAppointment[]> { if (!adminDb) return []; const snapshot = await getDocs(query(collection(adminDb, 'labAppointments'), orderBy('date', 'desc'))); return enrichAppointmentsWithPatientData(snapshot.docs.map(d => ({id: d.id, ...d.data()})));}
export async function getXRayAppointments(): Promise<XRayAppointment[]> { if (!adminDb) return []; const snapshot = await getDocs(query(collection(adminDb, 'xrayAppointments'), orderBy('date', 'desc'))); return enrichAppointmentsWithPatientData(snapshot.docs.map(d => ({id: d.id, ...d.data()})));}
export async function getUltrasoundAppointments(): Promise<UltrasoundAppointment[]> { if (!adminDb) return []; const snapshot = await getDocs(query(collection(adminDb, 'ultrasoundAppointments'), orderBy('date', 'desc'))); return enrichAppointmentsWithPatientData(snapshot.docs.map(d => ({id: d.id, ...d.data()})));}
export async function getVaccineAppointments(): Promise<VaccineAppointment[]> { if (!adminDb) return []; const snapshot = await getDocs(query(collection(adminDb, 'vaccineAppointments'), orderBy('date', 'desc'))); return enrichAppointmentsWithPatientData(snapshot.docs.map(d => ({id: d.id, ...d.data()})));}
export async function getAppointmentsForClinic(clinicId: string): Promise<Appointment[]> { if (!adminDb) return []; const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', clinicId)); const snapshot = await getDocs(q); return enrichAppointmentsWithPatientData(snapshot.docs.map(d => ({id: d.id, ...d.data()})));}

export async function saveAppointment(
    appointmentData: Omit<Appointment, 'id' | 'patientId' | 'patient'>,
    patientData: Omit<Patient, 'id'>
) {
    if (!adminDb) throw new Error("Database not initialized.");
    
    const patientRef = await findOrCreatePatient(patientData);
    const clinicRef = doc(adminDb, 'clinics', appointmentData.clinicId);

    const { appointmentRef } = await runTransaction(adminDb, async (transaction) => {
        const clinicSnap = await transaction.get(clinicRef);
        if (!clinicSnap.exists()) throw new Error("La clínica seleccionada no es válida.");
        const clinic = { id: clinicSnap.id, ...clinicSnap.data() } as Clinic;
        
        const appointmentDate = new Date(appointmentData.date);
        const dayStart = new Date(appointmentDate);
        dayStart.setHours(0, 0, 0, 0);

        const dayAppointmentsQuery = query(collection(adminDb, 'appointments'), where('date', '==', Timestamp.fromDate(dayStart)));
        const dayAppointmentsSnap = await transaction.get(dayAppointmentsQuery);
        
        const appointmentsForClinicOnDate = dayAppointmentsSnap.docs.filter(doc => doc.data().clinicId === clinic.id);

        if (appointmentsForClinicOnDate.length >= clinic.dailySlots) {
            throw new Error('No hay más cupos disponibles para este núcleo en la fecha seleccionada.');
        }
        if (appointmentsForClinicOnDate.some(doc => doc.data().time === appointmentData.time)) {
            throw new Error(`El horario de ${appointmentData.time} ya no está disponible.`);
        }

        const newAppointmentRef = doc(collection(adminDb, 'appointments'));
        transaction.set(newAppointmentRef, {
            ...appointmentData,
            patientId: patientRef.id,
            date: Timestamp.fromDate(appointmentDate)
        });
        
        return { appointmentRef: newAppointmentRef };
    });

    const [appointmentSnap, patientSnap, clinicSnap] = await Promise.all([
        getDoc(appointmentRef),
        getDoc(patientRef),
        getDoc(clinicRef),
    ]);

    const fullAppointment = { ...appointmentSnap.data(), id: appointmentSnap.id, patient: { ...patientSnap.data(), id: patientSnap.id } } as Appointment;
    const fullClinic = { ...clinicSnap.data(), id: clinicSnap.id } as Clinic;

    return { success: true, data: { appointment: fullAppointment, clinic: fullClinic } };
}

export async function saveLabAppointment(appointmentData: Omit<LabAppointment, 'id' | 'patientId' | 'patient'>, patientData: Omit<Patient, 'id'>) {
    if (!adminDb) throw new Error("Database not initialized.");
    const patientRef = await findOrCreatePatient(patientData);

    const { appointmentRef } = await runTransaction(adminDb, async (transaction) => {
        const settingsSnap = await transaction.get(doc(adminDb, 'settings', 'labSettings'));
        const settings = settingsSnap.data() as LabSettings || { dailySlots: 10, weekendBookingEnabled: false };

        const appointmentDate = new Date(appointmentData.date);
        const isWeekend = isSaturday(appointmentDate) || isSunday(appointmentDate);
        if (isWeekend && !settings.weekendBookingEnabled) {
            throw new Error('No se permiten citas de laboratorio en fin de semana.');
        }

        const dayStart = new Date(appointmentDate); dayStart.setHours(0, 0, 0, 0);
        const dayAppointmentsQuery = query(collection(adminDb, 'labAppointments'), where('date', '==', Timestamp.fromDate(dayStart)));
        const dayAppointmentsSnap = await transaction.get(dayAppointmentsQuery);

        if (dayAppointmentsSnap.docs.length >= settings.dailySlots) {
            throw new Error('No hay más cupos para laboratorio en la fecha seleccionada.');
        }

        const newAppointmentRef = doc(collection(adminDb, 'labAppointments'));
        transaction.set(newAppointmentRef, { ...appointmentData, patientId: patientRef.id, date: Timestamp.fromDate(appointmentDate) });
        
        return { appointmentRef: newAppointmentRef };
    });

    const [appointmentSnap, patientSnap] = await Promise.all([
        getDoc(appointmentRef),
        getDoc(patientRef),
    ]);
    const fullAppointment = { ...appointmentSnap.data(), id: appointmentSnap.id, patient: { ...patientSnap.data(), id: patientSnap.id } } as LabAppointment;
    return { success: true, data: fullAppointment };
}

export async function saveXRayAppointment(appointmentData: Omit<XRayAppointment, 'id' | 'patientId' | 'patient' | 'status'>, patientData: Omit<Patient, 'id'>) {
    if (!adminDb) throw new Error("Database not initialized.");
    const patientRef = await findOrCreatePatient(patientData);
    const studyRef = doc(adminDb, 'xrayStudies', appointmentData.studyId);

    const { appointmentRef } = await runTransaction(adminDb, async (transaction) => {
        const settingsSnap = await transaction.get(doc(adminDb, 'settings', 'xraySettings'));
        const settings = settingsSnap.data() as XRaySettings || { dailySlots: 10, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false };
        
        const appointmentDate = new Date(appointmentData.date);
        const isWeekend = isSaturday(appointmentDate) || isSunday(appointmentDate);
        if (isWeekend && !settings.weekendBookingEnabled) throw new Error('No se permiten citas de Rayos X en fin de semana.');

        const dayStart = new Date(appointmentDate); dayStart.setHours(0, 0, 0, 0);
        const dayAppointmentsQuery = query(collection(adminDb, 'xrayAppointments'), where('date', '==', Timestamp.fromDate(dayStart)));
        const dayAppointmentsSnap = await transaction.get(dayAppointmentsQuery);
        
        if (dayAppointmentsSnap.docs.length >= settings.dailySlots) throw new Error('No hay más cupos para Rayos X en la fecha seleccionada.');
        if (dayAppointmentsSnap.docs.some(d => d.data().time === appointmentData.time)) throw new Error(`El horario de ${appointmentData.time} ya no está disponible.`);

        const newAppointmentRef = doc(collection(adminDb, 'xrayAppointments'));
        transaction.set(newAppointmentRef, { ...appointmentData, status: 'Agendada', patientId: patientRef.id, date: Timestamp.fromDate(appointmentDate) });
        
        return { appointmentRef: newAppointmentRef };
    });

    const [appointmentSnap, patientSnap, studySnap] = await Promise.all([
        getDoc(appointmentRef),
        getDoc(patientRef),
        getDoc(studyRef)
    ]);
    const fullAppointment = { ...appointmentSnap.data(), id: appointmentSnap.id, patient: { ...patientSnap.data(), id: patientSnap.id } } as XRayAppointment;
    const fullStudy = { ...studySnap.data(), id: studySnap.id } as XRayStudy;

    return { success: true, data: { appointment: fullAppointment, study: fullStudy } };
}

export async function saveUltrasoundAppointment(appointmentData: Omit<UltrasoundAppointment, 'id' | 'patientId' | 'patient' | 'status'>, patientData: Omit<Patient, 'id'>) {
    if (!adminDb) throw new Error("Database not initialized.");
    const patientRef = await findOrCreatePatient(patientData);
    const studyRef = doc(adminDb, 'ultrasoundStudies', appointmentData.studyId);

    const { appointmentRef } = await runTransaction(adminDb, async (transaction) => {
        const settingsSnap = await transaction.get(doc(adminDb, 'settings', 'ultrasoundSettings'));
        const settings = settingsSnap.data() as UltrasoundSettings || { dailySlots: 10, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false };

        const appointmentDate = new Date(appointmentData.date);
        const isWeekend = isSaturday(appointmentDate) || isSunday(appointmentDate);
        if (isWeekend && !settings.weekendBookingEnabled) throw new Error('No se permiten citas de Ultrasonido en fin de semana.');

        const dayStart = new Date(appointmentDate); dayStart.setHours(0, 0, 0, 0);
        const dayAppointmentsQuery = query(collection(adminDb, 'ultrasoundAppointments'), where('date', '==', Timestamp.fromDate(dayStart)));
        const dayAppointmentsSnap = await transaction.get(dayAppointmentsQuery);
        
        if (dayAppointmentsSnap.docs.length >= settings.dailySlots) throw new Error('No hay más cupos para Ultrasonido en la fecha seleccionada.');
        if (dayAppointmentsSnap.docs.some(d => d.data().time === appointmentData.time)) throw new Error(`El horario de ${appointmentData.time} ya no está disponible.`);

        const newAppointmentRef = doc(collection(adminDb, 'ultrasoundAppointments'));
        transaction.set(newAppointmentRef, { ...appointmentData, status: 'Agendada', patientId: patientRef.id, date: Timestamp.fromDate(appointmentDate) });
        
        return { appointmentRef: newAppointmentRef };
    });

    const [appointmentSnap, patientSnap, studySnap] = await Promise.all([
        getDoc(appointmentRef),
        getDoc(patientRef),
        getDoc(studyRef)
    ]);
    const fullAppointment = { ...appointmentSnap.data(), id: appointmentSnap.id, patient: { ...patientSnap.data(), id: patientSnap.id } } as UltrasoundAppointment;
    const fullStudy = { ...studySnap.data(), id: studySnap.id } as UltrasoundStudy;

    return { success: true, data: { appointment: fullAppointment, study: fullStudy } };
}

export async function saveVaccineAppointment(appointmentData: Omit<VaccineAppointment, 'id' | 'patientId' | 'patient'>, patientData: Omit<Patient, 'id'>) {
    if (!adminDb) throw new Error("Database not initialized.");
    const patientRef = await findOrCreatePatient(patientData);

    const { appointmentRef } = await runTransaction(adminDb, async (transaction) => {
        const settingsSnap = await transaction.get(doc(adminDb, 'settings', 'vaccineSettings'));
        const settings = settingsSnap.data() as VaccineSettings || { dailySlots: 20, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false };

        const appointmentDate = new Date(appointmentData.date);
        const isWeekend = isSaturday(appointmentDate) || isSunday(appointmentDate);
        if (isWeekend && !settings.weekendBookingEnabled) throw new Error('No se permiten citas de vacunación en fin de semana.');

        const dayStart = new Date(appointmentDate); dayStart.setHours(0, 0, 0, 0);
        const dayAppointmentsQuery = query(collection(adminDb, 'vaccineAppointments'), where('date', '==', Timestamp.fromDate(dayStart)));
        const dayAppointmentsSnap = await transaction.get(dayAppointmentsQuery);
        
        if (dayAppointmentsSnap.docs.length >= settings.dailySlots) throw new Error('No hay más cupos para vacunación en la fecha seleccionada.');
        if (dayAppointmentsSnap.docs.some(d => d.data().time === appointmentData.time)) throw new Error(`El horario de ${appointmentData.time} ya no está disponible.`);
        
        const newAppointmentRef = doc(collection(adminDb, 'vaccineAppointments'));
        transaction.set(newAppointmentRef, { ...appointmentData, status: 'Agendada', patientId: patientRef.id, date: Timestamp.fromDate(appointmentDate) });
        
        return { appointmentRef: newAppointmentRef };
    });
    
    const [appointmentSnap, patientSnap] = await Promise.all([
        getDoc(appointmentRef),
        getDoc(patientRef),
    ]);
    const fullAppointment = { ...appointmentSnap.data(), id: appointmentSnap.id, patient: { ...patientSnap.data(), id: patientSnap.id } } as VaccineAppointment;
    return { success: true, data: fullAppointment };
}

export async function updatePatient(patientId: string, patientData: Partial<Omit<Patient, 'id'>>) { if (!adminDb) throw new Error("Database not initialized."); const patientRef = doc(adminDb, 'patients', patientId); await updateDoc(patientRef, patientData); return { success: true };}
async function deleteDocAndGetFolio(collectionName: string, id: string): Promise<string> { if (!adminDb) throw new Error("Database not initialized."); const docRef = doc(adminDb, collectionName, id); const docSnap = await getDoc(docRef); if(docSnap.exists()){ const data = docSnap.data(); await deleteDoc(docRef); return data.appointmentNumber || id; } return id; }
export async function deleteAppointment(id: string) { return deleteDocAndGetFolio('appointments', id); }
export async function deleteLabAppointment(id: string) { return deleteDocAndGetFolio('labAppointments', id); }
export async function deleteXRayAppointment(id: string) { return deleteDocAndGetFolio('xrayAppointments', id); }
export async function deleteUltrasoundAppointment(id: string) { return deleteDocAndGetFolio('ultrasoundAppointments', id); }
export async function deleteVaccineAppointment(id: string) { return deleteDocAndGetFolio('vaccineAppointments', id); }

export async function updateAppointmentStatus(appointmentId: string, status: AppointmentStatus, type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine'): Promise<{ success: boolean; message?: string }> { if (!adminDb) throw new Error("Database not initialized."); const collectionName = type === 'medical' ? 'appointments' : `${type}Appointments`; const docRef = doc(adminDb, collectionName, appointmentId); await updateDoc(docRef, { status }); return { success: true };}
export async function rescheduleAppointment(appointmentId: string, newDate: string, type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine'): Promise<{ success: boolean; message: string; newTime?: string }> { if (!adminDb) throw new Error("Database not initialized."); const collectionName = type === 'medical' ? 'appointments' : `${type}Appointments`; const docRef = doc(adminDb, collectionName, appointmentId); await updateDoc(docRef, { date: Timestamp.fromDate(new Date(newDate)), status: 'Agendada' }); return { success: true, message: 'Fecha de la cita actualizada.' };}
export async function cloneAppointment(originalAppointmentId: string, newDate: string, type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine'): Promise<{ success: boolean; message: string; data?: any, originalFolio?: string }> {
    if (!adminDb) throw new Error("Database not initialized.");
    const collectionName = type === 'medical' ? 'appointments' : `${type}Appointments`;
    const docRef = doc(adminDb, collectionName, originalAppointmentId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error('Cita original no encontrada.');

    const originalAppointment = docSnap.data();
    if (!originalAppointment.patientId) throw new Error('Paciente original no encontrado en la cita.');
    
    const patientDoc = await getDoc(doc(adminDb, 'patients', originalAppointment.patientId));
    if (!patientDoc.exists()) throw new Error('Datos del paciente no encontrados.');
    const patientData = patientDoc.data() as Omit<Patient, 'id'>;
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, patientId, date, status, appointmentNumber, ...payload } = originalAppointment;
    const newAppointmentNumber = `${type.substring(0,3).toUpperCase()}-${uuidv4().split('-')[0].toUpperCase()}`;
    const newAppointmentData = { ...payload, date: newDate, status: 'Agendada' as AppointmentStatus, appointmentNumber: newAppointmentNumber };
    
    let result: any;
    try {
        if (type === 'medical') {
            const { data } = await saveAppointment(newAppointmentData as any, patientData);
            result = data?.appointment;
        } else if (type === 'lab') {
            const { data } = await saveLabAppointment(newAppointmentData as any, patientData);
            result = data;
        } else if (type === 'xray') {
            const { data } = await saveXRayAppointment(newAppointmentData as any, patientData);
            result = data?.appointment;
        } else if (type === 'ultrasound') {
            const { data } = await saveUltrasoundAppointment(newAppointmentData as any, patientData);
            result = data?.appointment;
        } else if (type === 'vaccine') {
            const { data } = await saveVaccineAppointment(newAppointmentData as any, patientData);
            result = data;
        } else {
            throw new Error('Tipo de cita no válido.');
        }
    } catch (e: any) {
        return { success: false, message: e.message };
    }

    return { success: true, message: `Nueva cita asignada con folio ${newAppointmentNumber}`, data: result, originalFolio: appointmentNumber };
}

// Passwords
export async function verifyClinicPassword(clinicId: string, passwordAttempt: string): Promise<{ isValid: boolean; error?: string }> { if (!adminDb) throw new Error("Database not initialized."); const clinic = await getDoc(doc(adminDb, 'clinics', clinicId)).then(d => d.data() as Clinic); if (!clinic) return { isValid: false, error: 'La clínica no existe.' }; return { isValid: clinic.password === passwordAttempt }; }
export async function verifyLabPassword(passwordAttempt: string): Promise<{ isValid: boolean }> { const settings = await getLabSettings(); return { isValid: settings.password === passwordAttempt }; }
export async function verifyXRayPassword(passwordAttempt: string): Promise<{ isValid: boolean }> { const settings = await getXRaySettings(); return { isValid: settings.password === passwordAttempt }; }
export async function verifyUltrasoundPassword(passwordAttempt: string): Promise<{ isValid: boolean }> { const settings = await getUltrasoundSettings(); return { isValid: settings.password === passwordAttempt }; }
export async function verifyVaccinePassword(passwordAttempt: string): Promise<{ isValid: boolean }> { const settings = await getVaccineSettings(); return { isValid: settings.password === passwordAttempt }; }

// --- Backup & Restore ---
export async function createBackupData() {
    const data = {
        appointments: await getAppointments(),
        labAppointments: await getLabAppointments(),
        xRayAppointments: await getXRayAppointments(),
        ultrasoundAppointments: await getUltrasoundAppointments(),
        vaccineAppointments: await getVaccineAppointments(),
        patients: await getCatalog<Patient>('patients'),
        clinics: await getClinics(),
    };
    return data;
}
  
export async function restoreBackupData(backup: any) { return { success: false, message: 'La restauración de respaldos está deshabilitada.' }; }
  
export async function cleanupOldRecords() {
    if (!adminDb) throw new Error("Database not initialized.");
    let totalDeleted = 0;
    const collectionsToClean = [ 'appointments', 'labAppointments', 'xrayAppointments', 'ultrasoundAppointments', 'vaccineAppointments' ];
    const firstDayOfCurrentMonth = Timestamp.fromDate(startOfMonth(new Date()));

    for (const collectionName of collectionsToClean) {
        const collRef = collection(adminDb, collectionName);
        const q = query(collRef, where('date', '<', firstDayOfCurrentMonth));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const batch = writeBatch(adminDb);
            snapshot.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
            totalDeleted += snapshot.size;
        }
    }
    
    return { deletedCount: totalDeleted };
}
