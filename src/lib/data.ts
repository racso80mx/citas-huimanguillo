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
  DocumentReference
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
  Cie10Record,
  ActivityLog,
  Prescription,
  ArchiveCounts
} from './definitions';
import { PatientStatus, BookingMode } from './definitions';
import { v4 as uuidv4 } from 'uuid';

/** 
 * SERIALIZACIÓN PARA NEXT.JS
 */
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

/**
 * RECUPERACIÓN SEGURA DE COLECCIONES (PROCESAMIENTO EN MEMORIA)
 */
async function getRawCollection(name: string) {
    try {
        const snap = await getDocs(collection(adminDb, name));
        return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id }));
    } catch (e) {
        console.error(`Error al leer colección ${name}:`, e);
        return [];
    }
}

// --- MÓDULOS Y SEGURIDAD ---
export async function getModuleSettings(): Promise<ModuleSettings> {
  const snap = await getDoc(doc(adminDb, 'settings', 'moduleSettings'));
  if (snap.exists()) return serializeData(snap.data()) as ModuleSettings;
  return {
    citasMedicasEnabled: true, laboratorioEnabled: true, rayosXEnabled: true, ultrasoundEnabled: true, vacunasEnabled: true,
    archivoEnabled: true, farmaciaEnabled: true, almacenEnabled: true, archivoConsultaEnabled: true,
    citasMedicasWhatsAppEnabled: true, laboratorioWhatsAppEnabled: true, rayosXWhatsAppEnabled: true, ultrasoundWhatsAppEnabled: true, vacunasWhatsAppEnabled: true, archivoWhatsAppEnabled: true,
    citasMedicasPassword: 'Citas', archivoConsultaPassword: 'Consulta'
  };
}

export async function updateModuleSettings(settings: ModuleSettings) {
    await setDoc(doc(adminDb, 'settings', 'moduleSettings'), settings);
    return { success: true };
}

export async function getAdminSettingsData() { 
    const snap = await getDoc(doc(adminDb, 'settings', 'admin')); 
    return snap.exists() ? serializeData(snap.data()) : { password: 'Hu1m4ngu1ll0' }; 
}

export async function updateAdminSettings(settings: AdminSettings) { 
    await setDoc(doc(adminDb, 'settings', 'admin'), settings); 
    return { success: true }; 
}

export async function getArchiveSettingsData() { 
    const snap = await getDoc(doc(adminDb, 'settings', 'archive')); 
    return snap.exists() ? serializeData(snap.data()) : { password: '123' }; 
}

export async function updateArchiveSettings(settings: ArchiveSettings) { 
    await setDoc(doc(adminDb, 'settings', 'archive'), settings); 
    return { success: true }; 
}

export async function getPharmacySettingsData() { 
    const snap = await getDoc(doc(adminDb, 'settings', 'pharmacy')); 
    return snap.exists() ? serializeData(snap.data()) : { password: '123' }; 
}

export async function updatePharmacySettings(settings: PharmacySettings) { 
    await setDoc(doc(adminDb, 'settings', 'pharmacy'), settings); 
    return { success: true }; 
}

export async function getWarehouseSettingsData() { 
    const snap = await getDoc(doc(adminDb, 'settings', 'warehouse')); 
    return snap.exists() ? serializeData(snap.data()) : { password: '123' }; 
}

export async function updateWarehouseSettings(settings: WarehouseSettings) { 
    await setDoc(doc(adminDb, 'settings', 'warehouse'), settings); 
    return { success: true }; 
}

export async function getBISettingsData() { 
    const snap = await getDoc(doc(adminDb, 'settings', 'bi')); 
    return snap.exists() ? serializeData(snap.data()) : { password: '123' }; 
}

export async function updateBISettings(settings: BISettings) { 
    await setDoc(doc(adminDb, 'settings', 'bi'), settings); 
    return { success: true }; 
}

// VERIFICACIONES
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
export async function verifyClinicPassword(id: string, p: string) { const all = await getClinicsData(); const c = all.find(x => x.id === id); return { success: c?.password === p }; }

