'use server';

import { adminDb } from '@/firebase/server-config';
import fs from 'fs/promises';
import path from 'path';
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
} from 'firebase/firestore';
import { startOfMonth } from 'date-fns';

import { v4 as uuidv4 } from 'uuid';
import { isSaturday, isSunday } from 'date-fns';

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

async function getSettingsDoc<T>(docId: string, defaultVal: T): Promise<T> {
  const docRef = doc(adminDb, 'settings', docId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as T;
  }
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

async function updateCatalog<T extends { id: string }>(collectionName: string, items: T[], logAction: string) {
  const batch = writeBatch(adminDb);
  const collRef = collection(adminDb, collectionName);

  const snapshot = await getDocs(collRef);
  const existingIds = new Set(snapshot.docs.map(doc => doc.id));
  const incomingIds = new Set();

  items.forEach(item => {
      let docId = item.id;
      if (item.id.startsWith('new-')) {
          docId = uuidv4();
          item.id = docId; // Mutate the item to reflect its new ID for caller
      }
      incomingIds.add(docId);

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
  await logActivity(logAction, `Se actualizó el catálogo de ${collectionName}.`);
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

async function logActivity(action: string, details: string) {
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

export async function getAnnouncements(): Promise<string[]> {
    const data = await getSettingsDoc<{ messages: string[] }>('announcements', { messages: [] });
    return data.messages;
}

export async function updateAnnouncements(newAnnouncements: string[]) {
    await logActivity('Actualización de Avisos', `Avisos actualizados.`);
    return setSettingsDoc('announcements', { messages: newAnnouncements.slice(0, 4) });
}

export async function getModuleSettings(): Promise<ModuleSettings> {
    const defaults = {
        citasMedicasEnabled: true,
        laboratorioEnabled: false,
        rayosXEnabled: false,
        ultrasoundEnabled: false,
        vacunasEnabled: false,
    };
    const settings = await getSettingsDoc<ModuleSettings>('moduleSettings', defaults);
    return { ...defaults, ...settings };
}

export async function updateModuleSettings(settings: ModuleSettings) {
    await logActivity('Actualización de Módulos', `Configuración de módulos actualizada.`);
    return setSettingsDoc('moduleSettings', settings);
}

export async function getLabSettings(): Promise<LabSettings> { return getSettingsDoc<LabSettings>('labSettings', { dailySlots: 10, weekendBookingEnabled: false, password: '' }); }
export async function updateLabSettings(settings: LabSettings) {
    await logActivity('Actualización Configuración Laboratorio', `Ajustes del laboratorio actualizados.`);
    return setSettingsDoc('labSettings', settings);
}

export async function getXRaySettings(): Promise<XRaySettings> { return getSettingsDoc<XRaySettings>('xraySettings', { dailySlots: 10, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false, password: '' }); }
export async function updateXRaySettings(settings: XRaySettings) {
    await logActivity('Actualización Configuración Rayos X', `Ajustes de Rayos X actualizados.`);
    return setSettingsDoc('xraySettings', settings);
}

export async function getUltrasoundSettings(): Promise<UltrasoundSettings> { return getSettingsDoc<UltrasoundSettings>('ultrasoundSettings', { dailySlots: 10, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false, password: '' }); }
export async function updateUltrasoundSettings(settings: UltrasoundSettings) {
    await logActivity('Actualización Configuración Ultrasonido', `Ajustes de Ultrasonido actualizados.`);
    return setSettingsDoc('ultrasoundSettings', settings);
}

export async function getVaccineSettings(): Promise<VaccineSettings> { return getSettingsDoc<VaccineSettings>('vaccineSettings', { dailySlots: 20, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false, password: '' }); }
export async function updateVaccineSettings(settings: VaccineSettings) {
    await logActivity('Actualización Configuración Vacunación', `Ajustes de Vacunación actualizados.`);
    return setSettingsDoc('vaccineSettings', settings);
}

// =====================================================================
// CATALOGS
// =====================================================================

export async function getClinics(): Promise<Clinic[]> { return getCatalog<Clinic>('clinics'); }
export async function updateClinics(clinics: Clinic[]) { return updateCatalog<Clinic>('clinics', clinics, 'Actualización de Clínicas'); }

export async function getColonias(): Promise<Colonia[]> { return getCatalog<Colonia>('colonias'); }
export async function updateColonias(colonias: Colonia[]) { return updateCatalog<Colonia>('colonias', colonias, 'Actualización de Colonias'); }

export async function getUsers(): Promise<User[]> { return getCatalog<User>('users'); }
export async function updateUsers(users: User[]) { return updateCatalog<User>('users', users, 'Actualización de Usuarios'); }

export async function getLabStudies(): Promise<LabStudy[]> { return getCatalog<LabStudy>('labStudies'); }
export async function updateLabStudies(studies: LabStudy[]) { return updateCatalog<LabStudy>('labStudies', studies, 'Actualización Estudios de Laboratorio'); }

export async function getXRayStudies(): Promise<XRayStudy[]> { return getCatalog<XRayStudy>('xrayStudies'); }
export async function updateXRayStudies(studies: XRayStudy[]) { return updateCatalog<XRayStudy>('xrayStudies', studies, 'Actualización Estudios de Rayos X'); }

export async function getUltrasoundStudies(): Promise<UltrasoundStudy[]> { return getCatalog<UltrasoundStudy>('ultrasoundStudies'); }
export async function updateUltrasoundStudies(studies: UltrasoundStudy[]) { return updateCatalog<UltrasoundStudy>('ultrasoundStudies', studies, 'Actualización Estudios de Ultrasonido'); }

export async function getVaccines(): Promise<Vaccine[]> { return getCatalog<Vaccine>('vaccines'); }
export async function updateVaccines(vaccines: Vaccine[]) { return updateCatalog<Vaccine>('vaccines', vaccines, 'Actualización de Vacunas'); }


// =====================================================================
// CORE DATA LOGIC
// =====================================================================

export async function getPatientByCURP(curp: string): Promise<Patient | null> {
  const q = query(collection(adminDb, 'patients'), where('curp', '==', curp.toUpperCase()), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { ...doc.data(), id: doc.id } as Patient;
}

export async function getAppointments(): Promise<Appointment[]> {
    const snapshot = await getDocs(query(collection(adminDb, 'appointments'), orderBy('date', 'desc')));
    return enrichAppointmentsWithPatientData(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
}

export async function getLabAppointments(): Promise<LabAppointment[]> {
    const snapshot = await getDocs(query(collection(adminDb, 'labAppointments'), orderBy('date', 'desc')));
    return enrichAppointmentsWithPatientData(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
}

export async function getXRayAppointments(): Promise<XRayAppointment[]> {
    const snapshot = await getDocs(query(collection(adminDb, 'xrayAppointments'), orderBy('date', 'desc')));
    return enrichAppointmentsWithPatientData(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
}

export async function getUltrasoundAppointments(): Promise<UltrasoundAppointment[]> {
    const snapshot = await getDocs(query(collection(adminDb, 'ultrasoundAppointments'), orderBy('date', 'desc')));
    return enrichAppointmentsWithPatientData(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
}

export async function getVaccineAppointments(): Promise<VaccineAppointment[]> {
    const snapshot = await getDocs(query(collection(adminDb, 'vaccineAppointments'), orderBy('date', 'desc')));
    return enrichAppointmentsWithPatientData(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
}

export async function getAppointmentsForClinic(clinicId: string): Promise<Appointment[]> {
  const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', clinicId));
  const snapshot = await getDocs(q);
  return enrichAppointmentsWithPatientData(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
}

async function saveAppointmentBase(collectionName: string, appointmentData: any, patientData: Omit<Patient, 'id'>, logAction: string, validationFn: (transaction: any, date: Date, clinicId?: string) => Promise<void>) {
    return await runTransaction(adminDb, async (transaction) => {
        const { id, patient, ...newAppointmentData } = appointmentData;
        const date = new Date(newAppointmentData.date);

        await validationFn(transaction, date, newAppointmentData.clinicId);

        let patientRef;
        const patientsRef = collection(adminDb, 'patients');
        const q = query(patientsRef, where('curp', '==', patientData.curp.toUpperCase()), limit(1));
        const patientSnap = await transaction.get(q);

        if (!patientSnap.empty) {
            patientRef = patientSnap.docs[0].ref;
            transaction.update(patientRef, patientData);
        } else {
            patientRef = doc(patientsRef, uuidv4());
            transaction.set(patientRef, patientData);
        }

        const appointmentRef = doc(collection(adminDb, collectionName));
        transaction.set(appointmentRef, { ...newAppointmentData, patientId: patientRef.id, status: 'Agendada' });
        
        await logActivity(logAction, `Folio ${newAppointmentData.appointmentNumber} para ${patientData.name}.`);

        const clinic = newAppointmentData.clinicId ? await getDoc(doc(adminDb, 'clinics', newAppointmentData.clinicId)).then(d => d.data() as Clinic) : undefined;
        const finalAppointment = { ...newAppointmentData, id: appointmentRef.id, patientId: patientRef.id, patient: { id: patientRef.id, ...patientData}, status: 'Agendada' };
        
        return { appointment: finalAppointment, clinic };
    });
}

export async function saveAppointment(appointmentData: Omit<Appointment, 'id'|'patient'|'patientId'|'status'>, patientData: Omit<Patient, 'id'>): Promise<{appointment: Appointment, clinic: Clinic}> {
    return saveAppointmentBase('appointments', appointmentData, patientData, 'Creación Cita Médica', async (transaction, date, clinicId) => {
        if (!clinicId) throw new Error("Clínica no proporcionada.");
        
        const clinicRef = doc(adminDb, 'clinics', clinicId);
        const clinicSnap = await transaction.get(clinicRef);
        if (!clinicSnap.exists()) throw new Error("La clínica no existe.");
        const clinic = clinicSnap.data() as Clinic;

        const dayOfWeek = date.getUTCDay();
        const dateString = date.toISOString().split('T')[0];
        const dayOfWeekMap: { [key: string]: number } = { "Domingo": 0, "Lunes": 1, "Martes": 2, "Miércoles": 3, "Jueves": 4, "Viernes": 5, "Sábado": 6 };

        if (clinic.dayOfAction && clinic.dayOfAction !== 'Ninguno' && dayOfWeekMap[clinic.dayOfAction] === dayOfWeek) throw new Error(`El ${clinic.dayOfAction} es día de acción y no se pueden agendar citas.`);
        if (clinic.unavailableDates?.includes(dateString)) throw new Error('La fecha seleccionada no está disponible (día inhábil).');
        if ((isSaturday(date) || isSunday(date)) && !clinic.weekendBookingEnabled) throw new Error('No se permiten citas en fin de semana para este núcleo.');

        const startOfDay = Timestamp.fromDate(new Date(date.setUTCHours(0, 0, 0, 0)));
        const endOfDay = Timestamp.fromDate(new Date(date.setUTCHours(23, 59, 59, 999)));

        const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', clinicId), where('date', '>=', startOfDay), where('date', '<=', endOfDay));
        const appointmentsSnap = await transaction.get(q);

        if (appointmentsSnap.size >= clinic.dailySlots) throw new Error("No hay más cupos disponibles en este núcleo para la fecha seleccionada.");
        if (appointmentsSnap.docs.some(d => d.data().time === appointmentData.time)) throw new Error(`El horario de ${appointmentData.time} ya no está disponible.`);
    });
}

export async function saveLabAppointment(appointmentData: any, patientData: any, settings: { dailySlots: number, weekendBookingEnabled: boolean }) { 
    return saveAppointmentBase('labAppointments', appointmentData, patientData, 'Creación Cita Laboratorio', async (transaction, date) => {
        const isWeekend = isSaturday(date) || isSunday(date);
        if (isWeekend && !settings.weekendBookingEnabled) throw new Error("No se permiten citas en fin de semana para laboratorio.");
        
        const startOfDay = Timestamp.fromDate(new Date(date.setUTCHours(0, 0, 0, 0)));
        const endOfDay = Timestamp.fromDate(new Date(date.setUTCHours(23, 59, 59, 999)));

        const q = query(collection(adminDb, 'labAppointments'), where('date', '>=', startOfDay), where('date', '<=', endOfDay));
        const appointmentsSnap = await transaction.get(q);

        if (appointmentsSnap.size >= settings.dailySlots) throw new Error("No hay más cupos disponibles para laboratorio en la fecha seleccionada.");
    }); 
}
export async function saveXRayAppointment(appointmentData: any, patientData: any) { return saveAppointmentBase('xrayAppointments', appointmentData, patientData, 'Creación Cita Rayos X', async () => {}); }
export async function saveUltrasoundAppointment(appointmentData: any, patientData: any) { return saveAppointmentBase('ultrasoundAppointments', appointmentData, patientData, 'Creación Cita Ultrasonido', async () => {}); }
export async function saveVaccineAppointment(appointmentData: any, patientData: any) { return saveAppointmentBase('vaccineAppointments', appointmentData, patientData, 'Creación Cita Vacunación', async () => {}); }

async function deleteDocAndLog(collectionName: string, id: string, logAction: string) {
    const docRef = doc(adminDb, collectionName, id);
    const docSnap = await getDoc(docRef);
    if(docSnap.exists()){
        const data = docSnap.data();
        await deleteDoc(docRef);
        await logActivity(logAction, `Se eliminó el folio: ${data.appointmentNumber}.`);
    }
}

export async function deleteAppointment(id: string) { await deleteDocAndLog('appointments', id, 'Eliminación Cita Médica'); }
export async function deleteLabAppointment(id: string) { await deleteDocAndLog('labAppointments', id, 'Eliminación Cita Laboratorio'); }
export async function deleteXRayAppointment(id: string) { await deleteDocAndLog('xrayAppointments', id, 'Eliminación Cita Rayos X'); }
export async function deleteUltrasoundAppointment(id: string) { await deleteDocAndLog('ultrasoundAppointments', id, 'Eliminación Cita Ultrasonido'); }
export async function deleteVaccineAppointment(id: string) { await deleteDocAndLog('vaccineAppointments', id, 'Eliminación Cita Vacunación'); }

export async function updatePatient(patientId: string, patientData: Partial<Omit<Patient, 'id'>>) {
    const patientRef = doc(adminDb, 'patients', patientId);
    await updateDoc(patientRef, patientData);
    await logActivity('Actualización de Paciente', `Datos del paciente con ID ${patientId} actualizados.`);
    return { success: true };
}

export async function updateAppointmentStatus(appointmentId: string, status: AppointmentStatus, type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine'): Promise<{ success: boolean; message?: string }> {
    const collectionName = type === 'medical' ? 'appointments' : `${type}Appointments`;
    const docRef = doc(adminDb, collectionName, appointmentId);
    await updateDoc(docRef, { status });
    await logActivity('Actualización de Estado', `Cita en ${collectionName} con ID ${appointmentId} actualizada a: ${status}.`);
    return { success: true };
}

export async function rescheduleAppointment(appointmentId: string, newDate: string, type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine'): Promise<{ success: boolean; message: string; newTime?: string }> {
    const collectionName = type === 'medical' ? 'appointments' : `${type}Appointments`;
    const docRef = doc(adminDb, collectionName, appointmentId);
    await updateDoc(docRef, { date: Timestamp.fromDate(new Date(newDate)), status: 'Agendada' });
    await logActivity('Cambio de Fecha Cita', `Cita ${appointmentId} movida a ${newDate}.`);
    return { success: true, message: 'Fecha de la cita actualizada.' };
}

export async function cloneAppointment(originalAppointmentId: string, newDate: string, type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine'): Promise<{ success: boolean; message: string; data?: any }> {
    const collectionName = type === 'medical' ? 'appointments' : `${type}Appointments`;
    const docRef = doc(adminDb, collectionName, originalAppointmentId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error('Cita original no encontrada.');

    const originalAppointment = docSnap.data();
    const patientDoc = await getDoc(doc(adminDb, 'patients', originalAppointment.patientId));
    if (!patientDoc.exists()) throw new Error('Paciente no encontrado.');

    const patientData = patientDoc.data() as Omit<Patient, 'id'>;
    const { id, patientId, date, status, ...payload } = originalAppointment;
    
    const newAppointmentData = { ...payload, date: Timestamp.fromDate(new Date(newDate)) };
    
    let result: any;
    if (type === 'medical') result = await saveAppointment(newAppointmentData, patientData);
    else if (type === 'lab') {
        const settings = await getLabSettings();
        result = await saveLabAppointment(newAppointmentData, patientData, settings);
    }
    else if (type === 'xray') result = await saveXRayAppointment(newAppointmentData, patientData);
    else if (type === 'ultrasound') result = await saveUltrasoundAppointment(newAppointmentData, patientData);
    else if (type === 'vaccine') result = await saveVaccineAppointment(newAppointmentData, patientData);
    else throw new Error('Tipo de cita no válido.');

    await logActivity('Clonación de Cita', `Folio original ${originalAppointment.appointmentNumber} clonado a nuevo folio ${result.appointment.appointmentNumber}.`);
    return { success: true, message: `Nueva cita asignada con folio ${result.appointment.appointmentNumber}`, data: result.appointment };
}

// Passwords
export async function verifyClinicPassword(clinicId: string, passwordAttempt: string): Promise<{ isValid: boolean; error?: string }> { 
    const clinic = await getDoc(doc(adminDb, 'clinics', clinicId)).then(d => d.data() as Clinic);
    if (!clinic) return { isValid: false, error: 'La clínica no existe.' }; 
    return { isValid: clinic.password === passwordAttempt }; 
}
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
    const collectionsMap: { [key: string]: string } = {
        'appointments': 'appointments',
        'labAppointments': 'labAppointments',
        'xRayAppointments': 'xrayAppointments',
        'ultrasoundAppointments': 'ultrasoundAppointments',
        'vaccineAppointments': 'vaccineAppointments',
        'patients': 'patients',
        'clinics': 'clinics',
    };

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
                // Convert date strings back to Timestamps if they exist
                if (data.date) data.date = Timestamp.fromDate(new Date(data.date));
                batch.set(doc(collRef, id), data);
                addedCount++;
            }
        }
        await batch.commit();
    }
    
    await logActivity('Restauración de Respaldo', `Se restauraron un total de ${addedCount} registros.`);
    return { addedCount };
}
  
export async function runDataMigration() {
  const dataDir = path.join(process.cwd(), 'src', 'lib', 'data');
  const stats = {
    clinics: 0,
    colonias: 0,
    patients: 0,
    appointments: 0,
    labAppointments: 0,
    xRayAppointments: 0,
    ultrasoundAppointments: 0,
    vaccineAppointments: 0,
    labStudies: 0,
    xrayStudies: 0,
    ultrasoundStudies: 0,
    vaccines: 0,
    users: 0,
  };

  type StatsKeys = keyof typeof stats;

  const migrateCollection = async (fileName: string, collectionName: string, statsKey: StatsKeys) => {
    try {
      const filePath = path.join(dataDir, fileName);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const items = JSON.parse(fileContent);

      if (!Array.isArray(items) || items.length === 0) return;
      
      const collRef = collection(adminDb, collectionName);
      const existingDocs = await getDocs(collRef);
      const existingIds = new Set(existingDocs.docs.map(d => d.id));

      const batch = writeBatch(adminDb);
      let newDocs = 0;

      for (const item of items) {
        if (!item.id || existingIds.has(item.id)) continue;
        
        const { id, ...data } = item;
        
        if (data.date) {
          data.date = Timestamp.fromDate(new Date(data.date));
        }

        batch.set(doc(collRef, id), data);
        newDocs++;
      }

      await batch.commit();
      stats[statsKey] = newDocs;
    } catch (error) {
      console.error(`Error migrating ${fileName}:`, error);
    }
  };
  
  const migrateSettingsDoc = async (fileName: string, docId: string) => {
    try {
        const filePath = path.join(dataDir, fileName);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(fileContent);
        const docRef = doc(adminDb, 'settings', docId);
        await setDoc(docRef, data, { merge: true });
    } catch (error) {
        console.error(`Error migrating settings file ${fileName}:`, error);
    }
  };

  // Run migrations for collections
  await migrateCollection('clinics.json', 'clinics', 'clinics');
  await migrateCollection('colonias.json', 'colonias', 'colonias');
  await migrateCollection('patients.json', 'patients', 'patients');
  await migrateCollection('appointments.json', 'appointments', 'appointments');
  await migrateCollection('lab-appointments.json', 'labAppointments', 'labAppointments');
  await migrateCollection('x-ray-appointments.json', 'xrayAppointments', 'xRayAppointments');
  await migrateCollection('ultrasound-appointments.json', 'ultrasoundAppointments', 'ultrasoundAppointments');
  await migrateCollection('vaccine-appointments.json', 'vaccineAppointments', 'vaccineAppointments');
  await migrateCollection('users.json', 'users', 'users');
  
  // Run migrations for catalogs (which are also collections)
  await migrateCollection('lab-studies.json', 'labStudies', 'labStudies');
  await migrateCollection('x-ray-studies.json', 'xrayStudies', 'xrayStudies');
  await migrateCollection('ultrasound-studies.json', 'ultrasoundStudies', 'ultrasoundStudies');
  await migrateCollection('vaccines.json', 'vaccines', 'vaccines');
  
  // Run migrations for settings documents
  await migrateSettingsDoc('announcements.json', 'announcements');
  await migrateSettingsDoc('lab-settings.json', 'labSettings');
  await migrateSettingsDoc('x-ray-settings.json', 'xraySettings');
  await migrateSettingsDoc('ultrasound-settings.json', 'ultrasoundSettings');
  await migrateSettingsDoc('vaccine-settings.json', 'vaccineSettings');
  await migrateSettingsDoc('module-settings.json', 'moduleSettings');

  await logActivity('Migración de Datos', `Se migraron datos de archivos JSON a Firestore. Estadísticas: ${JSON.stringify(stats)}`);

  return { success: true, stats };
}


export async function cleanupOldRecords() {
    let totalDeleted = 0;
    const collectionsToClean = [
        'appointments',
        'labAppointments',
        'xrayAppointments',
        'ultrasoundAppointments',
        'vaccineAppointments'
    ];

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

    if (totalDeleted > 0) {
        await logActivity('Limpieza de Registros', `Se eliminaron ${totalDeleted} citas antiguas de meses anteriores.`);
    }
    
    return { deletedCount: totalDeleted };
}
