
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
  writeBatch, 
  Timestamp, 
  orderBy, 
  limit,
  DocumentReference,
  addDoc
} from 'firebase/firestore';
import { adminDb } from '@/firebase/server-config';
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
import { generateAppointmentPDF, generateLabAppointmentPDF, generateXRayAppointmentPDF, generateUltrasoundAppointmentPDF, generateVaccineAppointmentPDF } from './utils';

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
export async function updateAnnouncements(announcements: string[]) { return setSettingsDoc('announcements', { messages: newAnnouncements.slice(0, 4) }); }

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
// VALIDATION HELPERS
// =====================================================================

async function validateClinicAvailability(clinic: Clinic, date: string, time: string) {
    if (!adminDb) throw new Error("Database not initialized.");
    
    const dateOnly = date.substring(0, 10);
    const appointmentDate = new Date(`${dateOnly}T12:00:00.000Z`);

    if (isNaN(appointmentDate.getTime())) {
        return { isValid: false, message: 'La fecha proporcionada es inválida.' };
    }

    const dayOfWeekJS = appointmentDate.getUTCDay();
    const dayOfWeekString = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][dayOfWeekJS];
    if (clinic.dayOfAction && clinic.dayOfAction !== "Ninguno" && clinic.dayOfAction === dayOfWeekString) {
        return { isValid: false, message: `El núcleo básico no labora los días ${clinic.dayOfAction}.` };
    }
    
    if ((dayOfWeekJS === 6 || dayOfWeekJS === 0) && !clinic.weekendBookingEnabled) {
      return { isValid: false, message: 'No se permiten citas en fin de semana para este núcleo.' };
    }
    
    if (clinic.unavailableDates?.includes(dateOnly)) {
        return { isValid: false, message: 'El núcleo básico no labora en la fecha seleccionada por vacaciones.' };
    }

    const startDate = new Date(`${dateOnly}T00:00:00.000Z`);
    const endDate = new Date(`${dateOnly}T23:59:59.999Z`);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return { isValid: false, message: 'Error interno al procesar la fecha.' };
    }
    
    const allDayAppointmentsQuery = query(
        collection(adminDb, 'appointments'), 
        where('date', '>=', startDate), 
        where('date', '<=', endDate)
    );
    const allDayAppointmentsSnap = await getDocs(allDayAppointmentsQuery);

    const appointmentsForClinicOnDate = allDayAppointmentsSnap.docs.filter(
        d => d.data().clinicId === clinic.id
    );

    if (appointmentsForClinicOnDate.length >= clinic.dailySlots) return { isValid: false, message: 'No hay más cupos disponibles para este núcleo en la fecha seleccionada.' };
    if (appointmentsForClinicOnDate.some(d => d.data().time === time)) return { isValid: false, message: `El horario de ${time} ya no está disponible.` };

    return { isValid: true };
}

async function validateLabAvailability(settings: LabSettings, date: string) {
    if (!adminDb) throw new Error("Database not initialized.");

    const dateOnly = date.substring(0, 10);
    const appointmentDate = new Date(`${dateOnly}T12:00:00.000Z`);
    if (isNaN(appointmentDate.getTime())) return { isValid: false, message: 'La fecha proporcionada es inválida.' };
    
    const dayOfWeek = appointmentDate.getUTCDay();
    if ((dayOfWeek === 6 || dayOfWeek === 0) && !settings.weekendBookingEnabled) {
      return { isValid: false, message: 'No se permiten citas de laboratorio en fin de semana.' };
    }

    const startDate = new Date(`${dateOnly}T00:00:00.000Z`);
    const endDate = new Date(`${dateOnly}T23:59:59.999Z`);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return { isValid: false, message: 'Error interno al procesar la fecha.' };
    }

    const q = query(collection(adminDb, 'labAppointments'), where('date', '>=', startDate), where('date', '<=', endDate));
    const dayAppointmentsSnap = await getDocs(q);

    if (dayAppointmentsSnap.docs.length >= settings.dailySlots) return { isValid: false, message: 'No hay más cupos para laboratorio en la fecha seleccionada.' };

    return { isValid: true };
}

