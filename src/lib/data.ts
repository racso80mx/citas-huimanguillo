
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  writeBatch, 
  Timestamp, 
  setDoc,
  updateDoc,
  deleteDoc,
  increment,
  addDoc,
  DocumentReference,
  query,
  where,
  limit,
  orderBy,
  getCountFromServer,
  DocumentData,
  Query
} from 'firebase/firestore';
import { adminDb } from '@/firebase/server-config';
import type { 
  Patient, 
  Appointment, 
  Holiday, 
  SpecialActionDay, 
  LabStudy, 
  LabSettings,
  XRayStudy, 
  XRaySettings,
  UltrasoundStudy, 
  UltrasoundSettings,
  Vaccine, 
  VaccineSettings,
  MedicalConsultation,
  ModuleSettings,
  AdminSettings,
  ArchiveSettings,
  PharmacySettings,
  WarehouseSettings,
  BISettings,
  Medication,
  Supply,
  Clinic,
  Colonia,
  ServiceType,
  Specialty,
  ActivityLog,
  Prescription,
  ArchiveCounts,
  Cie10Record
} from './definitions';
import { PatientStatus, BookingMode } from './definitions';
import { v4 as uuidv4 } from 'uuid';
import { startOfMonth, endOfMonth } from 'date-fns';

// Helper de serialización para NextJS Server Actions
export function serializeData(data: any): any {
  if (data === null || data === undefined) return data;
  if (data instanceof Timestamp) return data.toDate().toISOString();
  if (data instanceof DocumentReference) return data.id;
  if (Array.isArray(data)) return data.map(serializeData);
  if (typeof data === 'object' && data.constructor === Object) {
    const serialized: any = {};
    for (const key in data) {
      serialized[key] = serializeData(data[key]);
    }
    return serialized;
  }
  return data;
}

// Lector genérico de colecciones
async function getRawCollection(name: string, limitNum?: number) {
    try {
        const colRef = collection(adminDb, name);
        let q: Query<DocumentData> = colRef;
        if (limitNum) q = query(colRef, limit(limitNum));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id }));
    } catch (e) {
        console.error(`Error al leer colección ${name}:`, e);
        return [];
    }
}

// Motor de Vinculación de Pacientes (JOIN) eficiente
async function getPatientsForApps(apps: any[]) {
    const pIds = Array.from(new Set(apps.map(a => a.patientId).filter(id => !!id)));
    if (pIds.length === 0) return [];
    
    const pats: any[] = [];
    // Firestore permite hasta 30 elementos en una consulta 'in'
    for (let i = 0; i < pIds.length; i += 30) {
        const chunk = pIds.slice(i, i + 30);
        const q = query(collection(adminDb, 'patients'), where('__name__', 'in', chunk));
        const snap = await getDocs(q);
        pats.push(...snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id })));
    }
    return pats;
}

// --- CONFIGURACIÓN Y SEGURIDAD ---
export async function getModuleSettings(): Promise<ModuleSettings> {
  const snap = await getDoc(doc(adminDb, 'settings', 'moduleSettings'));
  if (snap.exists()) return serializeData(snap.data()) as ModuleSettings;
  return {
    citasMedicasEnabled: true, laboratorioEnabled: true, rayosXEnabled: true, ultrasoundEnabled: true, vacunasEnabled: true,
    archivoEnabled: true, farmaciaEnabled: true, almacenEnabled: true, archivoConsultaEnabled: true,
    citasMedicasWhatsAppEnabled: true, laboratorioWhatsAppEnabled: true, rayosXWhatsAppEnabled: true, ultrasoundWhatsAppEnabled: true, vacunasWhatsAppEnabled: true, archivoWhatsAppEnabled: true,
    citasMedicasPassword: 'citas2026', archivoConsultaPassword: '2026'
  };
}

export async function updateModuleSettings(settings: ModuleSettings) {
    await setDoc(doc(adminDb, 'settings', 'moduleSettings'), settings);
    return { success: true };
}

export async function getAdminSettingsData(): Promise<AdminSettings> { 
    const snap = await getDoc(doc(adminDb, 'settings', 'admin')); 
    if (snap.exists()) return serializeData(snap.data()) as AdminSettings;
    return { password: 'Hu1m4ngu1ll0' }; 
}

export async function updateAdminSettings(settings: AdminSettings) { 
    await setDoc(doc(adminDb, 'settings', 'admin'), settings); 
    return { success: true }; 
}

export async function getArchiveSettingsData(): Promise<ArchiveSettings> { 
    const snap = await getDoc(doc(adminDb, 'settings', 'archive')); 
    if (snap.exists()) return serializeData(snap.data()) as ArchiveSettings;
    return { password: '123' }; 
}