// --- CATÁLOGOS ---
export async function getServiceTypesData() { return getRawCollection('serviceTypes'); }
export async function updateServiceTypes(types: ServiceType[]) {
    const batch = writeBatch(adminDb);
    const snap = await getDocs(collection(adminDb, 'serviceTypes'));
    snap.docs.forEach(d => batch.delete(d.ref));
    types.forEach(t => batch.set(doc(adminDb, 'serviceTypes', t.id), t));
    await batch.commit(); return { success: true };
}
export async function getSpecialtiesData() { return getRawCollection('specialties'); }
export async function updateSpecialties(specialties: Specialty[]) {
    const batch = writeBatch(adminDb);
    const snap = await getDocs(collection(adminDb, 'specialties'));
    snap.docs.forEach(d => batch.delete(d.ref));
    specialties.forEach(s => batch.set(doc(adminDb, 'specialties', s.id), s));
    await batch.commit(); return { success: true };
}

// --- PACIENTES ---
export async function getPatientsData(options?: any): Promise<Patient[]> {
  const all = await getRawCollection('patients') as Patient[];
  let results = all;
  if (options?.status && options.status !== 'Total') results = results.filter(p => (p.status || PatientStatus.Vigente) === options.status);
  if (options?.searchName) { const t = options.searchName.toUpperCase(); results = results.filter(p => `${p.name} ${p.paternalLastName} ${p.maternalLastName}`.toUpperCase().includes(t)); }
  if (options?.searchCurp) { const t = options.searchCurp.toUpperCase(); results = results.filter(p => (p.curp || '').toUpperCase().includes(t)); }
  if (options?.searchExpediente) { results = results.filter(p => String(p.expediente || '').includes(options.searchExpediente)); }
  results.sort((a, b) => (a.paternalLastName || '').localeCompare(b.paternalLastName || ''));
  return results.slice(0, options?.limitNum || 2000);
}

export async function getPatientCounts(): Promise<ArchiveCounts> {
  const all = await getRawCollection('patients') as Patient[];
  return {
    total: all.length,
    vigente: all.filter(p => !p.status || p.status === PatientStatus.Vigente).length,
    bajaTemporal: all.filter(p => p.status === PatientStatus.Baja).length,
    bajaDefinitiva: all.filter(p => p.status === PatientStatus.BajaDefinitiva).length,
  };
}

export async function savePatient(p: Omit<Patient, 'id'>, id?: string) {
    const pid = id || p.curp.toUpperCase() || uuidv4();
    await setDoc(doc(adminDb, 'patients', pid), { ...p, id: pid, curp: p.curp.toUpperCase() });
    return { success: true };
}

export async function updatePatient(id: string, p: Partial<Patient>) { await updateDoc(doc(adminDb, 'patients', id), p); return { success: true }; }
export async function updatePatientStatus(id: string, s: string) { await updateDoc(doc(adminDb, 'patients', id), { status: s }); return { success: true }; }
export async function deletePatient(id: string) { await deleteDoc(doc(adminDb, 'patients', id)); return { success: true }; }
export async function deletePatients(ids: string[]) { const batch = writeBatch(adminDb); ids.forEach(id => batch.delete(doc(adminDb, 'patients', id))); await batch.commit(); return { success: true }; }
export async function getPatientByCURP(curp: string) { const all = await getRawCollection('patients') as Patient[]; const m = all.find(p => p.curp?.toUpperCase() === curp.toUpperCase()); return m ? { success: true, data: m } : { success: false }; }

// --- CITAS ---
export async function getAppointmentsData() {
    const [apps, patients] = await Promise.all([getRawCollection('appointments'), getRawCollection('patients')]);
    return apps.map(a => ({ ...a, patient: patients.find(p => p.id === a.patientId) }));
}

export async function saveNewAppointment(appointment: any, patient: any, isDouble: boolean, colonia?: string) {
    const batch = writeBatch(adminDb);
    const pId = patient.curp.toUpperCase();
    batch.set(doc(adminDb, 'patients', pId), { ...patient, curp: pId }, { merge: true });
    const id = uuidv4();
    const folio = `MED-${uuidv4().split('-')[0].toUpperCase()}`;
    const data = { ...appointment, id, appointmentNumber: folio, patientId: pId, coloniaName: colonia || null, createdAt: new Date().toISOString() };
    batch.set(doc(adminDb, 'appointments', id), data);

    if (isDouble && appointment.time && !appointment.time.includes('Ficha')) {
        const [h, m] = appointment.time.split(':').map(Number);
        const nextTimeDate = new Date(1970, 0, 1, h, m + 30);
        const nextTime = nextTimeDate.toTimeString().substring(0, 5);
        const sid = uuidv4();
        batch.set(doc(adminDb, 'appointments', sid), { ...data, id: sid, time: nextTime, status: 'Agendada', appointmentNumber: `${folio}-B` });
    }
    await batch.commit();
    const csnap = await getDoc(doc(adminDb, 'clinics', appointment.clinicId));
    return { success: true, data: { appointment: { ...data, patient }, clinic: serializeData(csnap.data()) } };
}

