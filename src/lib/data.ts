
'use server';

import { adminDb } from '@/firebase/server-config';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  runTransaction,
  writeBatch,
  Timestamp,
  orderBy,
  limit,
  Transaction,
  DocumentReference,
  DocumentSnapshot,
} from 'firebase/firestore';
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
} from './definitions';

// =====================================================================
// HELPERS
// =====================================================================

type SlotValidationSettings = {
    dailySlots: number;
    weekendBookingEnabled: boolean;
};

async function getSettingsDoc<T>(docId: string, defaultVal: T): Promise<T> {
  const docRef = doc(adminDb, 'settings', docId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as T;
  }
  await setDoc(docRef, defaultVal);
  return defaultVal;
}

async function setSettingsDoc(docId: string, data: any) {
  const docRef = doc(adminDb, 'settings', docId);
  await setDoc(docRef, data, { merge: true });
  return { success: true };
}

async function getCatalog<T>(collectionName: string): Promise<T[]> {
  const collRef = collection(adminDb, collectionName);
  const snapshot = await getDocs(query(collRef));
  if (snapshot.empty) return [];
  return snapshot.docs.map(doc => ({ ...(doc.data() as T), id: doc.id }));
}

async function updateCatalog<T extends { id?: string }>(collectionName: string, items: T[]) {
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
    const patientIds = [...new Set(appointments.map(app => app.patientId).filter(Boolean))];
    if (patientIds.length === 0) {
        return appointments.map(app => ({
            ...app,
            date: app.date instanceof Timestamp ? app.date.toDate().toISOString() : app.date
        }));
    }

    const patients: Record<string, Patient> = {};
    
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
    const q = query(collection(adminDb, 'activityLog'), orderBy('timestamp', 'desc'), limit(500));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: (doc.data().timestamp as Timestamp).toDate().toISOString()
    })) as ActivityLog[];
}