export async function updateArchiveSettings(settings: ArchiveSettings) { 
    await setDoc(doc(adminDb, 'settings', 'archive'), settings); 
    return { success: true }; 
}

export async function getPharmacySettingsData(): Promise<PharmacySettings> { 
    const snap = await getDoc(doc(adminDb, 'settings', 'pharmacy')); 
    if (snap.exists()) return serializeData(snap.data()) as PharmacySettings;
    return { password: '123' }; 
}

export async function updatePharmacySettings(settings: PharmacySettings) { 
    await setDoc(doc(adminDb, 'settings', 'pharmacy'), settings); 
    return { success: true }; 
}

export async function getWarehouseSettingsData(): Promise<WarehouseSettings> { 
    const snap = await getDoc(doc(adminDb, 'settings', 'warehouse')); 
    if (snap.exists()) return serializeData(snap.data()) as WarehouseSettings;
    return { password: '123' }; 
}

export async function updateWarehouseSettings(settings: WarehouseSettings) { 
    await setDoc(doc(adminDb, 'settings', 'warehouse'), settings); 
    return { success: true }; 
}

export async function getBISettingsData(): Promise<BISettings> { 
    const snap = await getDoc(doc(adminDb, 'settings', 'bi')); 
    if (snap.exists()) return serializeData(snap.data()) as BISettings;
    return { password: '123' }; 
}

export async function updateBISettings(settings: BISettings) { 
    await setDoc(doc(adminDb, 'settings', 'bi'), settings); 
    return { success: true }; 
}

export async function verifyAdminPassword(p: string) { const s = await getAdminSettingsData(); return { success: s.password === p }; }
export async function verifyArchivePassword(p: string) { const s = await getArchiveSettingsData(); return { success: s.password === p }; }
export async function verifyPharmacyPassword(p: string) { const s = await getPharmacySettingsData(); return { success: s.password === p }; }
export async function verifyWarehousePassword(p: string) { const s = await getWarehouseSettingsData(); return { success: s.password === p }; }
export async function verifyBIPassword(p: string) { const s = await getBISettingsData(); return { success: s.password === p }; }
export async function verifyCitasMedicasPassword(p: string) { const s = await getModuleSettings(); return { success: s.citasMedicasPassword === p }; }
export async function verifyLabPassword(p: string) { const s = await getLabSettings(); return { success: s.password === p }; }
export async function verifyXRayPassword(p: string) { const s = await getXRaySettings(); return { success: s.password === p }; }
export async function verifyUltrasoundPassword(p: string) { const s = await getUltrasoundSettings(); return { success: s.password === p }; }
export async function verifyVaccinePassword(p: string) { const s = await getVaccineSettings(); return { success: s.password === p }; }
export async function verifyClinicPassword(id: string, p: string) { const snap = await getDoc(doc(adminDb, 'clinics', id)); return { success: snap.exists() && snap.data()?.password === p }; }

// --- PACIENTES ---
export async function getPatientsData(options?: any): Promise<Patient[]> {
  const colRef = collection(adminDb, 'patients');
  let q: Query<DocumentData> = colRef;
  
  if (options?.searchCurp) {
      q = query(colRef, where('curp', '==', options.searchCurp.toUpperCase()), limit(50));
  } else if (options?.searchExpediente) {
      q = query(colRef, where('expediente', '==', options.searchExpediente), limit(50));
  } else if (options?.status && options.status !== 'Total') {
      q = query(colRef, where('status', '==', options.status), limit(1000));
  } else {
      q = query(colRef, orderBy('paternalLastName'), limit(options?.limitNum || 1000));
  }
  
  const snap = await getDocs(q);
  let results = snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id })) as Patient[];
  
  if (options?.searchName) {
      const t = options.searchName.toUpperCase();
      results = results.filter(p => `${p.name} ${p.paternalLastName} ${p.maternalLastName}`.toUpperCase().includes(t));
  }

  return results;
}

export async function getPatientCounts(): Promise<ArchiveCounts> {
  const colRef = collection(adminDb, 'patients');
  const [totalSnap, vigenteSnap, bajaSnap, bajaDefSnap] = await Promise.all([
    getCountFromServer(colRef),
    getCountFromServer(query(colRef, where('status', '==', PatientStatus.Vigente))),
    getCountFromServer(query(colRef, where('status', '==', PatientStatus.Baja))),
    getCountFromServer(query(colRef, where('status', '==', PatientStatus.BajaDefinitiva)))
  ]);
  return { 
    total: totalSnap.data().count, 
    vigente: vigenteSnap.data().count, 
    bajaTemporal: bajaSnap.data().count, 
    bajaDefinitiva: bajaDefSnap.data().count 
  };
}