async function validateXRayAvailability(settings: XRaySettings, date: string, time: string) {
    if (!adminDb) throw new Error("Database not initialized.");
    
    const dateOnly = date.substring(0, 10);
    const appointmentDate = new Date(`${dateOnly}T12:00:00.000Z`);
    if (isNaN(appointmentDate.getTime())) return { isValid: false, message: 'La fecha proporcionada es inválida.' };

    const dayOfWeek = appointmentDate.getUTCDay();
    if ((dayOfWeek === 6 || dayOfWeek === 0) && !settings.weekendBookingEnabled) {
      return { isValid: false, message: 'No se permiten citas de Rayos X en fin de semana.' };
    }
    
    const startDate = new Date(`${dateOnly}T00:00:00.000Z`);
    const endDate = new Date(`${dateOnly}T23:59:59.999Z`);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return { isValid: false, message: 'Error interno al procesar la fecha.' };
    }
    
    const q = query(collection(adminDb, 'xrayAppointments'), where('date', '>=', startDate), where('date', '<=', endDate));
    const dayAppointmentsSnap = await getDocs(q);

    if (dayAppointmentsSnap.docs.length >= settings.dailySlots) return { isValid: false, message: 'No hay más cupos para Rayos X en la fecha seleccionada.' };
    if (dayAppointmentsSnap.docs.some(d => d.data().time === time)) return { isValid: false, message: `El horario de ${time} ya no está disponible.` };
    
    return { isValid: true };
}

async function validateUltrasoundAvailability(settings: UltrasoundSettings, date: string, time: string) {
    if (!adminDb) throw new Error("Database not initialized.");
    
    const dateOnly = date.substring(0, 10);
    const appointmentDate = new Date(`${dateOnly}T12:00:00.000Z`);
    if (isNaN(appointmentDate.getTime())) return { isValid: false, message: 'La fecha proporcionada es inválida.' };
    
    const dayOfWeek = appointmentDate.getUTCDay();
    if ((dayOfWeek === 6 || dayOfWeek === 0) && !settings.weekendBookingEnabled) {
      return { isValid: false, message: 'No se permiten citas de Ultrasonido en fin de semana.' };
    }
    
    const startDate = new Date(`${dateOnly}T00:00:00.000Z`);
    const endDate = new Date(`${dateOnly}T23:59:59.999Z`);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return { isValid: false, message: 'Error interno al procesar la fecha.' };
    }
    
    const q = query(collection(adminDb, 'ultrasoundAppointments'), where('date', '>=', startDate), where('date', '<=', endDate));
    const dayAppointmentsSnap = await getDocs(q);

    if (dayAppointmentsSnap.docs.length >= settings.dailySlots) return { isValid: false, message: 'No hay más cupos para Ultrasonido en la fecha seleccionada.' };
    if (dayAppointmentsSnap.docs.some(d => d.data().time === time)) return { isValid: false, message: `El horario de ${time} ya no está disponible.` };
    
    return { isValid: true };
}

async function validateVaccineAvailability(settings: VaccineSettings, date: string, time: string) {
    if (!adminDb) throw new Error("Database not initialized.");

    const dateOnly = date.substring(0, 10);
    const appointmentDate = new Date(`${dateOnly}T12:00:00.000Z`);
    if (isNaN(appointmentDate.getTime())) return { isValid: false, message: 'La fecha proporcionada es inválida.' };
    
    const dayOfWeek = appointmentDate.getUTCDay();
    if ((dayOfWeek === 6 || dayOfWeek === 0) && !settings.weekendBookingEnabled) {
      return { isValid: false, message: 'No se permiten citas de vacunación en fin de semana.' };
    }
    
    const startDate = new Date(`${dateOnly}T00:00:00.000Z`);
    const endDate = new Date(`${dateOnly}T23:59:59.999Z`);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return { isValid: false, message: 'Error interno al procesar la fecha.' };
    }
    
    const q = query(collection(adminDb, 'vaccineAppointments'), where('date', '>=', startDate), where('date', '<=', endDate));
    const dayAppointmentsSnap = await getDocs(q);

    if (dayAppointmentsSnap.docs.length >= settings.dailySlots) return { isValid: false, message: 'No hay más cupos para vacunación en la fecha seleccionada.' };
    if (dayAppointmentsSnap.docs.some(d => d.data().time === time)) return { isValid: false, message: `El horario de ${time} ya no está disponible.` };

    return { isValid: true };
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