// --- OTROS MÓDULOS ---
export async function getLabAppointmentsData() { const [apps, pats] = await Promise.all([getRawCollection('labAppointments'), getRawCollection('patients')]); return apps.map(a => ({ ...a, patient: pats.find(p => p.id === a.patientId) })); }
export async function getXRayAppointmentsData() { const [apps, pats] = await Promise.all([getRawCollection('xrayAppointments'), getRawCollection('patients')]); return apps.map(a => ({ ...a, patient: pats.find(p => p.id === a.patientId) })); }
export async function getUltrasoundAppointmentsData() { const [apps, pats] = await Promise.all([getRawCollection('ultrasoundAppointments'), getRawCollection('patients')]); return apps.map(a => ({ ...a, patient: pats.find(p => p.id === a.patientId) })); }
export async function getVaccineAppointmentsData() { const [apps, pats] = await Promise.all([getRawCollection('vaccineAppointments'), getRawCollection('patients')]); return apps.map(a => ({ ...a, patient: pats.find(p => p.id === a.patientId) })); }

export async function saveNewLabAppointment(appointment: any, patient: any) {
    const batch = writeBatch(adminDb);
    const pId = patient.curp.toUpperCase();
    batch.set(doc(adminDb, 'patients', pId), { ...patient, curp: pId }, { merge: true });
    const id = uuidv4();
    batch.set(doc(adminDb, 'labAppointments', id), { ...appointment, id, patientId: pId, createdAt: new Date().toISOString() });
    await batch.commit(); return { success: true, data: { ...appointment, patient } };
}

export async function saveNewXRayAppointment(appointment: any, patient: any) {
    const batch = writeBatch(adminDb);
    const pId = patient.curp.toUpperCase();
    batch.set(doc(adminDb, 'patients', pId), { ...patient, curp: pId }, { merge: true });
    const id = uuidv4();
    batch.set(doc(adminDb, 'xrayAppointments', id), { ...appointment, id, patientId: pId, createdAt: new Date().toISOString() });
    await batch.commit(); 
    const snap = await getDoc(doc(adminDb, 'xRayStudies', appointment.studyId));
    return { success: true, data: { appointment: { ...appointment, patient }, study: serializeData(snap.data()) } };
}

export async function saveNewUltrasoundAppointment(appointment: any, patient: any) {
    const batch = writeBatch(adminDb);
    const pId = patient.curp.toUpperCase();
    batch.set(doc(adminDb, 'patients', pId), { ...patient, curp: pId }, { merge: true });
    const id = uuidv4();
    batch.set(doc(adminDb, 'ultrasoundAppointments', id), { ...appointment, id, patientId: pId, createdAt: new Date().toISOString() });
    await batch.commit();
    const snap = await getDoc(doc(adminDb, 'ultrasoundStudies', appointment.studyId));
    return { success: true, data: { appointment: { ...appointment, patient }, study: serializeData(snap.data()) } };
}

export async function saveNewVaccineAppointment(appointment: any, patient: any) {
    const batch = writeBatch(adminDb);
    const pId = patient.curp.toUpperCase();
    batch.set(doc(adminDb, 'patients', pId), { ...patient, curp: pId }, { merge: true });
    const id = uuidv4();
    batch.set(doc(adminDb, 'vaccineAppointments', id), { ...appointment, id, patientId: pId, createdAt: new Date().toISOString() });
    await batch.commit(); return { success: true, data: { ...appointment, patient } };
}