export async function savePatient(p: Omit<Patient, 'id'>, id?: string) {
    const pid = id || p.curp.toUpperCase() || uuidv4();
    await setDoc(doc(adminDb, 'patients', pid), { ...p, id: pid, curp: p.curp.toUpperCase() }, { merge: true });
    return { success: true };
}

export async function updatePatient(id: string, p: Partial<Patient>) { await updateDoc(doc(adminDb, 'patients', id), p); return { success: true }; }
export async function updatePatientStatus(id: string, s: string) { await updateDoc(doc(adminDb, 'patients', id), { status: s }); return { success: true }; }
export async function deletePatient(id: string) { await deleteDoc(doc(adminDb, 'patients', id)); return { success: true }; }
export async function deletePatients(ids: string[]) { const batch = writeBatch(adminDb); ids.forEach(id => batch.delete(doc(adminDb, 'patients', id))); await batch.commit(); return { success: true }; }
export async function getPatientByCURP(curp: string) { 
    const q = query(collection(adminDb, 'patients'), where('curp', '==', curp.toUpperCase()), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return { success: false };
    return { success: true, data: serializeData(snap.docs[0].data()) };
}

// --- CITAS ---
export async function getAppointmentsData() {
    const apps = await getRawCollection('appointments', 1000);
    const pats = await getPatientsForApps(apps);
    return apps.map(a => ({ ...a, patient: pats.find(p => p.id === a.patientId) }));
}

export async function getLabAppointmentsData() { 
    const apps = await getRawCollection('labAppointments', 500); 
    const pats = await getPatientsForApps(apps);
    return apps.map(a => ({ ...a, patient: pats.find(p => p.id === a.patientId) })); 
}

export async function getXRayAppointmentsData() { 
    const apps = await getRawCollection('xrayAppointments', 500); 
    const pats = await getPatientsForApps(apps);
    return apps.map(a => ({ ...a, patient: pats.find(p => p.id === a.patientId) })); 
}

export async function getUltrasoundAppointmentsData() { 
    const apps = await getRawCollection('ultrasoundAppointments', 500); 
    const pats = await getPatientsForApps(apps);
    return apps.map(a => ({ ...a, patient: pats.find(p => p.id === a.patientId) })); 
}

export async function getVaccineAppointmentsData() { 
    const apps = await getRawCollection('vaccineAppointments', 500); 
    const pats = await getPatientsForApps(apps);
    return apps.map(a => ({ ...a, patient: pats.find(p => p.id === a.patientId) })); 
}

export async function updateAppointmentStatus(id: string, s: string, t: string) {
    const m: Record<string, string> = { medical: 'appointments', lab: 'labAppointments', xray: 'xrayAppointments', ultrasound: 'ultrasoundAppointments', vaccine: 'vaccineAppointments' };
    await updateDoc(doc(adminDb, m[t], id), { status: s }); return { success: true };
}

export async function deleteAppointment(id: string) { await deleteDoc(doc(adminDb, 'appointments', id)); return { success: true }; }
export async function deleteLabAppointment(id: string) { await deleteDoc(doc(adminDb, 'labAppointments', id)); return { success: true }; }
export async function deleteXRayAppointment(id: string) { await deleteDoc(doc(adminDb, 'xrayAppointments', id)); return { success: true }; }
export async function deleteUltrasoundAppointment(id: string) { await deleteDoc(doc(adminDb, 'ultrasoundAppointments', id)); return { success: true }; }
export async function deleteVaccineAppointment(id: string) { await deleteDoc(doc(adminDb, 'vaccineAppointments', id)); return { success: true }; }

export async function saveNewAppointment(appointment: any, patientData: Omit<Patient, 'id'>, isDouble: boolean, coloniaName?: string) {
    const batch = writeBatch(adminDb);
    const pid = patientData.curp.toUpperCase();
    const pRef = doc(adminDb, 'patients', pid);
    batch.set(pRef, { ...patientData, id: pid, curp: pid }, { merge: true });
    const aid = uuidv4();
    const appNum = `MED-${uuidv4().split('-')[0].toUpperCase()}`;
    const newAppData = { ...appointment, id: aid, patientId: pid, appointmentNumber: appNum, coloniaName: coloniaName || patientData.coloniaName || 'N/A', createdAt: new Date().toISOString() };
    batch.set(doc(adminDb, 'appointments', aid), newAppData);
    await batch.commit();
    const clinicSnap = await getDoc(doc(adminDb, 'clinics', appointment.clinicId));
    return { success: true, data: { appointment: { ...newAppData, patient: patientData }, clinic: clinicSnap.exists() ? serializeData(clinicSnap.data()) : null } };
}

export async function saveNewLabAppointment(appointment: any, patientData: any) {
    const batch = writeBatch(adminDb);
    const pid = patientData.curp.toUpperCase();
    batch.set(doc(adminDb, 'patients', pid), { ...patientData, id: pid, curp: pid }, { merge: true });
    const aid = uuidv4();
    const data = { ...appointment, id: aid, patientId: pid, createdAt: new Date().toISOString() };
    batch.set(doc(adminDb, 'labAppointments', aid), data);
    await batch.commit();
    return { success: true, data: { ...data, patient: patientData }, appointmentNumber: data.appointmentNumber };
}

export async function saveNewXRayAppointment(appointment: any, patientData: any) {
    const batch = writeBatch(adminDb);
    const pid = patientData.curp.toUpperCase();
    batch.set(doc(adminDb, 'patients', pid), { ...patientData, id: pid, curp: pid }, { merge: true });
    const aid = uuidv4();
    const data = { ...appointment, id: aid, patientId: pid, createdAt: new Date().toISOString() };
    batch.set(doc(adminDb, 'xrayAppointments', aid), data);
    await batch.commit();
    const studySnap = await getDoc(doc(adminDb, 'xRayStudies', appointment.studyId));
    return { success: true, data: { appointment: { ...data, patient: patientData }, study: studySnap.exists() ? studySnap.data() : null } };
}

export async function saveNewUltrasoundAppointment(appointment: any, patientData: any) {
    const batch = writeBatch(adminDb);
    const pid = patientData.curp.toUpperCase();
    batch.set(doc(adminDb, 'patients', pid), { ...patientData, id: pid, curp: pid }, { merge: true });
    const aid = uuidv4();
    const data = { ...appointment, id: aid, patientId: pid, createdAt: new Date().toISOString() };
    batch.set(doc(adminDb, 'ultrasoundAppointments', aid), data);
    await batch.commit();
    const studySnap = await getDoc(doc(adminDb, 'ultrasoundStudies', appointment.studyId));
    return { success: true, data: { appointment: { ...data, patient: patientData }, study: studySnap.exists() ? studySnap.data() : null } };
}

export async function saveNewVaccineAppointment(appointment: any, patientData: any) {
    const batch = writeBatch(adminDb);
    const pid = patientData.curp.toUpperCase();
    batch.set(doc(adminDb, 'patients', pid), { ...patientData, id: pid, curp: pid }, { merge: true });
    const aid = uuidv4();
    const data = { ...appointment, id: aid, patientId: pid, createdAt: new Date().toISOString() };
    batch.set(doc(adminDb, 'vaccineAppointments', aid), data);
    await batch.commit();
    return { success: true, data: { ...data, patient: patientData }, appointmentNumber: data.appointmentNumber };
}

export async function getAppointmentsForClinic(cid: string) {
    const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', cid), limit(500));
    const snap = await getDocs(q);
    const apps = snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id }));
    const pats = await getPatientsForApps(apps);
    return apps.map(a => ({ ...a, patient: pats.find(p => p.id === a.patientId) }));
}

