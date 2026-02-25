'use server';

import { 
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
  documentId,
  addDoc
} from 'firebase/firestore';
import { adminDb } from '@/firebase/server-config';
import { v4 as uuidv4 } from 'uuid';

import type {
  Appointment,
  AppointmentStatus,
  Clinic,
  Colonia,
  LabAppointment,
  LabSettings,
  LabStudy,
  Patient,
  UltrasoundAppointment,
  UltrasoundSettings,
  UltrasoundStudy,
  XRayAppointment,
  XRaySettings,
  XRayStudy,
  ModuleSettings,
  Vaccine,
  VaccineSettings,
  VaccineAppointment,
  User,
  ActivityLog,
  ArchiveSettings,
  PatientStatus,
} from './definitions';
import { BookingMode, PatientStatus as PatientStatusEnum } from './definitions';

// =====================================================================
// UTILS & SERIALIZATION
// =====================================================================

function serializeData(data: any): any {
  if (data === null || data === undefined) return data;

  if (data instanceof Timestamp || (data && typeof data.toDate === 'function')) {
    return data.toDate().toISOString();
  }

  if (Array.isArray(data)) {
    return data.map(item => serializeData(item));
  }

  if (typeof data === 'object' && data !== null && !(data instanceof Date)) {
    const serialized: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        serialized[key] = serializeData(data[key]);
      }
    }
    return serialized;
  }

  return data;
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  if (!array) return chunks;
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function getSettingsDoc<T>(docId: string, defaultVal: T): Promise<T> {
  if (!adminDb) return defaultVal;
  const docRef = doc(adminDb, 'settings', docId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? serializeData(docSnap.data()) as T : defaultVal;
}

async function setSettingsDoc(docId: string, data: any) {
  if (!adminDb) return { success: false };
  await setDoc(doc(adminDb, 'settings', docId), data, { merge: true });
  return { success: true };
}

export async function logActivity(action: string, details: string) {
  if (!adminDb) return;
  try {
    await addDoc(collection(adminDb, 'activityLog'), { 
      action, 
      details, 
      timestamp: Timestamp.now() 
    });
  } catch (e) {
    console.error("Failed to log activity:", e);
  }
}

// =====================================================================
// PATIENTS
// =====================================================================

export async function getPatientByCURP(curp: string): Promise<Patient | null> {
  if (!adminDb || !curp) return null;
  try {
    const q = query(collection(adminDb, 'patients'), where('curp', '==', curp.toUpperCase().trim()), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return serializeData({ id: snap.docs[0].id, ...snap.docs[0].data() }) as Patient;
  } catch (e) {
    return null;
  }
}

export async function getPatients(): Promise<Patient[]> {
  if (!adminDb) return [];
  try {
    const snap = await getDocs(query(collection(adminDb, 'patients'), limit(30000)));
    return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Patient);
  } catch (e) {
    return [];
  }
}

export async function savePatient(patient: Omit<Patient, 'id'>, id?: string) {
  if (!adminDb) return { success: false };
  try {
    const docId = id || uuidv4();
    const dataToSave = { 
      ...patient, 
      status: patient.status || PatientStatusEnum.Vigente,
      updatedAt: Timestamp.now()
    };
    await setDoc(doc(adminDb, 'patients', docId), dataToSave, { merge: true });
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function updatePatient(id: string, data: Partial<Omit<Patient, 'id'>>) {
  if (!adminDb) return { success: false };
  try {
    await updateDoc(doc(adminDb, 'patients', id), { ...data, updatedAt: Timestamp.now() });
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function deletePatient(id: string) {
  if (!adminDb) return { success: false };
  try {
    await deleteDoc(doc(adminDb, 'patients', id));
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function deletePatients(ids: string[]) {
  if (!adminDb || !ids || ids.length === 0) return { success: true };
  try {
    const chunks = chunkArray(ids, 500); 
    for (const chunk of chunks) {
      const batch = writeBatch(adminDb);
      chunk.forEach(id => batch.delete(doc(adminDb, 'patients', id)));
      await batch.commit();
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function updatePatientStatus(id: string, status: PatientStatus) {
  if (!adminDb) return { success: false };
  try {
    await updateDoc(doc(adminDb, 'patients', id), { status, updatedAt: Timestamp.now() });
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

// =====================================================================
// APPOINTMENTS
// =====================================================================

async function enrichWithPatientData(apps: any[]): Promise<any[]> {
  if (!adminDb || !apps || apps.length === 0) return apps;
  
  const patientIds = Array.from(new Set(apps.map(a => a.patientId).filter(id => id && typeof id === 'string')));
  if (patientIds.length === 0) return apps.map(a => serializeData(a));

  const patientsMap: Record<string, Patient> = {};
  const chunks = chunkArray(patientIds, 10); 

  for (const batch of chunks) {
    const q = query(collection(adminDb, 'patients'), where(documentId(), 'in', batch));
    const snap = await getDocs(q);
    snap.forEach(d => {
      patientsMap[d.id] = serializeData({ id: d.id, ...d.data() }) as Patient;
    });
  }

  return apps.map(app => serializeData({
    ...app,
    patient: patientsMap[app.patientId] || null
  }));
}

export async function getAppointments(): Promise<Appointment[]> {
  if (!adminDb) return [];
  try {
    const snap = await getDocs(query(collection(adminDb, 'appointments'), orderBy('date', 'desc'), limit(2000)));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return await enrichWithPatientData(data) as Appointment[];
  } catch (e) {
    return [];
  }
}

export async function getAppointmentsForClinic(clinicId: string): Promise<Appointment[]> {
  if (!adminDb) return [];
  try {
    const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', clinicId), limit(2000));
    const snap = await getDocs(q);
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    data.sort((a: any, b: any) => (b.date as Timestamp).toMillis() - (a.date as Timestamp).toMillis());
    return await enrichWithPatientData(data) as Appointment[];
  } catch (e) {
    return [];
  }
}

export async function getLabAppointments(): Promise<LabAppointment[]> {
  if (!adminDb) return [];
  try {
    const snap = await getDocs(query(collection(adminDb, 'labAppointments'), orderBy('date', 'desc'), limit(2000)));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return await enrichWithPatientData(data) as LabAppointment[];
  } catch (e) {
    return [];
  }
}

export async function getXRayAppointments(): Promise<XRayAppointment[]> {
  if (!adminDb) return [];
  try {
    const snap = await getDocs(query(collection(adminDb, 'xrayAppointments'), orderBy('date', 'desc'), limit(2000)));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return await enrichWithPatientData(data) as XRayAppointment[];
  } catch (e) {
    return [];
  }
}

export async function getUltrasoundAppointments(): Promise<UltrasoundAppointment[]> {
  if (!adminDb) return [];
  try {
    const snap = await getDocs(query(collection(adminDb, 'ultrasoundAppointments'), orderBy('date', 'desc'), limit(2000)));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return await enrichWithPatientData(data) as UltrasoundAppointment[];
  } catch (e) {
    return [];
  }
}

export async function getVaccineAppointments(): Promise<VaccineAppointment[]> {
  if (!adminDb) return [];
  try {
    const snap = await getDocs(query(collection(adminDb, 'vaccineAppointments'), orderBy('date', 'desc'), limit(2000)));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return await enrichWithPatientData(data) as VaccineAppointment[];
  } catch (e) {
    return [];
  }
}

async function validateDailyDuplicate(collectionName: string, patientId: string, isoDate: string) {
  try {
    // IMPORTANTE: Realizamos el filtro de fecha en memoria para evitar el error de "Index Required" de Firebase
    const selectedDate = new Date(isoDate);
    const dayString = selectedDate.toISOString().split('T')[0];
    
    // Solo filtramos por patientId en Firestore
    const q = query(collection(adminDb, collectionName), where('patientId', '==', patientId));
    const snap = await getDocs(q);
    
    if (snap.empty) return false;
    
    // El filtro de fecha se hace aquí en el servidor
    return snap.docs.some(doc => {
      const d = doc.data();
      if (!d.date) return false;
      const appDateStr = (d.date as Timestamp).toDate().toISOString().split('T')[0];
      return appDateStr === dayString;
    });
  } catch (e) {
    console.error("Duplicate validation error:", e);
    return false;
  }
}

export async function saveAppointment(appointmentData: any, patientInput: any, coloniaName?: string) {
  if (!adminDb) return { success: false, error: 'DB no conectada' };
  try {
    const curp = String(patientInput.curp).toUpperCase().trim();
    const existingPatient = await getPatientByCURP(curp);
    
    if (existingPatient && !curp.startsWith('RN-')) {
      const isDuplicate = await validateDailyDuplicate('appointments', existingPatient.id, appointmentData.date);
      if (isDuplicate) return { success: false, error: `El paciente ya tiene una cita médica para este día.` };
    }

    const batch = writeBatch(adminDb);
    let patientId = existingPatient ? existingPatient.id : uuidv4();
    
    const cleanPatient = {
      curp,
      name: String(patientInput.name || '').toUpperCase().trim(),
      paternalLastName: String(patientInput.paternalLastName || '').toUpperCase().trim(),
      maternalLastName: String(patientInput.maternalLastName || '').toUpperCase().trim(),
      sex: patientInput.sex,
      age: Number(patientInput.age) || 0,
      birthDate: patientInput.birthDate || '',
      birthState: String(patientInput.birthState || '').toUpperCase().trim(),
      phoneNumber: String(patientInput.phoneNumber || '').trim(),
      coloniaName: coloniaName || patientInput.coloniaName || null,
      status: patientInput.status || PatientStatusEnum.Vigente,
      updatedAt: Timestamp.now()
    };

    batch.set(doc(adminDb, 'patients', patientId), { ...cleanPatient, id: patientId }, { merge: true });

    const appRef = doc(collection(adminDb, 'appointments'));
    const appointmentNumber = `FOLIO-${uuidv4().split('-')[0].toUpperCase()}`;
    
    const cleanApp = {
      appointmentNumber,
      patientId,
      clinicId: appointmentData.clinicId,
      date: Timestamp.fromDate(new Date(appointmentData.date)),
      time: String(appointmentData.time),
      patientType: appointmentData.patientType,
      status: 'Agendada',
      coloniaName: coloniaName || null,
      createdAt: Timestamp.now()
    };

    batch.set(appRef, cleanApp);
    await batch.commit();
    
    await logActivity("Nueva Cita Médica", `Folio ${appointmentNumber} para ${cleanPatient.name}`);
    
    const clinic = await getClinicById(appointmentData.clinicId);
    return { success: true, data: serializeData({ appointment: { ...cleanApp, id: appRef.id, patient: { ...cleanPatient, id: patientId } }, clinic }) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function saveLabAppointment(appointmentData: any, patientInput: any) {
  if (!adminDb) return { success: false };
  try {
    const curp = String(patientInput.curp).toUpperCase().trim();
    const existingPatient = await getPatientByCURP(curp);
    
    if (existingPatient && !curp.startsWith('RN-')) {
      const isDuplicate = await validateDailyDuplicate('labAppointments', existingPatient.id, appointmentData.date);
      if (isDuplicate) return { success: false, error: 'Este paciente ya tiene una cita de laboratorio para hoy.' };
    }

    const batch = writeBatch(adminDb);
    const patientId = existingPatient ? existingPatient.id : uuidv4();
    
    const cleanPatient = {
      curp,
      name: String(patientInput.name || '').toUpperCase().trim(),
      paternalLastName: String(patientInput.paternalLastName || '').toUpperCase().trim(),
      maternalLastName: String(patientInput.maternalLastName || '').toUpperCase().trim(),
      sex: patientInput.sex,
      age: Number(patientInput.age) || 0,
      birthState: String(patientInput.birthState || '').toUpperCase().trim(),
      phoneNumber: String(patientInput.phoneNumber || '').trim(),
      updatedAt: Timestamp.now()
    };

    batch.set(doc(adminDb, 'patients', patientId), { ...cleanPatient, id: patientId }, { merge: true });

    const appRef = doc(collection(adminDb, 'labAppointments'));
    const cleanApp = {
      appointmentNumber: appointmentData.appointmentNumber,
      patientId,
      date: Timestamp.fromDate(new Date(appointmentData.date)),
      time: String(appointmentData.time),
      studies: appointmentData.studies,
      status: 'Agendada',
      patientType: appointmentData.patientType,
      createdAt: Timestamp.now()
    };

    batch.set(appRef, cleanApp);
    await batch.commit();
    await logActivity("Nueva Cita Laboratorio", `Folio ${cleanApp.appointmentNumber} para ${cleanPatient.name}`);
    return { success: true, data: serializeData({ ...cleanApp, id: appRef.id, patient: { ...cleanPatient, id: patientId } }) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function saveNewXRayAppointment(appointmentData: any, patientInput: any) {
  if (!adminDb) return { success: false };
  try {
    const curp = String(patientInput.curp).toUpperCase().trim();
    const existingPatient = await getPatientByCURP(curp);
    
    if (existingPatient && !curp.startsWith('RN-')) {
      const isDuplicate = await validateDailyDuplicate('xrayAppointments', existingPatient.id, appointmentData.date);
      if (isDuplicate) return { success: false, error: 'Este paciente ya tiene una cita de Rayos X para hoy.' };
    }

    const batch = writeBatch(adminDb);
    const patientId = existingPatient ? existingPatient.id : uuidv4();
    
    const cleanPatient = {
      curp,
      name: String(patientInput.name || '').toUpperCase().trim(),
      paternalLastName: String(patientInput.paternalLastName || '').toUpperCase().trim(),
      maternalLastName: String(patientInput.maternalLastName || '').toUpperCase().trim(),
      sex: patientInput.sex,
      age: Number(patientInput.age) || 0,
      birthState: String(patientInput.birthState || '').toUpperCase().trim(),
      phoneNumber: String(patientInput.phoneNumber || '').trim(),
      updatedAt: Timestamp.now()
    };

    batch.set(doc(adminDb, 'patients', patientId), { ...cleanPatient, id: patientId }, { merge: true });

    const appRef = doc(collection(adminDb, 'xrayAppointments'));
    const cleanApp = {
      appointmentNumber: appointmentData.appointmentNumber,
      patientId,
      date: Timestamp.fromDate(new Date(appointmentData.date)),
      time: String(appointmentData.time),
      studyId: appointmentData.studyId,
      studyName: appointmentData.studyName,
      status: 'Agendada',
      patientType: appointmentData.patientType,
      createdAt: Timestamp.now()
    };

    batch.set(appRef, cleanApp);
    await batch.commit();
    return { success: true, data: serializeData({ appointment: { ...cleanApp, id: appRef.id, patient: { ...cleanPatient, id: patientId } }, study: { name: appointmentData.studyName, indications: '' } }) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function saveNewUltrasoundAppointment(appointmentData: any, patientInput: any) {
  if (!adminDb) return { success: false };
  try {
    const curp = String(patientInput.curp).toUpperCase().trim();
    const existingPatient = await getPatientByCURP(curp);
    
    if (existingPatient && !curp.startsWith('RN-')) {
      const isDuplicate = await validateDailyDuplicate('ultrasoundAppointments', existingPatient.id, appointmentData.date);
      if (isDuplicate) return { success: false, error: 'Este paciente ya tiene una cita de Ultrasonido para hoy.' };
    }

    const batch = writeBatch(adminDb);
    const patientId = existingPatient ? existingPatient.id : uuidv4();
    
    const cleanPatient = {
      curp,
      name: String(patientInput.name || '').toUpperCase().trim(),
      paternalLastName: String(patientInput.paternalLastName || '').toUpperCase().trim(),
      maternalLastName: String(patientInput.maternalLastName || '').toUpperCase().trim(),
      sex: patientInput.sex,
      age: Number(patientInput.age) || 0,
      birthState: String(patientInput.birthState || '').toUpperCase().trim(),
      phoneNumber: String(patientInput.phoneNumber || '').trim(),
      updatedAt: Timestamp.now()
    };

    batch.set(doc(adminDb, 'patients', patientId), { ...cleanPatient, id: patientId }, { merge: true });

    const appRef = doc(collection(adminDb, 'ultrasoundAppointments'));
    const cleanApp = {
      appointmentNumber: appointmentData.appointmentNumber,
      patientId,
      date: Timestamp.fromDate(new Date(appointmentData.date)),
      time: String(appointmentData.time),
      studyId: appointmentData.studyId,
      studyName: appointmentData.studyName,
      status: 'Agendada',
      patientType: appointmentData.patientType,
      createdAt: Timestamp.now()
    };

    batch.set(appRef, cleanApp);
    await batch.commit();
    return { success: true, data: serializeData({ appointment: { ...cleanApp, id: appRef.id, patient: { ...cleanPatient, id: patientId } }, study: { name: appointmentData.studyName, indications: '' } }) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function saveNewVaccineAppointment(appointmentData: any, patientInput: any) {
  if (!adminDb) return { success: false };
  try {
    const curp = String(patientInput.curp).toUpperCase().trim();
    const existingPatient = await getPatientByCURP(curp);
    
    if (existingPatient && !curp.startsWith('RN-')) {
      const isDuplicate = await validateDailyDuplicate('vaccineAppointments', existingPatient.id, appointmentData.date);
      if (isDuplicate) return { success: false, error: 'Este paciente ya tiene una cita de Vacunación para hoy.' };
    }

    const batch = writeBatch(adminDb);
    const patientId = existingPatient ? existingPatient.id : uuidv4();
    
    const cleanPatient = {
      curp,
      name: String(patientInput.name || '').toUpperCase().trim(),
      paternalLastName: String(patientInput.paternalLastName || '').toUpperCase().trim(),
      maternalLastName: String(patientInput.maternalLastName || '').toUpperCase().trim(),
      sex: patientInput.sex,
      age: Number(patientInput.age) || 0,
      birthState: String(patientInput.birthState || '').toUpperCase().trim(),
      phoneNumber: String(patientInput.phoneNumber || '').trim(),
      updatedAt: Timestamp.now()
    };

    batch.set(doc(adminDb, 'patients', patientId), { ...cleanPatient, id: patientId }, { merge: true });

    const appRef = doc(collection(adminDb, 'vaccineAppointments'));
    const cleanApp = {
      appointmentNumber: appointmentData.appointmentNumber,
      patientId,
      date: Timestamp.fromDate(new Date(appointmentData.date)),
      time: String(appointmentData.time),
      vaccines: appointmentData.vaccines,
      status: 'Agendada',
      patientType: appointmentData.patientType,
      coloniaName: appointmentData.coloniaName || null,
      createdAt: Timestamp.now()
    };

    batch.set(appRef, cleanApp);
    await batch.commit();
    return { success: true, data: serializeData({ ...cleanApp, id: appRef.id, patient: { ...cleanPatient, id: patientId } }) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deleteAppointment(id: string) { if (!adminDb) return ''; await deleteDoc(doc(adminDb, 'appointments', id)); return id; }
export async function deleteLabAppointment(id: string) { if (!adminDb) return ''; await deleteDoc(doc(adminDb, 'labAppointments', id)); return id; }
export async function deleteXRayAppointment(id: string) { if (!adminDb) return ''; await deleteDoc(doc(adminDb, 'xrayAppointments', id)); return id; }
export async function deleteUltrasoundAppointment(id: string) { if (!adminDb) return ''; await deleteDoc(doc(adminDb, 'ultrasoundAppointments', id)); return id; }
export async function deleteVaccineAppointment(id: string) { if (!adminDb) return ''; await deleteDoc(doc(adminDb, 'vaccineAppointments', id)); return id; }

export async function updateAppointmentStatus(id: string, status: AppointmentStatus, type: string) {
  if (!adminDb) return { success: false };
  const collMap: Record<string, string> = { 'medical': 'appointments', 'lab': 'labAppointments', 'xray': 'xrayAppointments', 'ultrasound': 'ultrasoundAppointments', 'vaccine': 'vaccineAppointments' };
  await updateDoc(doc(adminDb, collMap[type] || 'appointments', id), { status });
  return { success: true };
}

// =====================================================================
// SETTINGS
// =====================================================================

export async function getClinics(): Promise<Clinic[]> {
  if (!adminDb) return [];
  try {
    const snap = await getDocs(collection(adminDb, 'clinics'));
    return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Clinic);
  } catch (e) {
    return [];
  }
}

export async function getClinicById(id: string): Promise<Clinic | null> {
  if (!adminDb) return null;
  try {
    const d = await getDoc(doc(adminDb, 'clinics', id));
    return d.exists() ? serializeData({ id: d.id, ...d.data() }) as Clinic : null;
  } catch (e) {
    return null;
  }
}

export async function updateClinics(clinics: Clinic[]) {
  if (!adminDb) return { success: false };
  try {
    const batch = writeBatch(adminDb);
    clinics.forEach(c => batch.set(doc(adminDb, 'clinics', c.id), c));
    await batch.commit();
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function getColonias(): Promise<Colonia[]> {
  if (!adminDb) return [];
  try {
    const snap = await getDocs(collection(adminDb, 'colonias'));
    return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Colonia);
  } catch (e) {
    return [];
  }
}

export async function updateColonias(colonias: Colonia[]) {
  if (!adminDb) return { success: false };
  try {
    const snap = await getDocs(collection(adminDb, 'colonias'));
    const batch = writeBatch(adminDb);
    snap.docs.forEach(d => batch.delete(d.ref));
    colonias.forEach(c => batch.set(doc(adminDb, 'colonias', c.id || uuidv4()), c));
    await batch.commit();
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function getAnnouncements() { return (await getSettingsDoc<{ messages: string[] }>('announcements', { messages: [] })).messages; }
export async function updateAnnouncements(m: string[]) { return setSettingsDoc('announcements', { messages: m.slice(0, 4) }); }

export async function getModuleSettings() { return getSettingsDoc<ModuleSettings>('moduleSettings', { citasMedicasEnabled: true, laboratorioEnabled: true, rayosXEnabled: true, ultrasoundEnabled: true, vacunasEnabled: true, archivoEnabled: true }); }
export async function updateModuleSettings(s: ModuleSettings) { return setSettingsDoc('moduleSettings', s); }

export async function getLabSettings() { return getSettingsDoc<LabSettings>('labSettings', { dailySlots: 10, weekendBookingEnabled: false }); }
export async function updateLabSettings(s: LabSettings) { return setSettingsDoc('labSettings', s); }

export async function getLabStudies() {
  if (!adminDb) return [];
  const snap = await getDocs(collection(adminDb, 'labStudies'));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as LabStudy);
}
export async function updateLabStudies(studies: LabStudy[]) {
  if (!adminDb) return { success: false };
  const snap = await getDocs(collection(adminDb, 'labStudies'));
  const batch = writeBatch(adminDb);
  snap.docs.forEach(d => batch.delete(d.ref));
  studies.forEach(s => batch.set(doc(adminDb, 'labStudies', s.id || uuidv4()), s));
  await batch.commit();
  return { success: true };
}

export async function getXRaySettings() { return getSettingsDoc<XRaySettings>('xraySettings', { dailySlots: 10, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false }); }
export async function updateXRaySettings(s: XRaySettings) { return setSettingsDoc('xraySettings', s); }

export async function getXRayStudies() {
  if (!adminDb) return [];
  const snap = await getDocs(collection(adminDb, 'xrayStudies'));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as XRayStudy);
}
export async function updateXRayStudies(studies: XRayStudy[]) {
  if (!adminDb) return { success: false };
  const snap = await getDocs(collection(adminDb, 'xrayStudies'));
  const batch = writeBatch(adminDb);
  snap.docs.forEach(d => batch.delete(d.ref));
  studies.forEach(s => batch.set(doc(adminDb, 'xrayStudies', s.id || uuidv4()), s));
  await batch.commit();
  return { success: true };
}

export async function getUltrasoundSettings() { return getSettingsDoc<UltrasoundSettings>('ultrasoundSettings', { dailySlots: 10, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false }); }
export async function updateUltrasoundSettings(s: UltrasoundSettings) { return setSettingsDoc('ultrasoundSettings', s); }

export async function getUltrasoundStudies() {
  if (!adminDb) return [];
  const snap = await getDocs(collection(adminDb, 'ultrasoundStudies'));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as UltrasoundStudy);
}
export async function updateUltrasoundStudies(studies: UltrasoundStudy[]) {
  if (!adminDb) return { success: false };
  const snap = await getDocs(collection(adminDb, 'ultrasoundStudies'));
  const batch = writeBatch(adminDb);
  snap.docs.forEach(d => batch.delete(d.ref));
  studies.forEach(s => batch.set(doc(adminDb, 'ultrasoundStudies', s.id || uuidv4()), s));
  await batch.commit();
  return { success: true };
}

export async function getVaccineSettings() { return getSettingsDoc<VaccineSettings>('vaccineSettings', { dailySlots: 20, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false }); }
export async function updateVaccineSettings(s: VaccineSettings) { return setSettingsDoc('vaccineSettings', s); }

export async function getVaccines() {
  if (!adminDb) return [];
  const snap = await getDocs(collection(adminDb, 'vaccines'));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Vaccine);
}
export async function updateVaccines(vaccines: Vaccine[]) {
  if (!adminDb) return { success: false };
  const snap = await getDocs(collection(adminDb, 'vaccines'));
  const batch = writeBatch(adminDb);
  snap.docs.forEach(d => batch.delete(d.ref));
  vaccines.forEach(v => batch.set(doc(adminDb, 'vaccines', v.id || uuidv4()), v));
  await batch.commit();
  return { success: true };
}

export async function getUsers(): Promise<User[]> {
  if (!adminDb) return [];
  const snap = await getDocs(collection(adminDb, 'users'));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as User);
}
export async function updateUsers(users: User[]) {
  if (!adminDb) return { success: false };
  const batch = writeBatch(adminDb);
  users.forEach(u => batch.set(doc(adminDb, 'users', u.id), u));
  await batch.commit();
  return { success: true };
}

export async function getArchiveSettings() { return getSettingsDoc<ArchiveSettings>('archiveSettings', { password: '' }); }
export async function updateArchiveSettings(s: ArchiveSettings) { return setSettingsDoc('archiveSettings', s); }

export async function verifyArchivePassword(p: string) { const s = await getArchiveSettings(); return { success: s.password === p }; }
export async function verifyClinicPassword(id: string, p: string) { const c = await getClinicById(id); return { success: c?.password === p }; }
export async function verifyLabPassword(p: string) { const s = await getLabSettings(); return { success: s.password === p }; }
export async function verifyXRayPassword(p: string) { const s = await getXRaySettings(); return { success: s.password === p }; }
export async function verifyUltrasoundPassword(p: string) { const s = await getUltrasoundSettings(); return { success: s.password === p }; }
export async function verifyVaccinePassword(p: string) { const s = await getVaccineSettings(); return { success: s.password === p }; }

export async function getLogs(): Promise<ActivityLog[]> {
  if (!adminDb) return [];
  const snap = await getDocs(query(collection(adminDb, 'activityLog'), orderBy('timestamp', 'desc'), limit(500)));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as ActivityLog);
}

// =====================================================================
// MAINTENANCE
// =====================================================================

export async function findDuplicatePatients(criteria: 'expediente' | 'curp' | 'name'): Promise<Patient[][]> {
  if (!adminDb) return [];
  const snap = await getDocs(query(collection(adminDb, 'patients'), limit(5000)));
  const all = snap.docs.map(doc => {
    const d = doc.data();
    return { id: doc.id, name: String(d.name || '').toUpperCase().trim(), paternalLastName: String(d.paternalLastName || '').toUpperCase().trim(), maternalLastName: String(d.maternalLastName || '').toUpperCase().trim(), curp: String(d.curp || '').toUpperCase().trim(), expediente: d.expediente ? String(d.expediente).trim() : '', phoneNumber: String(d.phoneNumber || '') };
  });
  const map = new Map<string, any[]>();
  all.forEach(p => {
    let key = '';
    if (criteria === 'expediente') key = p.expediente;
    else if (criteria === 'curp') key = (p.curp && !p.curp.startsWith('RN-')) ? p.curp : '';
    else key = `${p.name} ${p.paternalLastName} ${p.maternalLastName}`.trim();
    if (key && key !== 'N/A' && key !== '') {
      const group = map.get(key) || [];
      group.push(p);
      map.set(key, group);
    }
  });
  return Array.from(map.values()).filter(g => g.length > 1).slice(0, 300);
}

export async function bulkUpdateStatusChunk(expedientes: string[], status: PatientStatus) {
  if (!adminDb || !expedientes || expedientes.length === 0) return { success: true, count: 0 };
  
  const results: any[] = [];
  const cleanExpedientes = expedientes.map(e => e.toString().trim());
  
  const chunkSize = 10;
  for (let i = 0; i < cleanExpedientes.length; i += chunkSize) {
    const subset = cleanExpedientes.slice(i, i + chunkSize);
    const variations: string[] = [];
    subset.forEach(e => {
      const clean = e.replace(/^0+/, '');
      variations.push(clean);
      variations.push('0' + clean);
      variations.push('00' + clean);
      variations.push('000' + clean);
      variations.push('0000' + clean);
      variations.push('00000' + clean);
    });
    
    const varChunks = chunkArray(Array.from(new Set(variations)), 30);
    for (const vChunk of varChunks) {
      const q = query(collection(adminDb, 'patients'), where('expediente', 'in', vChunk));
      const snap = await getDocs(q);
      snap.docs.forEach(d => results.push(d));
    }
  }

  const uniqueMatches = Array.from(new Map(results.map(d => [d.id, d])).values());

  if (uniqueMatches.length > 0) {
    const updateChunks = chunkArray(uniqueMatches, 500);
    for (const chunk of updateChunks) {
      const batch = writeBatch(adminDb);
      chunk.forEach(d => batch.update(d.ref, { status, updatedAt: Timestamp.now() }));
      await batch.commit();
    }
    await logActivity("Actualización Masiva", `Se actualizaron ${uniqueMatches.length} registros a ${status}`);
  }
  
  return { success: true, count: uniqueMatches.length };
}

// =====================================================================
// DATA MANAGEMENT
// =====================================================================

export async function createBackupData() {
  if (!adminDb) return null;
  const collections = ['patients', 'appointments', 'labAppointments', 'xrayAppointments', 'ultrasoundAppointments', 'vaccineAppointments', 'clinics'];
  const data: any = {};
  for (const col of collections) {
    const snap = await getDocs(collection(adminDb, col));
    data[col] = snap.docs.map(d => serializeData({ id: d.id, ...d.data() }));
  }
  return data;
}

export async function cleanupOldRecords() {
  if (!adminDb) return { success: false, deletedCount: 0 };
  const lastMonth = new Date(); lastMonth.setMonth(lastMonth.getMonth() - 1);
  const cutoff = Timestamp.fromDate(lastMonth);
  const collections = ['appointments', 'labAppointments', 'xrayAppointments', 'ultrasoundAppointments', 'vaccineAppointments'];
  let total = 0;
  for (const col of collections) {
    const q = query(collection(adminDb, col), where('date', '<', cutoff));
    const snap = await getDocs(q);
    if (!snap.empty) {
        const batch = writeBatch(adminDb);
        snap.docs.forEach(d => { batch.delete(d.ref); total++; });
        await batch.commit();
    }
  }
  return { success: true, deletedCount: total };
}

export async function bulkInsertPatients(chunk: any[]) {
  if (!adminDb || !chunk || chunk.length === 0) return { success: false };
  try {
    const batch = writeBatch(adminDb);
    let added = 0, updated = 0;
    for (const raw of chunk) {
      if (!raw.CURP) continue;
      const curp = String(raw.CURP).toUpperCase().trim();
      const patientData = { expediente: raw['No.Expediente'] ? String(raw['No.Expediente']).trim() : null, name: String(raw.Nombre || '').toUpperCase().trim(), paternalLastName: String(raw.Apaterno || '').toUpperCase().trim(), maternalLastName: String(raw.Amaterno || '').toUpperCase().trim(), birthDate: raw.FNacimiento ? String(raw.FNacimiento) : null, age: Number(raw.Edad) || 0, sex: String(raw.Sexo).startsWith('M') ? 'Mujer' : 'Hombre', birthState: String(raw.Estado || 'TABASCO').toUpperCase().trim(), address: String(raw.Domicilio || '').toUpperCase().trim(), coloniaName: String(raw.Colonia || '').toUpperCase().trim(), fatherName: String(raw.NombrePadre || '').toUpperCase().trim(), motherName: String(raw.NombreMadre || '').toUpperCase().trim(), fatherAge: Number(raw.EdadPadre) || null, motherAge: Number(raw.EdadMadre) || null, registrationDate: raw.FechaApertura ? String(raw.FechaApertura) : null, status: raw.Estatus || PatientStatusEnum.Vigente, derechoAbiencia: String(raw.DerechoAbiencia || '').toUpperCase().trim(), phoneNumber: String(raw.Telefono || '').trim(), curp, updatedAt: Timestamp.now() };
      const existing = await getPatientByCURP(curp);
      if (existing) { batch.update(doc(adminDb, 'patients', existing.id), patientData); updated++; }
      else { const newId = uuidv4(); batch.set(doc(adminDb, 'patients', newId), { ...patientData, id: newId }); added++; }
    }
    await batch.commit();
    return { success: true, addedCount: added, updatedCount: updated, processedCount: chunk.length };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function getAvailableSlotsForDate(clinicId: string, dateIso: string) {
  const clinic = await getClinicById(clinicId);
  if (!clinic) return {};
  const dateOnly = dateIso.split('T')[0];
  const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', clinicId));
  const snap = await getDocs(q);
  const taken = snap.docs.map(d => d.data()).filter(a => serializeData(a.date).split('T')[0] === dateOnly).map(a => a.time);
  if (clinic.bookingMode === BookingMode.Time) {
    const slots = []; let curr = new Date(`1970-01-01T${clinic.startTime}:00`); const end = new Date(`1970-01-01T${clinic.endTime}:00`); const duration = clinic.consultationDuration || 30;
    while (curr < end) { const t = curr.toTimeString().substring(0, 5); if (!taken.includes(t) && t !== clinic.breakTime) slots.push(t); curr = new Date(curr.getTime() + duration * 60000); }
    return { timeSlots: slots };
  } else {
    const tokens = Array.from({ length: clinic.dailySlots }, (_, i) => i + 1).filter(t => !taken.map(tk => parseInt(tk.replace('Ficha ', ''))).includes(t));
    return { tokens };
  }
}

export async function rescheduleAppointment(id: string, newDate: string, type: string) {
  if (!adminDb) return { success: false };
  try {
    const collMap: Record<string, string> = { 'medical': 'appointments', 'lab': 'labAppointments', 'xray': 'xrayAppointments', 'ultrasound': 'ultrasoundAppointments', 'vaccine': 'vaccineAppointments' };
    await updateDoc(doc(adminDb, collMap[type] || 'appointments', id), { date: Timestamp.fromDate(new Date(newDate)) });
    return { success: true, message: 'Fecha actualizada correctamente' };
  } catch (e: any) { return { success: false, message: e.message }; }
}

export async function cloneAppointment(originalId: string, newDate: string, type: string, newTime?: string) {
  if (!adminDb) return { success: false };
  try {
    const collMap: Record<string, string> = { 'medical': 'appointments', 'lab': 'labAppointments', 'xray': 'xrayAppointments', 'ultrasound': 'ultrasoundAppointments', 'vaccine': 'vaccineAppointments' };
    const collectionName = collMap[type] || 'appointments';
    const originalDoc = await getDoc(doc(adminDb, collectionName, originalId));
    if (!originalDoc.exists()) return { success: false, message: 'Cita original no encontrada' };
    const data = originalDoc.data();
    const newRef = doc(collection(adminDb, collectionName));
    const newFolio = `${data.appointmentNumber.split('-')[0]}-${uuidv4().split('-')[0].toUpperCase()}`;
    const newAppData = { ...data, date: Timestamp.fromDate(new Date(newDate)), appointmentNumber: newFolio, status: 'Agendada' };
    if (newTime) newAppData.time = newTime;
    await setDoc(newRef, newAppData);
    return { success: true, message: `Nueva cita asignada con folio: ${newFolio}` };
  } catch (e: any) { return { success: false, message: e.message }; }
}