export async function updateAppointmentStatus(aid: string, s: string, t: string) {
    const m: Record<string, string> = { medical: 'appointments', lab: 'labAppointments', xray: 'xrayAppointments', ultrasound: 'ultrasoundAppointments', vaccine: 'vaccineAppointments' };
    await updateDoc(doc(adminDb, m[t] || 'appointments', aid), { status: s });
    return { success: true };
}

export async function rescheduleAppointment(id: string, date: string, t: string) {
    const m: Record<string, string> = { medical: 'appointments', lab: 'labAppointments', xray: 'xrayAppointments', ultrasound: 'ultrasoundAppointments', vaccine: 'vaccineAppointments' };
    await updateDoc(doc(adminDb, m[t], id), { date }); return { success: true, message: 'Fecha actualizada.' };
}

export async function cloneAppointment(id: string, date: string, t: string, time?: string) {
    const m: Record<string, string> = { medical: 'appointments', lab: 'labAppointments', xray: 'xrayAppointments', ultrasound: 'ultrasoundAppointments', vaccine: 'vaccineAppointments' };
    const snap = await getDoc(doc(adminDb, m[t], id));
    if (!snap.exists()) return { success: false };
    const nid = uuidv4();
    await setDoc(doc(adminDb, m[t], nid), { ...snap.data(), id: nid, date, time: time || snap.data()?.time, status: 'Agendada', createdAt: new Date().toISOString() });
    return { success: true, message: 'Cita clonada.' };
}

export async function deleteAppointment(id: string) { await deleteDoc(doc(adminDb, 'appointments', id)); return { success: true }; }
export async function deleteLabAppointment(id: string) { await deleteDoc(doc(adminDb, 'labAppointments', id)); return { success: true }; }
export async function deleteXRayAppointment(id: string) { await deleteDoc(doc(adminDb, 'xrayAppointments', id)); return { success: true }; }
export async function deleteUltrasoundAppointment(id: string) { await deleteDoc(doc(adminDb, 'ultrasoundAppointments', id)); return { success: true }; }
export async function deleteVaccineAppointment(id: string) { await deleteDoc(doc(adminDb, 'vaccineAppointments', id)); return { success: true }; }

export async function getAppointmentsForClinic(cid: string) {
    const [apps, patients] = await Promise.all([getRawCollection('appointments'), getRawCollection('patients')]);
    return apps.filter(a => a.clinicId === cid).map(a => ({ ...a, patient: patients.find(p => p.id === a.patientId) }));
}

export async function getAppointmentsForCalendar(m: number, y: number) {
    const all = await getRawCollection('appointments') as Appointment[];
    return all.filter(a => { const d = new Date(a.date); return d.getMonth() === m && d.getFullYear() === y; });
}