export async function rescheduleAppointment(id: string, date: string, type: string) {
    const m: Record<string, string> = { medical: 'appointments', lab: 'labAppointments', xray: 'xrayAppointments', ultrasound: 'ultrasoundAppointments', vaccine: 'vaccineAppointments' };
    await updateDoc(doc(adminDb, m[type], id), { date });
    return { success: true, message: 'Fecha de cita actualizada.' };
}

export async function cloneAppointment(id: string, date: string, type: string, time?: string) {
    const m: Record<string, string> = { medical: 'appointments', lab: 'labAppointments', xray: 'xrayAppointments', ultrasound: 'ultrasoundAppointments', vaccine: 'vaccineAppointments' };
    const snap = await getDoc(doc(adminDb, m[type], id));
    if (!snap.exists()) return { success: false, message: 'Cita original no encontrada.' };
    const data = snap.data();
    const nid = uuidv4();
    const prefix = data!.appointmentNumber.split('-')[0];
    const folio = `${prefix}-${uuidv4().split('-')[0].toUpperCase()}`;
    const newDoc = { ...data, id: nid, date, time: time || data!.time, appointmentNumber: folio, status: 'Agendada', createdAt: new Date().toISOString() };
    await setDoc(doc(adminDb, m[type], nid), newDoc);
    return { success: true, message: `Nueva cita generada con folio ${folio}.` };
}