export async function saveAppointment(appointmentData: Omit<Appointment, 'id' | 'patientId' | 'patient'>, patientData: Omit<Patient, 'id'>) {
    if (!adminDb) throw new Error("Database not initialized.");
    
    // 1. First, find or create patient to get a stable ID.
    let patientRef: DocumentReference;
    if (patientData.curp && !patientData.curp.startsWith('RN-')) {
        const existingPatient = await getPatientByCURP(patientData.curp);
        if (existingPatient) {
            patientRef = doc(adminDb, 'patients', existingPatient.id);
            await updateDoc(patientRef, patientData); // Update with latest info
        } else {
            patientRef = doc(collection(adminDb, 'patients'));
            await setDoc(patientRef, patientData);
        }
    } else {
        patientRef = doc(collection(adminDb, 'patients'));
        await setDoc(patientRef, patientData);
    }
    
    // 2. Validate availability
    const clinic = await getClinicById(appointmentData.clinicId);
    if (!clinic) throw new Error("La clínica seleccionada no es válida.");

    const { isValid, message } = await validateClinicAvailability(clinic, appointmentData.date, appointmentData.time);
    if (!isValid) throw new Error(message);
    
    // 3. Save appointment
    const newAppointmentData = { ...appointmentData, patientId: patientRef.id, date: new Date(appointmentData.date) };
    const newAppointmentRef = await addDoc(collection(adminDb, 'appointments'), newAppointmentData);

    const appointmentSnap = await getDoc(newAppointmentRef);
    const patientSnap = await getDoc(patientRef);

    const fullAppointment = { ...appointmentSnap.data(), id: appointmentSnap.id, patient: { ...patientSnap.data(), id: patientSnap.id } } as Appointment;
    return { success: true, data: { appointment: fullAppointment, clinic } };
}


export async function saveLabAppointment(appointmentData: Omit<LabAppointment, 'id' | 'patientId' | 'patient'>, patientData: Omit<Patient, 'id'>) {
    if (!adminDb) throw new Error("Database not initialized.");

    let patientRef: DocumentReference;
    if (patientData.curp && !patientData.curp.startsWith('RN-')) {
        const existingPatient = await getPatientByCURP(patientData.curp);
        if (existingPatient) {
            patientRef = doc(adminDb, 'patients', existingPatient.id);
            await updateDoc(patientRef, patientData);
        } else {
            patientRef = doc(collection(adminDb, 'patients'));
            await setDoc(patientRef, patientData);
        }
    } else {
        patientRef = doc(collection(adminDb, 'patients'));
        await setDoc(patientRef, patientData);
    }

    const settings = await getLabSettings();
    const { isValid, message } = await validateLabAvailability(settings, appointmentData.date);
    if (!isValid) throw new Error(message);

    const newAppointmentData = { ...appointmentData, patientId: patientRef.id, date: new Date(appointmentData.date) };
    const newAppointmentRef = await addDoc(collection(adminDb, 'labAppointments'), newAppointmentData);

    const [appointmentSnap, patientSnap] = await Promise.all([ getDoc(newAppointmentRef), getDoc(patientRef) ]);
    const fullAppointment = { ...appointmentSnap.data(), id: appointmentSnap.id, patient: { ...patientSnap.data(), id: patientSnap.id } } as LabAppointment;
    return { success: true, data: fullAppointment };
}

export async function saveXRayAppointment(appointmentData: Omit<XRayAppointment, 'id' | 'patientId' | 'patient'>, patientData: Omit<Patient, 'id'>) {
    if (!adminDb) throw new Error("Database not initialized.");
    
    let patientRef: DocumentReference;
    if (patientData.curp && !patientData.curp.startsWith('RN-')) {
        const existingPatient = await getPatientByCURP(patientData.curp);
        if (existingPatient) {
            patientRef = doc(adminDb, 'patients', existingPatient.id);
            await updateDoc(patientRef, patientData);
        } else {
            patientRef = doc(collection(adminDb, 'patients'));
            await setDoc(patientRef, patientData);
        }
    } else {
        patientRef = doc(collection(adminDb, 'patients'));
        await setDoc(patientRef, patientData);
    }

    const settings = await getXRaySettings();
    const { isValid, message } = await validateXRayAvailability(settings, appointmentData.date, appointmentData.time);
    if (!isValid) throw new Error(message);

    const studyRef = doc(adminDb, 'xrayStudies', appointmentData.studyId);
    
    const newAppointmentData = { ...appointmentData, patientId: patientRef.id, date: new Date(appointmentData.date) };
    const newAppointmentRef = await addDoc(collection(adminDb, 'xrayAppointments'), newAppointmentData);

    const [appointmentSnap, patientSnap, studySnap] = await Promise.all([ getDoc(newAppointmentRef), getDoc(patientRef), getDoc(studyRef) ]);
    const fullAppointment = { ...appointmentSnap.data(), id: appointmentSnap.id, patient: { ...patientSnap.data(), id: patientSnap.id } } as XRayAppointment;
    const fullStudy = { ...studySnap.data(), id: studySnap.id } as XRayStudy;

    return { success: true, data: { appointment: fullAppointment, study: fullStudy } };
}