export async function getAvailableSlotsForDate(cid: string, d: string) {
    const csnap = await getDoc(doc(adminDb, 'clinics', cid));
    if (!csnap.exists()) return {};
    const c = csnap.data() as Clinic;
    const all = await getRawCollection('appointments') as Appointment[];
    const ds = d.split('T')[0];
    const booked = all.filter(a => a.clinicId === cid && a.date.startsWith(ds)).map(a => a.time);
    if (c.bookingMode === BookingMode.Token) return { tokens: Array.from({ length: c.dailySlots }, (_, i) => i + 1).filter(t => !booked.includes(`Ficha ${t}`)) };
    return { timeSlots: ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00"].filter(t => !booked.includes(t)) };
}

// --- MANTENIMIENTO ---
export async function bulkInsertPatients(pats: any[]) { const batch = writeBatch(adminDb); pats.forEach(p => { const id = (p.CURP || p.curp || uuidv4()).toUpperCase(); batch.set(doc(adminDb, 'patients', id), { ...p, id, curp: id }); }); await batch.commit(); return { success: true, processedCount: pats.length }; }
export async function bulkInsertDoctors(docs: any[]) { const batch = writeBatch(adminDb); docs.forEach(d => { const id = uuidv4(); batch.set(doc(adminDb, 'clinics', id), { ...d, id, name: d.Unidad || d.name, doctorName: d.Médico || d.doctorName, serviceTypeId: d.serviceTypeId || d.Categoría || '' }); }); await batch.commit(); return { success: true, processedCount: docs.length }; }
export async function scanDuplicates(criteria: string) { const all = await getRawCollection('patients') as Patient[]; const groups: Record<string, Patient[]> = {}; all.forEach(p => { const key = criteria === 'expediente' ? String(p.expediente) : criteria === 'curp' ? p.curp : `${p.name}_${p.paternalLastName}`; if (key) { groups[key] = groups[key] || []; groups[key].push(p); } }); return Object.values(groups).filter(g => g.length > 1); }
export async function applyStatusUpdateChunk(exps: string[], s: string) { const snap = await getDocs(collection(adminDb, 'patients')); const batch = writeBatch(adminDb); let count = 0; snap.docs.forEach(d => { if (exps.includes(String(d.data().expediente))) { batch.update(d.ref, { status: s }); count++; } }); await batch.commit(); return { success: true, count }; }
export async function normalizeExpedientesAction() { const snap = await getDocs(collection(adminDb, 'patients')); const batch = writeBatch(adminDb); let count = 0; snap.docs.forEach(d => { const exp = d.data().expediente; if (exp && !String(exp).startsWith('0')) { batch.update(d.ref, { expediente: `0${exp}` }); count++; } }); await batch.commit(); return { success: true, count }; }
export async function downloadBackupAction() {
    const [apps, lab, xray, us, vac, pats, clins] = await Promise.all([getRawCollection('appointments'), getRawCollection('labAppointments'), getRawCollection('xrayAppointments'), getRawCollection('ultrasoundAppointments'), getRawCollection('vaccineAppointments'), getRawCollection('patients'), getRawCollection('clinics')]);
    return { success: true, data: { appointments: apps, labAppointments: lab, xRayAppointments: xray, ultrasoundAppointments: us, vaccineAppointments: vac, patients: pats, clinics: clins } };
}
export async function cleanupOldRecords() {
    const limit = new Date(); limit.setMonth(limit.getMonth() - 1); const limitStr = limit.toISOString();
    const cols = ['appointments', 'labAppointments', 'xrayAppointments', 'ultrasoundAppointments', 'vaccineAppointments', 'activityLog'];
    let total = 0;
    for (const c of cols) {
        const snap = await getDocs(collection(adminDb, c)); const batch = writeBatch(adminDb);
        snap.docs.forEach(d => { const date = d.data().date || d.data().timestamp; if (date && date < limitStr) { batch.delete(d.ref); total++; } });
        await batch.commit();
    }
    return { success: true, deletedCount: total };
}

// --- LOGS ---
export async function getLogsData() { const all = await getRawCollection('activityLog') as ActivityLog[]; return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 500); }
export async function logActivity(action: string, details: string) { await addDoc(collection(adminDb, 'activityLog'), { action, details, timestamp: new Date().toISOString() }); }