export async function getAppointmentsForCalendar(month: number, year: number) {
    const start = startOfMonth(new Date(year, month)).toISOString();
    const end = endOfMonth(new Date(year, month)).toISOString();
    const q = query(collection(adminDb, 'appointments'), where('date', '>=', start), where('date', '<=', end));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id }));
}

export async function getAvailableSlotsForDate(clinicId: string, date: string) {
    const clinicRef = doc(adminDb, 'clinics', clinicId);
    const clinicSnap = await getDoc(clinicRef);
    if (!clinicSnap.exists()) return { timeSlots: [], tokens: [] };
    const clinic = clinicSnap.data() as Clinic;
    const dateStr = date.split('T')[0];
    const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', clinicId), where('date', '>=', dateStr), where('date', '<=', dateStr + 'z'));
    const snap = await getDocs(q);
    const booked = snap.docs.map(d => d.data().time);
    if (clinic.bookingMode === BookingMode.Token) {
        const total = (clinic.dailySlots || 15) + (clinic.waitlistSlots || 0);
        const tokens = Array.from({ length: total }, (_, i) => i + 1).filter(t => !booked.includes(`Ficha ${t}`));
        return { tokens };
    } else {
        const start = new Date(`1970-01-01T${clinic.startTime}:00`);
        const end = new Date(`1970-01-01T${clinic.endTime}:00`);
        const slots: string[] = [];
        let curr = start;
        while (curr < end) {
            const t = curr.toTimeString().substring(0, 5);
            if (t !== clinic.breakTime && !booked.includes(t)) slots.push(t);
            curr = new Date(curr.getTime() + (clinic.consultationDuration || 30) * 60000);
        }
        return { timeSlots: slots };
    }
}

// --- MANTENIMIENTO ---
export async function bulkInsertPatients(pats: any[]) { const batch = writeBatch(adminDb); pats.forEach(p => { const id = (p.CURP || p.curp || uuidv4()).toUpperCase(); batch.set(doc(adminDb, 'patients', id), { ...p, id, curp: id, status: p.status || PatientStatus.Vigente }, { merge: true }); }); await batch.commit(); return { success: true, processedCount: pats.length }; }
export async function bulkInsertDoctors(docs: any[]) { const batch = writeBatch(adminDb); docs.forEach(d => { const id = uuidv4(); batch.set(doc(adminDb, 'clinics', id), { ...d, id, name: d.Unidad || d.name, doctorName: d.Médico || d.doctorName, serviceTypeId: d.serviceTypeId || d.Categoría || '' }); }); await batch.commit(); return { success: true, processedCount: docs.length }; }
export async function scanDuplicates(criteria: string) { const all = await getRawCollection('patients', 1000) as Patient[]; const groups: Record<string, Patient[]> = {}; all.forEach(p => { const key = criteria === 'expediente' ? String(p.expediente) : criteria === 'curp' ? p.curp : `${p.name}_${p.paternalLastName}`; if (key) { groups[key] = groups[key] || []; groups[key].push(p); } }); return Object.values(groups).filter(g => g.length > 1); }
export async function applyStatusUpdateChunk(exps: string[], s: string) { const batch = writeBatch(adminDb); let count = 0; for(const exp of exps) { const q = query(collection(adminDb, 'patients'), where('expediente', '==', exp), limit(5)); const snap = await getDocs(q); snap.docs.forEach(d => { batch.update(d.ref, { status: s }); count++; }); } await batch.commit(); return { success: true, count }; }
export async function normalizeExpedientesAction() { const snap = await getDocs(collection(adminDb, 'patients')); const batch = writeBatch(adminDb); let count = 0; snap.docs.forEach(d => { const exp = d.data().expediente; if (exp && !String(exp).startsWith('0')) { batch.update(d.ref, { expediente: `0${exp}` }); count++; } }); await batch.commit(); return { success: true, count }; }
export async function downloadBackupAction() {
    const [apps, lab, xray, us, vac, pats, clins] = await Promise.all([getRawCollection('appointments'), getRawCollection('labAppointments'), getRawCollection('xrayAppointments'), getRawCollection('ultrasoundAppointments'), getRawCollection('vaccineAppointments'), getRawCollection('patients', 2000), getRawCollection('clinics')]);
    return { success: true, data: { appointments: apps, labAppointments: lab, xRayAppointments: xray, ultrasoundAppointments: us, vaccineAppointments: vac, patients: pats, clinics: clins } };
}
export async function cleanupOldRecords() {
    const limitDate = new Date(); limitDate.setMonth(limitDate.getMonth() - 1); const limitStr = limitDate.toISOString();
    const cols = ['appointments', 'labAppointments', 'xrayAppointments', 'ultrasoundAppointments', 'vaccineAppointments', 'activityLog'];
    let total = 0;
    for (const c of cols) {
        const snap = await getDocs(collection(adminDb, c)); const batch = writeBatch(adminDb);
        snap.docs.forEach(d => { const date = d.data().date || d.data().timestamp; if (date && date < limitStr) { batch.delete(d.ref); total++; } });
        await batch.commit();
    }
    return { success: true, deletedCount: total };
}