export async function saveUltrasoundAppointment(appointmentData: Omit<UltrasoundAppointment, 'id' | 'patientId' | 'patient'>, patientData: Omit<Patient, 'id'>) {
    if (!adminDb) throw new Error("Database not initialized.");
    
    let patientRef: DocumentReference;
    if (patientData.curp && !patientData.curp.startsWith('RN-')) {
        const existingPatient = await getPatientByCURP(patientData.curp);
        if (existingPatient) {
            patientRef = doc(adminDb, 'patients', existingPatient.id);
            await updateDoc(patientRef, patientData);
        } else {
            patientRef = doc(collection(adminDb, 'patients'));
            await setDoc(patientRef, patientData);
        }
    } else {
        patientRef = doc(collection(adminDb, 'patients'));
        await setDoc(patientRef, patientData);
    }
    
    const settings = await getUltrasoundSettings();
    const { isValid, message } = await validateUltrasoundAvailability(settings, appointmentData.date, appointmentData.time);
    if (!isValid) throw new Error(message);

    const studyRef = doc(adminDb, 'ultrasoundStudies', appointmentData.studyId);
    
    const newAppointmentData = { ...appointmentData, patientId: patientRef.id, date: new Date(appointmentData.date) };
    const newAppointmentRef = await addDoc(collection(adminDb, 'ultrasoundAppointments'), newAppointmentData);
    
    const [appointmentSnap, patientSnap, studySnap] = await Promise.all([ getDoc(newAppointmentRef), getDoc(patientRef), getDoc(studyRef) ]);
    const fullAppointment = { ...appointmentSnap.data(), id: appointmentSnap.id, patient: { ...patientSnap.data(), id: patientSnap.id } } as UltrasoundAppointment;
    const fullStudy = { ...studySnap.data(), id: studySnap.id } as UltrasoundStudy;

    return { success: true, data: { appointment: fullAppointment, study: fullStudy } };
}

export async function saveVaccineAppointment(appointmentData: Omit<VaccineAppointment, 'id' | 'patientId' | 'patient'>, patientData: Omit<Patient, 'id'>) {
    if (!adminDb) throw new Error("Database not initialized.");
    
    let patientRef: DocumentReference;
    if (patientData.curp && !patientData.curp.startsWith('RN-')) {
        const existingPatient = await getPatientByCURP(patientData.curp);
        if (existingPatient) {
            patientRef = doc(adminDb, 'patients', existingPatient.id);
            await updateDoc(patientRef, patientData);
        } else {
            patientRef = doc(collection(adminDb, 'patients'));
            await setDoc(patientRef, patientData);
        }
    } else {
        patientRef = doc(collection(adminDb, 'patients'));
        await setDoc(patientRef, patientData);
    }
    
    const settings = await getVaccineSettings();
    const { isValid, message } = await validateVaccineAvailability(settings, appointmentData.date, appointmentData.time);
    if (!isValid) throw new Error(message);
        
    const newAppointmentData = { ...appointmentData, patientId: patientRef.id, date: new Date(appointmentData.date) };
    const newAppointmentRef = await addDoc(collection(adminDb, 'vaccineAppointments'), newAppointmentData);
    
    const [appointmentSnap, patientSnap] = await Promise.all([ getDoc(newAppointmentRef), getDoc(patientRef) ]);
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
export async function rescheduleAppointment(appointmentId: string, newDate: string, type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine'): Promise<{ success: boolean; message: string; newTime?: string }> { if (!adminDb) throw new Error("Database not initialized."); const collectionName = type === 'medical' ? 'appointments' : `${type}Appointments`; const docRef = doc(adminDb, collectionName, appointmentId); await updateDoc(docRef, { date: new Date(newDate), status: 'Agendada' }); return { success: true, message: 'Fecha de la cita actualizada.' };}
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
    const { id, patientId, date, status, ...payload } = originalAppointment;
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

    return { success: true, message: `Nueva cita asignada con folio ${newAppointmentNumber}`, data: result, originalFolio: originalAppointment.appointmentNumber };
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
    
    const now = new Date();
    const firstDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

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

    