// --- CONSULTAS Y RECETAS ---
export async function getConsultationsByPatientId(pid: string) { const all = await getRawCollection('medicalConsultations') as MedicalConsultation[]; return all.filter(a => a.patientId === pid).sort((a, b) => b.date.localeCompare(a.date)); }
export async function saveMedicalConsultation(c: any) { const id = c.id || uuidv4(); await setDoc(doc(adminDb, 'medicalConsultations', id), { ...c, id }, { merge: true }); if (c.isFinal) await updateDoc(doc(adminDb, 'appointments', c.appointmentId), { status: 'Atendido' }); return { success: true, id }; }
export async function getConsultationByAppointmentId(aid: string) { const all = await getRawCollection('medicalConsultations') as MedicalConsultation[]; return all.find(a => a.appointmentId === aid) || null; }
export async function deleteMedicalConsultation(id: string) { await deleteDoc(doc(adminDb, 'medicalConsultations', id)); return { success: true }; }
export async function getPrescriptionsByPatientId(pid: string) { const all = await getRawCollection('prescriptions') as Prescription[]; return all.filter(a => a.patientId === pid).sort((a, b) => b.date.localeCompare(a.date)); }
export async function createPrescription(p: any) { const id = uuidv4(); const folio = `REC-${uuidv4().split('-')[0].toUpperCase()}`; const expAt = new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString(); const data = { ...p, id, folio, expiresAt: expAt, status: 'pendiente', createdAt: new Date().toISOString() }; await setDoc(doc(adminDb, 'prescriptions', id), data); return { success: true, folio, prescription: data }; }
export async function updatePrescription(id: string, p: any) { await updateDoc(doc(adminDb, 'prescriptions', id), p); return { success: true }; }
export async function deletePrescription(id: string) { await deleteDoc(doc(adminDb, 'prescriptions', id)); return { success: true }; }
export async function dispensePrescription(id: string, items: any[]) { const batch = writeBatch(adminDb); items.forEach(i => batch.update(doc(adminDb, 'medications', i.medicationId), { existencia: increment(-i.quantity) })); batch.update(doc(adminDb, 'prescriptions', id), { status: 'surtida', dispensedDate: new Date().toISOString() }); await batch.commit(); return { success: true }; }
export async function getPendingPrescriptions(f: any) { const all = await getRawCollection('prescriptions') as Prescription[]; let res = all.filter(d => d.status === 'pendiente'); if (f?.folio) res = res.filter(r => r.folio.toUpperCase() === f.folio.toUpperCase()); if (f?.clinicId && f.clinicId !== 'all') res = res.filter(r => r.clinicId === f.clinicId); return res.sort((a, b) => b.date.localeCompare(a.date)); }
export async function getPrescriptionHistory(f: any) { const all = await getRawCollection('prescriptions') as Prescription[]; let res = all.filter(d => d.status === 'surtida'); if (f?.startDate) res = res.filter(r => r.date >= f.startDate); if (f?.endDate) res = res.filter(r => r.date <= f.endDate); return res.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 100); }
export async function getPatientPrescriptionsCountTodayAction(pid: string) { const t = new Date(); t.setHours(0,0,0,0); const all = await getRawCollection('prescriptions') as Prescription[]; return all.filter(d => d.patientId === pid && d.date >= t.toISOString()).length; }
export async function getAppointmentCountOnDate(cid: string, d: string) { const all = await getRawCollection('appointments') as Appointment[]; return all.filter(a => a.clinicId === cid && a.date.startsWith(d)).length; }

// --- OTROS SETTINGS ---
export async function updateAnnouncements(msgs: string[]) { await setDoc(doc(adminDb, 'settings', 'announcements'), { messages: msgs }); return { success: true }; }
export async function getAnnouncementsData() { const snap = await getDoc(doc(adminDb, 'settings', 'announcements')); return snap.exists() ? snap.data()?.messages || [] : []; }
export async function getHolidaysData() { return getRawCollection('holidays'); }
export async function updateHolidays(hols: Holiday[]) { const batch = writeBatch(adminDb); const snap = await getDocs(collection(adminDb, 'holidays')); snap.docs.forEach(d => batch.delete(d.ref)); hols.forEach(h => batch.set(doc(adminDb, 'holidays', h.id || uuidv4()), h)); await batch.commit(); return { success: true }; }
export async function getSpecialActionDaysData() { return getRawCollection('specialActionDays'); }
export async function updateSpecialActionDays(items: SpecialActionDay[]) { const batch = writeBatch(adminDb); const snap = await getDocs(collection(adminDb, 'specialActionDays')); snap.docs.forEach(d => batch.delete(d.ref)); items.forEach(i => batch.set(doc(adminDb, 'specialActionDays', uuidv4()), i)); await batch.commit(); return { success: true }; }
export async function searchCie10Data(term: string) { const all = await getRawCollection('cie10_catalog') as Cie10Record[]; const u = term.toUpperCase(); return all.filter(r => (r.nombre || '').toUpperCase().includes(u) || (r.catalogKey || '').toUpperCase().includes(u)).slice(0, 50); }
export async function bulkInsertCie10Glossary(items: any[]) { const batch = writeBatch(adminDb); items.forEach(i => batch.set(doc(adminDb, 'cie10_glossary', uuidv4()), i)); await batch.commit(); return { success: true, processedCount: items.length }; }
export async function bulkInsertCie10Catalog(items: any[]) { const batch = writeBatch(adminDb); items.forEach(i => batch.set(doc(adminDb, 'cie10_catalog', uuidv4()), i)); await batch.commit(); return { success: true, processedCount: items.length }; }
export async function deleteAllCie10Glossary() { const snap = await getDocs(collection(adminDb, 'cie10_glossary')); const batch = writeBatch(adminDb); snap.docs.forEach(d => batch.delete(d.ref)); await batch.commit(); return { success: true }; }
export async function deleteAllCie10Catalog() { const snap = await getDocs(collection(adminDb, 'cie10_catalog')); const batch = writeBatch(adminDb); snap.docs.forEach(d => batch.delete(d.ref)); await batch.commit(); return { success: true }; }