// --- CLÍNICAS ---
export async function getClinicsData() { return getRawCollection('clinics'); }
export async function updateClinics(clinics: Clinic[]) { 
    const batch = writeBatch(adminDb); 
    const snap = await getDocs(collection(adminDb, 'clinics')); 
    snap.docs.forEach(d => batch.delete(d.ref)); 
    clinics.forEach(c => batch.set(doc(adminDb, 'clinics', c.id), c)); 
    await batch.commit(); return { success: true }; 
}
export async function deleteClinic(id: string) { await deleteDoc(doc(adminDb, 'clinics', id)); return { success: true }; }

// --- LOGS ---
export async function getLogsData() { const all = await getRawCollection('activityLog', 500) as ActivityLog[]; return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp)); }
export async function logActivity(action: string, details: string) { await addDoc(collection(adminDb, 'activityLog'), { action, details, timestamp: new Date().toISOString() }); }

// --- CONSULTAS Y RECETAS ---
export async function getConsultationsByPatientId(pid: string) { 
    const q = query(collection(adminDb, 'medicalConsultations'), where('patientId', '==', pid), orderBy('date', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id })) as MedicalConsultation[];
}
export async function saveMedicalConsultation(c: any) { const id = c.id || uuidv4(); await setDoc(doc(adminDb, 'medicalConsultations', id), { ...c, id }, { merge: true }); if (c.isFinal) await updateDoc(doc(adminDb, 'appointments', c.appointmentId), { status: 'Atendido' }); return { success: true, id }; }
export async function getConsultationByAppointmentId(aid: string) { 
    const q = query(collection(adminDb, 'medicalConsultations'), where('appointmentId', '==', aid), limit(1));
    const snap = await getDocs(q);
    return snap.empty ? null : { ...serializeData(snap.docs[0].data()), id: snap.docs[0].id } as MedicalConsultation;
}
export async function deleteMedicalConsultation(id: string) { await deleteDoc(doc(adminDb, 'medicalConsultations', id)); return { success: true }; }
export async function getPrescriptionsByPatientId(pid: string) { 
    const q = query(collection(adminDb, 'prescriptions'), where('patientId', '==', pid), orderBy('date', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id })) as Prescription[];
}
export async function createPrescription(p: any) { const id = uuidv4(); const folio = `REC-${uuidv4().split('-')[0].toUpperCase()}`; const expAt = new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString(); const data = { ...p, id, folio, expiresAt: expAt, status: 'pendiente', createdAt: new Date().toISOString() }; await setDoc(doc(adminDb, 'prescriptions', id), data); return { success: true, folio, prescription: data }; }
export async function updatePrescription(id: string, p: any) { await updateDoc(doc(adminDb, 'prescriptions', id), p); return { success: true }; }
export async function dispensePrescription(id: string, items: any[]) { const batch = writeBatch(adminDb); items.forEach(i => batch.update(doc(adminDb, 'medications', i.medicationId), { existencia: increment(-i.quantity) })); batch.update(doc(adminDb, 'prescriptions', id), { status: 'surtida', dispensedDate: new Date().toISOString() }); await batch.commit(); return { success: true }; }
export async function deletePrescription(id: string) { await deleteDoc(doc(adminDb, 'prescriptions', id)); return { success: true }; }
export async function getPendingPrescriptions(f: any) { const all = await getRawCollection('prescriptions', 500) as Prescription[]; let res = all; if (f?.status) res = res.filter(r => r.status === f.status); if (f?.folio) res = res.filter(r => r.folio.toUpperCase() === f.folio.toUpperCase()); if (f?.clinicId && f.clinicId !== 'all') res = res.filter(r => r.clinicId === f.clinicId); return res.sort((a, b) => b.date.localeCompare(a.date)); }
export async function getPatientPrescriptionsCountTodayAction(pid: string) { const t = new Date(); t.setHours(0,0,0,0); const q = query(collection(adminDb, 'prescriptions'), where('patientId', '==', pid), where('date', '>=', t.toISOString())); const snap = await getCountFromServer(q); return snap.data().count; }
export async function getAppointmentCountOnDate(cid: string, d: string) { const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', cid), where('date', '>=', d), where('date', '<=', d + 'z')); const snap = await getCountFromServer(q); return snap.data().count; }
export async function getAttendedPatientsForClinic(cid: string) { const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', cid), where('status', '==', 'Atendido'), limit(100)); const snap = await getDocs(q); const ids = Array.from(new Set(snap.docs.map(d => d.data().patientId))); if (ids.length === 0) return []; const pats: any[] = []; for (let i = 0; i < ids.length; i += 10) { const chunk = ids.slice(i, i + 10); const psnap = await getDocs(query(collection(adminDb, 'patients'), where('__name__', 'in', chunk))); pats.push(...psnap.docs.map(d => ({ ...serializeData(d.data()), id: d.id }))); } return pats; }

// --- CATÁLOGOS DINÁMICOS ---
export async function getServiceTypesData() { return getRawCollection('serviceTypes'); }
export async function updateServiceTypes(types: ServiceType[]) { const batch = writeBatch(adminDb); const snap = await getDocs(collection(adminDb, 'serviceTypes')); snap.docs.forEach(d => batch.delete(d.ref)); types.forEach(t => batch.set(doc(adminDb, 'serviceTypes', t.id), t)); await batch.commit(); return { success: true }; }
export async function getSpecialtiesData() { return getRawCollection('specialties'); }
export async function updateSpecialties(specialties: Specialty[]) { const batch = writeBatch(adminDb); const snap = await getDocs(collection(adminDb, 'specialties')); snap.docs.forEach(d => batch.delete(d.ref)); specialties.forEach(s => batch.set(doc(adminDb, 'specialties', s.id), s)); await batch.commit(); return { success: true }; }
export async function getColoniasData() { return getRawCollection('colonias'); }
export async function updateColonias(colonias: Colonia[]) { const batch = writeBatch(adminDb); const snap = await getDocs(collection(adminDb, 'colonias')); snap.docs.forEach(d => batch.delete(d.ref)); colonias.forEach(c => batch.set(doc(adminDb, 'colonias', c.id), c)); await batch.commit(); return { success: true }; }

// --- CIE-10 ---
export async function bulkInsertCie10Glossary(items: any[]) { const batch = writeBatch(adminDb); items.forEach(i => batch.set(doc(adminDb, 'cie10_glossary', uuidv4()), i)); await batch.commit(); return { success: true, processedCount: items.length }; }
export async function bulkInsertCie10Catalog(items: any[]) { const batch = writeBatch(adminDb); items.forEach(i => batch.set(doc(adminDb, 'cie10_catalog', uuidv4()), i)); await batch.commit(); return { success: true, processedCount: items.length }; }
export async function deleteAllCie10Glossary() { const snap = await getDocs(collection(adminDb, 'cie10_glossary')); const batch = writeBatch(adminDb); snap.docs.forEach(d => batch.delete(d.ref)); await batch.commit(); return { success: true }; }
export async function deleteAllCie10Catalog() { const snap = await getDocs(collection(adminDb, 'cie10_catalog')); const batch = writeBatch(adminDb); snap.docs.forEach(d => batch.delete(d.ref)); await batch.commit(); return { success: true }; }
export async function searchCie10Data(term: string) { const all = await getRawCollection('cie10_catalog', 1000) as Cie10Record[]; const u = term.toUpperCase(); return all.filter(r => (r.nombre || '').toUpperCase().includes(u) || (r.catalogKey || '').toUpperCase().includes(u)).slice(0, 50); }

// --- SETTINGS ---
export async function updateAnnouncements(msgs: string[]) { await setDoc(doc(adminDb, 'settings', 'announcements'), { messages: msgs }); return { success: true }; }
export async function getAnnouncementsData() { const snap = await getDoc(doc(adminDb, 'settings', 'announcements')); return snap.exists() ? snap.data()?.messages || [] : []; }
export async function getHolidaysData() { return getRawCollection('holidays'); }
export async function updateHolidays(hols: Holiday[]) { const batch = writeBatch(adminDb); const snap = await getDocs(collection(adminDb, 'holidays')); snap.docs.forEach(d => batch.delete(d.ref)); hols.forEach(h => batch.set(doc(adminDb, 'holidays', h.id || uuidv4()), h)); await batch.commit(); return { success: true }; }
export async function getSpecialActionDaysData() { return getRawCollection('specialActionDays'); }
export async function updateSpecialActionDays(items: SpecialActionDay[]) { const batch = writeBatch(adminDb); const snap = await getDocs(collection(adminDb, 'specialActionDays')); snap.docs.forEach(d => batch.delete(d.ref)); items.forEach(i => batch.set(doc(adminDb, 'specialActionDays', uuidv4()), i)); await batch.commit(); return { success: true }; }
export async function getLabSettings() { const snap = await getDoc(doc(adminDb, 'settings', 'labSettings')); return snap.exists() ? serializeData(snap.data()) : { dailySlots: 10, waitlistSlots: 0, weekendBookingEnabled: false, password: '123' }; }
export async function updateLabSettings(s: LabSettings) { await setDoc(doc(adminDb, 'settings', 'labSettings'), s); return { success: true }; }
export async function getXRaySettings() { const snap = await getDoc(doc(adminDb, 'settings', 'xraySettings')); return snap.exists() ? serializeData(snap.data()) : { dailySlots: 10, waitlistSlots: 0, weekendBookingEnabled: false, password: '123' }; }
export async function updateXRaySettings(s: XRaySettings) { await setDoc(doc(adminDb, 'settings', 'xraySettings'), s); return { success: true }; }
export async function getUltrasoundSettings() { const snap = await getDoc(doc(adminDb, 'settings', 'ultrasoundSettings')); return snap.exists() ? serializeData(snap.data()) : { dailySlots: 10, waitlistSlots: 0, weekendBookingEnabled: false, password: '123' }; }
export async function updateUltrasoundSettings(s: UltrasoundSettings) { await setDoc(doc(adminDb, 'settings', 'ultrasoundSettings'), s); return { success: true }; }
export async function getVaccineSettings() { const snap = await getDoc(doc(adminDb, 'settings', 'vaccineSettings')); return snap.exists() ? serializeData(snap.data()) : { dailySlots: 10, waitlistSlots: 0, weekendBookingEnabled: false, password: '123' }; }
export async function updateVaccineSettings(s: VaccineSettings) { await setDoc(doc(adminDb, 'settings', 'vaccineSettings'), s); return { success: true }; }
export async function getLabStudies() { return getRawCollection('labStudies'); }
export async function updateLabStudies(s: LabStudy[]) { const batch = writeBatch(adminDb); const snap = await getDocs(collection(adminDb, 'labStudies')); snap.docs.forEach(d => batch.delete(d.ref)); s.forEach(i => batch.set(doc(adminDb, 'labStudies', i.id), i)); await batch.commit(); return { success: true }; }
export async function getXRayStudies() { return getRawCollection('xRayStudies'); }
export async function updateXRayStudies(s: XRayStudy[]) { const batch = writeBatch(adminDb); const snap = await getDocs(collection(adminDb, 'xRayStudies')); snap.docs.forEach(d => batch.delete(d.ref)); s.forEach(i => batch.set(doc(adminDb, 'xRayStudies', i.id), i)); await batch.commit(); return { success: true }; }
export async function getUltrasoundStudies() { return getRawCollection('ultrasoundStudies'); }
export async function updateUltrasoundStudies(s: UltrasoundStudy[]) { const batch = writeBatch(adminDb); const snap = await getDocs(collection(adminDb, 'ultrasoundStudies')); snap.docs.forEach(d => batch.delete(d.ref)); s.forEach(i => batch.set(doc(adminDb, 'ultrasoundStudies', i.id), i)); await batch.commit(); return { success: true }; }
export async function getVaccines() { return getRawCollection('vaccines'); }
export async function updateVaccines(v: Vaccine[]) { const batch = writeBatch(adminDb); const snap = await getDocs(collection(adminDb, 'vaccines')); snap.docs.forEach(d => batch.delete(d.ref)); v.forEach(i => batch.set(doc(adminDb, 'vaccines', i.id), i)); await batch.commit(); return { success: true }; }
export async function getMedications() { return getRawCollection('medications'); }
export async function getSupplies() { return getRawCollection('supplies'); }
export async function deleteAllMedications() { const snap = await getDocs(collection(adminDb, 'medications')); const batch = writeBatch(adminDb); snap.docs.forEach(d => batch.delete(d.ref)); await batch.commit(); return { success: true }; }
export async function deleteAllSupplies() { const snap = await getDocs(collection(adminDb, 'supplies')); const batch = writeBatch(adminDb); snap.docs.forEach(d => batch.delete(d.ref)); await batch.commit(); return { success: true }; }
export async function bulkInsertMedications(p: any[]) { const batch = writeBatch(adminDb); p.forEach(i => { const id = uuidv4(); batch.set(doc(adminDb, 'medications', id), { ...i, id }); }); await batch.commit(); return { success: true, processedCount: p.length }; }
export async function bulkInsertSupplies(p: any[]) { const batch = writeBatch(adminDb); p.forEach(i => { const id = uuidv4(); batch.set(doc(adminDb, 'supplies', id), { ...i, id }); }); await batch.commit(); return { success: true, processedCount: p.length }; }