export async function logActivity(action: string, details: string) {
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


// =====================================================================
// CORE DATA LOGIC
// =====================================================================

async function findOrCreatePatient(transaction: Transaction, patientData: Omit<Patient, 'id'>): Promise<DocumentReference> {
    const patientsCollRef = collection(adminDb, 'patients');
    // Only search by CURP if it's not a newborn placeholder
    if (patientData.curp && !patientData.curp.startsWith('RN-')) {
        const q = query(patientsCollRef, where('curp', '==', patientData.curp.toUpperCase()), limit(1));
        const patientSnap = await transaction.get(q);

        if (!patientSnap.empty) {
            const patientRef = patientSnap.docs[0].ref;
            transaction.update(patientRef, patientData);
            return patientRef;
        }
    }
    // If it's a newborn or not found, create a new one.
    const patientRef = doc(patientsCollRef, uuidv4());
    transaction.set(patientRef, patientData);
    return patientRef;
}

export async function getPatientByCURP(curp: string): Promise<Patient | null> {
  const q = query(collection(adminDb, 'patients'), where('curp', '==', curp.toUpperCase()), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { ...doc.data(), id: doc.id } as Patient;
}

export async function getAppointments(): Promise<Appointment[]> { const snapshot = await getDocs(query(collection(adminDb, 'appointments'), orderBy('date', 'desc'))); return enrichAppointmentsWithPatientData(snapshot.docs.map(d => ({id: d.id, ...d.data()}))); }
export async function getLabAppointments(): Promise<LabAppointment[]> { const snapshot = await getDocs(query(collection(adminDb, 'labAppointments'), orderBy('date', 'desc'))); return enrichAppointmentsWithPatientData(snapshot.docs.map(d => ({id: d.id, ...d.data()})));}
export async function getXRayAppointments(): Promise<XRayAppointment[]> { const snapshot = await getDocs(query(collection(adminDb, 'xrayAppointments'), orderBy('date', 'desc'))); return enrichAppointmentsWithPatientData(snapshot.docs.map(d => ({id: d.id, ...d.data()})));}
export async function getUltrasoundAppointments(): Promise<UltrasoundAppointment[]> { const snapshot = await getDocs(query(collection(adminDb, 'ultrasoundAppointments'), orderBy('date', 'desc'))); return enrichAppointmentsWithPatientData(snapshot.docs.map(d => ({id: d.id, ...d.data()})));}
export async function getVaccineAppointments(): Promise<VaccineAppointment[]> { const snapshot = await getDocs(query(collection(adminDb, 'vaccineAppointments'), orderBy('date', 'desc'))); return enrichAppointmentsWithPatientData(snapshot.docs.map(d => ({id: d.id, ...d.data()})));}
export async function getAppointmentsForClinic(clinicId: string): Promise<Appointment[]> { const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', clinicId)); const snapshot = await getDocs(q); return enrichAppointmentsWithPatientData(snapshot.docs.map(d => ({id: d.id, ...d.data()})));}

async function validateClinicAvailability(collectionName: string, date: Date, time: string, clinicId: string | undefined): Promise<{ clinic: Clinic | null, appointmentsForDay: DocumentSnapshot[] }> {
    let clinic: Clinic | null = null;
    if (clinicId) {
        const clinicRef = doc(adminDb, 'clinics', clinicId);
        const clinicSnap = await getDoc(clinicRef);
        if (!clinicSnap.exists()) throw new Error("La clínica no existe.");
        clinic = { id: clinicSnap.id, ...clinicSnap.data() } as Clinic;

        const dayOfWeek = date.getUTCDay();
        const dayOfWeekMap: { [key: string]: number } = { "Domingo": 0, "Lunes": 1, "Martes": 2, "Miércoles": 3, "Jueves": 4, "Viernes": 5, "Sábado": 6 };

        if (clinic.dayOfAction && clinic.dayOfAction !== 'Ninguno' && dayOfWeekMap[clinic.dayOfAction] === dayOfWeek) throw new Error(`El ${clinic.dayOfAction} es día de acción y no se pueden agendar citas.`);
        if (clinic.unavailableDates?.includes(date.toISOString().split('T')[0])) throw new Error('La fecha seleccionada no está disponible (día inhábil).');
        const isWeekend = isSaturday(date) || isSunday(date);
        if (isWeekend && !clinic.weekendBookingEnabled) throw new Error('No se permiten citas en fin de semana para este núcleo.');
    }
    
    const startOfDay = Timestamp.fromDate(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0));
    const endOfDay = Timestamp.fromDate(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999));
    
    const qAppointments = query(collection(adminDb, collectionName), where('date', '>=', startOfDay), where('date', '<=', endOfDay));
    const appointmentsSnap = await getDocs(qAppointments);

    return { clinic, appointmentsForDay: appointmentsSnap.docs };
}

async function saveAppointmentBase(
    collectionName: string,
    appointmentData: any,
    patientData: Omit<Patient, 'id'>,
    settings: SlotValidationSettings,
    clinicId?: string
) {
    const { date, time } = appointmentData;
    if (!date || !time) throw new Error("La fecha y la hora son requeridas.");
    const appointmentDate = new Date(date);

    const { clinic, appointmentsForDay } = await validateClinicAvailability(collectionName, appointmentDate, time, clinicId);
    
    const relevantAppointments = clinicId ? appointmentsForDay.filter(doc => doc.data().clinicId === clinicId) : appointmentsForDay;
    const dailyLimit = clinicId && clinic ? clinic.dailySlots : settings.dailySlots;

    if (relevantAppointments.length >= dailyLimit) {
        throw new Error(`No hay más cupos disponibles para este servicio en la fecha seleccionada.`);
    }

    if (relevantAppointments.some(doc => doc.data().time === time)) {
        throw new Error(`El horario de ${time} ya no está disponible.`);
    }

    const newAppointmentRef = await runTransaction(adminDb, async (transaction) => {
        const patientRef = await findOrCreatePatient(transaction, patientData);
        const appointmentRef = doc(collection(adminDb, collectionName), uuidv4());
        const finalAppointmentData = { 
            ...appointmentData,
            date: Timestamp.fromDate(appointmentDate),
            patientId: patientRef.id,
            status: 'Agendada'
        };
        transaction.set(appointmentRef, finalAppointmentData);
        return appointmentRef;
    });

    const finalAppointmentSnap = await getDoc(newAppointmentRef);
    const finalData = { ...finalAppointmentSnap.data(), id: finalAppointmentSnap.id };
    
    return { appointment: finalData, clinic };
}

export async function saveAppointment(appointmentData: Omit<Appointment, 'id'|'patient'|'patientId'|'status'>, patientData: Omit<Patient, 'id'>) {
    if (!appointmentData.clinicId) throw new Error("Clínica no proporcionada.");
    const clinic = await getDoc(doc(adminDb, 'clinics', appointmentData.clinicId)).then(d => d.data() as Clinic);
    if (!clinic) throw new Error("La clínica no existe.");
    
    const result = await saveAppointmentBase('appointments', appointmentData, patientData, clinic, appointmentData.clinicId);
    
    await logActivity('Creación Cita Médica', `Folio ${result.appointment.appointmentNumber} para ${patientData.name}.`);

    return { 
        appointment: { ...result.appointment, patient: patientData } as Appointment, 
        clinic: result.clinic as Clinic 
    };
}

export async function saveLabAppointment(appointmentData: any, patientData: any, settings: LabSettings) {
    const result = await saveAppointmentBase('labAppointments', appointmentData, patientData, settings);
    await logActivity('Creación Cita Laboratorio', `Folio ${result.appointment.appointmentNumber} para ${patientData.name}.`);
    return { appointment: { ...result.appointment, patient: patientData } as LabAppointment };
}

export async function saveXRayAppointment(appointmentData: any, patientData: any) { 
    const settings = await getXRaySettings();
    const result = await saveAppointmentBase('xrayAppointments', appointmentData, patientData, settings);
    await logActivity('Creación Cita Rayos X', `Folio ${result.appointment.appointmentNumber} para ${patientData.name}.`);
    return { appointment: { ...result.appointment, patient: patientData } as XRayAppointment };
}

export async function saveUltrasoundAppointment(appointmentData: any, patientData: any) { 
    const settings = await getUltrasoundSettings();
    const result = await saveAppointmentBase('ultrasoundAppointments', appointmentData, patientData, settings);
    await logActivity('Creación Cita Ultrasonido', `Folio ${result.appointment.appointmentNumber} para ${patientData.name}.`);
    return { appointment: { ...result.appointment, patient: patientData } as UltrasoundAppointment };
}

export async function saveVaccineAppointment(appointmentData: any, patientData: any) { 
    const settings = await getVaccineSettings();
    const result = await saveAppointmentBase('vaccineAppointments', appointmentData, patientData, settings, appointmentData.clinicId);
    await logActivity('Creación Cita Vacunación', `Folio ${result.appointment.appointmentNumber} para ${patientData.name}.`);
    return { appointment: { ...result.appointment, patient: patientData } as VaccineAppointment };
}

export async function updatePatient(patientId: string, patientData: Partial<Omit<Patient, 'id'>>) { const patientRef = doc(adminDb, 'patients', patientId); await updateDoc(patientRef, patientData); return { success: true };}
async function deleteDocAndGetFolio(collectionName: string, id: string): Promise<string> { const docRef = doc(adminDb, collectionName, id); const docSnap = await getDoc(docRef); if(docSnap.exists()){ const data = docSnap.data(); await deleteDoc(docRef); return data.appointmentNumber || id; } return id; }
export async function deleteAppointment(id: string) { return deleteDocAndGetFolio('appointments', id); }
export async function deleteLabAppointment(id: string) { return deleteDocAndGetFolio('labAppointments', id); }
export async function deleteXRayAppointment(id: string) { return deleteDocAndGetFolio('xrayAppointments', id); }
export async function deleteUltrasoundAppointment(id: string) { return deleteDocAndGetFolio('ultrasoundAppointments', id); }
export async function deleteVaccineAppointment(id: string) { return deleteDocAndGetFolio('vaccineAppointments', id); }

export async function updateAppointmentStatus(appointmentId: string, status: AppointmentStatus, type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine'): Promise<{ success: boolean; message?: string }> { const collectionName = type === 'medical' ? 'appointments' : `${type}Appointments`; const docRef = doc(adminDb, collectionName, appointmentId); await updateDoc(docRef, { status }); return { success: true };}
export async function rescheduleAppointment(appointmentId: string, newDate: string, type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine'): Promise<{ success: boolean; message: string; newTime?: string }> { const collectionName = type === 'medical' ? 'appointments' : `${type}Appointments`; const docRef = doc(adminDb, collectionName, appointmentId); await updateDoc(docRef, { date: Timestamp.fromDate(new Date(newDate)), status: 'Agendada' }); return { success: true, message: 'Fecha de la cita actualizada.' };}
export async function cloneAppointment(originalAppointmentId: string, newDate: string, type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine'): Promise<{ success: boolean; message: string; data?: any, originalFolio?: string }> {
    const collectionName = type === 'medical' ? 'appointments' : `${type}Appointments`;
    const docRef = doc(adminDb, collectionName, originalAppointmentId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error('Cita original no encontrada.');

    const originalAppointment = docSnap.data();
    const patientDoc = await getDoc(doc(adminDb, 'patients', originalAppointment.patientId));
    if (!patientDoc.exists()) throw new Error('Paciente no encontrado.');

    const patientData = patientDoc.data() as Omit<Patient, 'id'>;
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, patientId, date, status, appointmentNumber: oldNumber, ...payload } = originalAppointment;
    
    let newAppointmentNumber = '';
    switch (type) {
        case 'medical': newAppointmentNumber = `CITA-${Date.now().toString().slice(-4)}`; break;
        case 'lab': newAppointmentNumber = `LAB-${uuidv4().split('-')[0].toUpperCase()}`; break;
        case 'xray': newAppointmentNumber = `RX-${uuidv4().split('-')[0].toUpperCase()}`; break;
        case 'ultrasound': newAppointmentNumber = `US-${uuidv4().split('-')[0].toUpperCase()}`; break;
        case 'vaccine': newAppointmentNumber = `VAC-${uuidv4().split('-')[0].toUpperCase()}`; break;
    }

    const newAppointmentData = { ...payload, appointmentNumber: newAppointmentNumber, date: newDate };
    
    let result: any;
    if (type === 'medical') { result = await saveAppointment(newAppointmentData, patientData); }
    else if (type === 'lab') { const settings = await getLabSettings(); result = await saveLabAppointment(newAppointmentData, patientData, settings); }
    else if (type === 'xray') { result = await saveXRayAppointment(newAppointmentData, patientData); }
    else if (type === 'ultrasound') { result = await saveUltrasoundAppointment(newAppointmentData, patientData); }
    else if (type === 'vaccine') { result = await saveVaccineAppointment(newAppointmentData, patientData); }
    else throw new Error('Tipo de cita no válido.');

    return { success: true, message: `Nueva cita asignada con folio ${result.appointment.appointmentNumber}`, data: result.appointment, originalFolio: oldNumber };
}

// Passwords
export async function verifyClinicPassword(clinicId: string, passwordAttempt: string): Promise<{ isValid: boolean; error?: string }> { const clinic = await getDoc(doc(adminDb, 'clinics', clinicId)).then(d => d.data() as Clinic); if (!clinic) return { isValid: false, error: 'La clínica no existe.' }; return { isValid: clinic.password === passwordAttempt }; }
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
  
export async function restoreBackupData(backup: any) {
    let addedCount = 0;
    const collectionsMap: { [key: string]: string } = { 'appointments': 'appointments', 'labAppointments': 'labAppointments', 'xRayAppointments': 'xrayAppointments', 'ultrasoundAppointments': 'ultrasoundAppointments', 'vaccineAppointments': 'vaccineAppointments', 'patients': 'patients', 'clinics': 'clinics' };

    for (const key in backup) {
        const collectionName = collectionsMap[key];
        if (!collectionName) continue;

        const backupItems = backup[key] || [];
        if (backupItems.length === 0) continue;
        
        const collRef = collection(adminDb, collectionName);
        const snapshot = await getDocs(collRef);
        const currentIds = new Set(snapshot.docs.map(doc => doc.id));
        const batch = writeBatch(adminDb);

        for (const item of backupItems) {
            if (item.id && !currentIds.has(item.id)) {
                const { id, ...data } = item;
                if (data.date) data.date = Timestamp.fromDate(new Date(data.date));
                batch.set(doc(collRef, id), data);
                addedCount++;
            }
        }
        await batch.commit();
    }
    
    return { addedCount };
}
  
export async function cleanupOldRecords() {
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

export async function migrateDataFromLocal() {
    // This is a one-time migration function.
    // Be careful running this.
    // const localData = await readAllLocalData();
    // const stats = await restoreBackupData(localData);
    // return { success: true, stats };
    return { success: false, message: "Migration from local is disabled."}
}