export async function getLabSettings() { const snap = await getDoc(doc(adminDb, 'settings', 'labSettings')); return snap.exists() ? serializeData(snap.data()) : { dailySlots: 10, waitlistSlots: 0, weekendBookingEnabled: false }; }
export async function updateLabSettings(s: LabSettings) { await setDoc(doc(adminDb, 'settings', 'labSettings'), s); return { success: true }; }
export async function getXRaySettings() { const snap = await getDoc(doc(adminDb, 'settings', 'xraySettings')); return snap.exists() ? serializeData(snap.data()) : { dailySlots: 10, waitlistSlots: 0, weekendBookingEnabled: false }; }
export async function updateXRaySettings(s: XRaySettings) { await setDoc(doc(adminDb, 'settings', 'xraySettings'), s); return { success: true }; }
export async function getUltrasoundSettings() { const snap = await getDoc(doc(adminDb, 'settings', 'ultrasoundSettings')); return snap.exists() ? serializeData(snap.data()) : { dailySlots: 10, waitlistSlots: 0, weekendBookingEnabled: false }; }
export async function updateUltrasoundSettings(s: UltrasoundSettings) { await setDoc(doc(adminDb, 'settings', 'ultrasoundSettings'), s); return { success: true }; }
export async function getVaccineSettings() { const snap = await getDoc(doc(adminDb, 'settings', 'vaccineSettings')); return snap.exists() ? serializeData(snap.data()) : { dailySlots: 10, waitlistSlots: 0, weekendBookingEnabled: false }; }
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
export async function bulkInsertMedications(meds: any[]) { const batch = writeBatch(adminDb); meds.forEach(m => batch.set(doc(adminDb, 'medications', uuidv4()), m)); await batch.commit(); return { success: true, processedCount: meds.length }; }
export async function deleteAllMedications() { const snap = await getDocs(collection(adminDb, 'medications')); const batch = writeBatch(adminDb); snap.docs.forEach(d => batch.delete(d.ref)); await batch.commit(); return { success: true }; }
export async function getSupplies() { return getRawCollection('supplies'); }
export async function bulkInsertSupplies(supplies: any[]) { const batch = writeBatch(adminDb); supplies.forEach(s => batch.set(doc(adminDb, 'supplies', uuidv4()), s)); await batch.commit(); return { success: true, processedCount: supplies.length }; }
export async function deleteAllSupplies() { const snap = await getDocs(collection(adminDb, 'supplies')); const batch = writeBatch(adminDb); snap.docs.forEach(d => batch.delete(d.ref)); await batch.commit(); return { success: true }; }
export async function getAttendedPatientsForClinic(cid: string) { const allApps = await getRawCollection('appointments') as Appointment[]; const ids = Array.from(new Set(allApps.filter(d => d.clinicId === cid && d.status === 'Atendido').map(d => d.patientId))); if (ids.length === 0) return []; const pats = await getRawCollection('patients') as Patient[]; return pats.filter(d => ids.includes(d.id)); }
export async function getClinicsData() { return getRawCollection('clinics'); }
export async function updateClinics(clinics: Clinic[]) { const batch = writeBatch(adminDb); const snap = await getDocs(collection(adminDb, 'clinics')); snap.docs.forEach(d => batch.delete(d.ref)); clinics.forEach(c => batch.set(doc(adminDb, 'clinics', c.id), c)); await batch.commit(); return { success: true }; }
export async function deleteClinic(id: string) { await deleteDoc(doc(adminDb, 'clinics', id)); return { success: true }; }
export async function getColoniasData() { return getRawCollection('colonias'); }
export async function updateColonias(colonias: Colonia[]) { const batch = writeBatch(adminDb); const snap = await getDocs(collection(adminDb, 'colonias')); snap.docs.forEach(d => batch.delete(d.ref)); colonias.forEach(c => batch.set(doc(adminDb, 'colonias', c.id), c)); await batch.commit(); return { success: true }; }
