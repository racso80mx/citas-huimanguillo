
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  writeBatch, 
  Timestamp, 
  setDoc,
  updateDoc,
  deleteDoc,
  increment,
  addDoc,
  serverTimestamp,
  orderBy,
  limit
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

/** Utility to convert Firestore Timestamps to ISO strings for Next.js Serializability. */
export function serializeData(data: any): any {
  if (!data) return data;
  const serialized = { ...data };
  for (const key in serialized) {
    if (serialized[key] instanceof Timestamp) {
      serialized[key] = serialized[key].toDate().toISOString();
    } else if (Array.isArray(serialized[key])) {
      serialized[key] = serialized[key].map(item => serializeData(item));
    } else if (typeof serialized[key] === 'object' && serialized[key] !== null) {
      serialized[key] = serializeData(serialized[key]);
    }
  }
  return serialized;
}

// --- MODULE SETTINGS ---
export async function getModuleSettings(): Promise<ModuleSettings> {
  const snap = await getDoc(doc(adminDb, 'settings', 'moduleSettings'));
  if (snap.exists()) {
    return serializeData(snap.data()) as ModuleSettings;
  }
  const defaultSettings: ModuleSettings = {
    citasMedicasEnabled: true,
    laboratorioEnabled: true,
    rayosXEnabled: true,
    ultrasoundEnabled: true,
    vacunasEnabled: true,
    archivoEnabled: true,
    farmaciaEnabled: true,
    almacenEnabled: true,
    archivoConsultaEnabled: true,
    citasMedicasWhatsAppEnabled: true,
    laboratorioWhatsAppEnabled: true,
    rayosXWhatsAppEnabled: true,
    ultrasoundWhatsAppEnabled: true,
    vacunasWhatsAppEnabled: true,
    archivoWhatsAppEnabled: true,
    citasMedicasPassword: 'Citas',
    archivoConsultaPassword: 'Consulta'
  };
  await setDoc(doc(adminDb, 'settings', 'moduleSettings'), defaultSettings);
  return defaultSettings;
}

export async function updateModuleSettings(settings: ModuleSettings) {
    await setDoc(doc(adminDb, 'settings', 'moduleSettings'), settings);
    return { success: true };
}

// --- CATALOGS ---
export async function getServiceTypesData(): Promise<ServiceType[]> {
  const snap = await getDocs(collection(adminDb, 'serviceTypes'));
  if (snap.empty) {
    const initial: ServiceType[] = [
      { id: '1', name: 'CONSULTA EXTERNA', available: true },
      { id: '2', name: 'CONSULTA EXTERNA ESPECIALIZADA', available: true },
      { id: '3', name: 'PSICOLOGÍA', available: true },
      { id: '4', name: 'NUTRICIÓN', available: true },
      { id: '5', name: 'ODONTOLOGÍA', available: true }
    ];
    const batch = writeBatch(adminDb);
    initial.forEach(t => batch.set(doc(adminDb, 'serviceTypes', t.id), t));
    await batch.commit();
    return initial;
  }
  return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as ServiceType)).sort((a, b) => a.name.localeCompare(b.name));
}

export async function updateServiceTypes(types: ServiceType[]) {
    const batch = writeBatch(adminDb);
    const snap = await getDocs(collection(adminDb, 'serviceTypes'));
    snap.docs.forEach(d => batch.delete(d.ref));
    types.forEach(t => batch.set(doc(adminDb, 'serviceTypes', t.id), t));
    await batch.commit();
    return { success: true };
}

export async function getSpecialtiesData(): Promise<Specialty[]> {
  const snap = await getDocs(collection(adminDb, 'specialties'));
  return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as Specialty)).sort((a, b) => a.name.localeCompare(b.name));
}

export async function updateSpecialties(specialties: Specialty[]) {
    const batch = writeBatch(adminDb);
    const snap = await getDocs(collection(adminDb, 'specialties'));
    snap.docs.forEach(d => batch.delete(d.ref));
    specialties.forEach(s => batch.set(doc(adminDb, 'specialties', s.id), s));
    await batch.commit();
    return { success: true };
}

// --- PATIENTS (IN-MEMORY FILTERING TO AVOID INDEX ERRORS) ---
export async function getPatientsData(options?: any): Promise<Patient[]> {
  const snap = await getDocs(collection(adminDb, 'patients'));
  let results = snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as Patient));
  
  if (options?.status && options.status !== 'Total') {
    results = results.filter(p => (p.status || PatientStatus.Vigente) === options.status);
  }

  if (options?.searchName) {
    const term = options.searchName.toUpperCase();
    results = results.filter(p => `${p.name} ${p.paternalLastName} ${p.maternalLastName}`.toUpperCase().includes(term));
  }
  if (options?.searchCurp) {
    results = results.filter(p => (p.curp || '').toUpperCase().includes(options.searchCurp.toUpperCase()));
  }
  if (options?.searchExpediente) {
    results = results.filter(p => String(p.expediente || '').includes(options.searchExpediente));
  }
  
  // Always sort in-memory to ensure reliability without custom indices
  results.sort((a, b) => (a.paternalLastName || '').localeCompare(b.paternalLastName || ''));

  return results.slice(0, options?.limitNum || 2000);
}

export async function getPatientCounts(): Promise<ArchiveCounts> {
  const snap = await getDocs(collection(adminDb, 'patients'));
  const patients = snap.docs.map(d => d.data() as Patient);
  return {
    total: patients.length,
    vigente: patients.filter(p => !p.status || p.status === PatientStatus.Vigente).length,
    bajaTemporal: patients.filter(p => p.status === PatientStatus.Baja).length,
    bajaDefinitiva: patients.filter(p => p.status === PatientStatus.BajaDefinitiva).length,
  };
}

export async function savePatient(patient: Omit<Patient, 'id'>, id?: string) {
    const patientId = id || patient.curp;
    await setDoc(doc(adminDb, 'patients', patientId), { ...patient, id: patientId });
    return { success: true };
}

export async function updatePatient(id: string, patient: Partial<Patient>) {
    await updateDoc(doc(adminDb, 'patients', id), patient);
    return { success: true };
}

export async function updatePatientStatus(id: string, status: string) {
    await updateDoc(doc(adminDb, 'patients', id), { status });
    return { success: true };
}

export async function deletePatient(id: string) {
    await deleteDoc(doc(adminDb, 'patients', id));
    return { success: true };
}

export async function deletePatients(ids: string[]) {
    const batch = writeBatch(adminDb);
    ids.forEach(id => batch.delete(doc(adminDb, 'patients', id)));
    await batch.commit();
    return { success: true };
}

export async function getPatientByCURP(curp: string) {
    const snap = await getDocs(collection(adminDb, 'patients'));
    const docMatch = snap.docs.find(d => d.data().curp?.toUpperCase() === curp.toUpperCase());
    if (!docMatch) return { success: false };
    return { success: true, data: serializeData(docMatch.data()) as Patient };
}

// --- APPOINTMENTS ---
export async function getAppointmentsData() {
    const snap = await getDocs(collection(adminDb, 'appointments'));
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id }));
}

export async function getLabAppointmentsData() {
    const snap = await getDocs(collection(adminDb, 'labAppointments'));
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id }));
}

export async function getXRayAppointmentsData() {
    const snap = await getDocs(collection(adminDb, 'xrayAppointments'));
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id }));
}

export async function getUltrasoundAppointmentsData() {
    const snap = await getDocs(collection(adminDb, 'ultrasoundAppointments'));
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id }));
}

export async function getVaccineAppointmentsData() {
    const snap = await getDocs(collection(adminDb, 'vaccineAppointments'));
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id }));
}

export async function updateAppointmentStatus(appointmentId: string, status: string, type: string) {
    const colMap: Record<string, string> = {
        medical: 'appointments',
        lab: 'labAppointments',
        xray: 'xrayAppointments',
        ultrasound: 'ultrasoundAppointments',
        vaccine: 'vaccineAppointments'
    };
    const colName = colMap[type] || 'appointments';
    await updateDoc(doc(adminDb, colName, appointmentId), { status });
    return { success: true };
}

export async function deleteAppointment(id: string) { await deleteDoc(doc(adminDb, 'appointments', id)); return { success: true }; }
export async function deleteLabAppointment(id: string) { await deleteDoc(doc(adminDb, 'labAppointments', id)); return { success: true }; }
export async function deleteXRayAppointment(id: string) { await deleteDoc(doc(adminDb, 'xrayAppointments', id)); return { success: true }; }
export async function deleteUltrasoundAppointment(id: string) { await deleteDoc(doc(adminDb, 'ultrasoundAppointments', id)); return { success: true }; }
export async function deleteVaccineAppointment(id: string) { await deleteDoc(doc(adminDb, 'vaccineAppointments', id)); return { success: true }; }

export async function rescheduleAppointment(id: string, date: string, type: string) {
    const colMap: Record<string, string> = {
        medical: 'appointments',
        lab: 'labAppointments',
        xray: 'xrayAppointments',
        ultrasound: 'ultrasoundAppointments',
        vaccine: 'vaccineAppointments'
    };
    await updateDoc(doc(adminDb, colMap[type], id), { date });
    return { success: true, message: 'Fecha actualizada.' };
}

export async function cloneAppointment(id: string, date: string, type: string, time?: string) {
    const colMap: Record<string, string> = {
        medical: 'appointments',
        lab: 'labAppointments',
        xray: 'xrayAppointments',
        ultrasound: 'ultrasoundAppointments',
        vaccine: 'vaccineAppointments'
    };
    const snap = await getDoc(doc(adminDb, colMap[type], id));
    if (!snap.exists()) return { success: false, message: 'Original no encontrada' };
    const original = snap.data();
    const newId = uuidv4();
    const newData = {
        ...original,
        id: newId,
        date,
        time: time || original.time,
        appointmentNumber: `${original.appointmentNumber}-CL`,
        status: 'Agendada',
        createdAt: new Date().toISOString()
    };
    await setDoc(doc(adminDb, colMap[type], newId), newData);
    return { success: true, message: `Clonada con éxito.` };
}

export async function getAppointmentsForCalendar(month: number, year: number) {
    const snap = await getDocs(collection(adminDb, 'appointments'));
    const all = snap.docs.map(d => serializeData(d.data()));
    return all.filter(a => {
        const d = new Date(a.date);
        return d.getMonth() === month && d.getFullYear() === year;
    });
}

export async function getAppointmentsForClinic(clinicId: string) {
    const snap = await getDocs(collection(adminDb, 'appointments'));
    return snap.docs.filter(d => d.data().clinicId === clinicId).map(d => serializeData(d.data()));
}

export async function getAvailableSlotsForDate(clinicId: string, date: string) {
    const clinicSnap = await getDoc(doc(adminDb, 'clinics', clinicId));
    if (!clinicSnap.exists()) return {};
    const clinic = clinicSnap.data() as Clinic;
    const snap = await getDocs(collection(adminDb, 'appointments'));
    const booked = snap.docs
        .filter(d => d.data().clinicId === clinicId && d.data().date === date)
        .map(d => d.data().time);
        
    if (clinic.bookingMode === BookingMode.Token) {
        const tokens = Array.from({ length: clinic.dailySlots }, (_, i) => i + 1).filter(t => !booked.includes(`Ficha ${t}`));
        return { tokens };
    }
    const times = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00"].filter(t => !booked.includes(t));
    return { timeSlots: times };
}

export async function saveNewAppointment(appointment: any, patient: any, isDouble: boolean, colonia?: string) {
    const batch = writeBatch(adminDb);
    batch.set(doc(adminDb, 'patients', patient.curp), patient, { merge: true });
    const id = uuidv4();
    const data = { ...appointment, id, patientId: patient.curp, coloniaName: colonia || null, createdAt: new Date().toISOString() };
    batch.set(doc(adminDb, 'appointments', id), data);
    await batch.commit();
    const clinicSnap = await getDoc(doc(adminDb, 'clinics', appointment.clinicId));
    return { success: true, data: { appointment: data, clinic: serializeData(clinicSnap.data()) } };
}

export async function saveNewLabAppointment(appointment: any, patient: any) {
    const batch = writeBatch(adminDb);
    batch.set(doc(adminDb, 'patients', patient.curp), patient, { merge: true });
    const id = uuidv4();
    const data = { ...appointment, id, patientId: patient.curp, createdAt: new Date().toISOString() };
    batch.set(doc(adminDb, 'labAppointments', id), data);
    await batch.commit();
    return { success: true, data };
}

export async function saveNewXRayAppointment(appointment: any, patient: any) {
    const batch = writeBatch(adminDb);
    batch.set(doc(adminDb, 'patients', patient.curp), patient, { merge: true });
    const id = uuidv4();
    const data = { ...appointment, id, patientId: patient.curp, createdAt: new Date().toISOString() };
    batch.set(doc(adminDb, 'xrayAppointments', id), data);
    await batch.commit();
    const studySnap = await getDoc(doc(adminDb, 'xRayStudies', appointment.studyId));
    return { success: true, data: { appointment: data, study: serializeData(studySnap.data()) } };
}

export async function saveNewUltrasoundAppointment(appointment: any, patient: any) {
    const batch = writeBatch(adminDb);
    batch.set(doc(adminDb, 'patients', patient.curp), patient, { merge: true });
    const id = uuidv4();
    const data = { ...appointment, id, patientId: patient.curp, createdAt: new Date().toISOString() };
    batch.set(doc(adminDb, 'ultrasoundAppointments', id), data);
    await batch.commit();
    const studySnap = await getDoc(doc(adminDb, 'ultrasoundStudies', appointment.studyId));
    return { success: true, data: { appointment: data, study: serializeData(studySnap.data()) } };
}

export async function saveNewVaccineAppointment(appointment: any, patient: any) {
    const batch = writeBatch(adminDb);
    batch.set(doc(adminDb, 'patients', patient.curp), patient, { merge: true });
    const id = uuidv4();
    const data = { ...appointment, id, patientId: patient.curp, createdAt: new Date().toISOString() };
    batch.set(doc(adminDb, 'vaccineAppointments', id), data);
    await batch.commit();
    return { success: true, data };
}

// --- CLINICS & COLONIAS ---
export async function getClinicsData() {
    const snap = await getDocs(collection(adminDb, 'clinics'));
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id }));
}

export async function updateClinics(clinics: Clinic[]) {
    const batch = writeBatch(adminDb);
    clinics.forEach(c => batch.set(doc(adminDb, 'clinics', c.id), c));
    await batch.commit();
    return { success: true };
}

export async function deleteClinic(id: string) {
    await deleteDoc(doc(adminDb, 'clinics', id));
    return { success: true };
}

export async function getColoniasData() {
    const snap = await getDocs(collection(adminDb, 'colonias'));
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id }));
}

export async function updateColonias(colonias: Colonia[]) {
    const batch = writeBatch(adminDb);
    const snap = await getDocs(collection(adminDb, 'colonias'));
    snap.docs.forEach(d => batch.delete(d.ref));
    colonias.forEach(c => batch.set(doc(adminDb, 'colonias', c.id), c));
    await batch.commit();
    return { success: true };
}

// --- MAINTENANCE & BULK ---
export async function bulkInsertPatients(patients: any[]) {
    const batch = writeBatch(adminDb);
    for (const p of patients) {
        const id = p.CURP || uuidv4();
        batch.set(doc(adminDb, 'patients', id), { ...p, id, curp: p.CURP || '', status: p.Estatus || 'Vigente' });
    }
    await batch.commit();
    return { success: true, processedCount: patients.length };
}

export async function bulkInsertDoctors(doctors: any[]) {
    const batch = writeBatch(adminDb);
    for (const d of doctors) {
        const id = uuidv4();
        batch.set(doc(adminDb, 'clinics', id), { ...d, id, name: d.Unidad || d.name, doctorName: d.Médico || d.doctorName });
    }
    await batch.commit();
    return { success: true, processedCount: doctors.length };
}

export async function scanDuplicates(criteria: string) {
    const snap = await getDocs(collection(adminDb, 'patients'));
    const patients = snap.docs.map(d => ({ ...d.data(), id: d.id } as Patient));
    const groups: Record<string, Patient[]> = {};
    patients.forEach(p => {
        let key = criteria === 'expediente' ? (p.expediente || 'none') : criteria === 'curp' ? p.curp : `${p.name} ${p.paternalLastName}`;
        if (key !== 'none') {
            if (!groups[key]) groups[key] = [];
            groups[key].push(p);
        }
    });
    return Object.values(groups).filter(g => g.length > 1);
}

export async function applyStatusUpdateChunk(expedientes: string[], status: string) {
    const batch = writeBatch(adminDb);
    const snap = await getDocs(collection(adminDb, 'patients'));
    let count = 0;
    snap.docs.forEach(d => {
        const data = d.data();
        if (expedientes.includes(String(data.expediente))) {
            batch.update(d.ref, { status });
            count++;
        }
    });
    await batch.commit();
    return { success: true, count };
}

export async function normalizeExpedientesAction() {
    const snap = await getDocs(collection(adminDb, 'patients'));
    const batch = writeBatch(adminDb);
    let count = 0;
    snap.docs.forEach(d => {
        const data = d.data();
        if (data.expediente && !data.expediente.startsWith('0')) {
            batch.update(d.ref, { expediente: `0${data.expediente}` });
            count++;
        }
    });
    await batch.commit();
    return { success: true, count };
}

export async function downloadBackupAction() {
    const [apps, lab, xray, us, vac, pats, clins] = await Promise.all([
        getAppointmentsData(), getLabAppointmentsData(), getXRayAppointmentsData(),
        getUltrasoundAppointmentsData(), getVaccineAppointmentsData(),
        getPatientsData(), getClinicsData()
    ]);
    return { success: true, data: { appointments: apps, labAppointments: lab, xRayAppointments: xray, ultrasoundAppointments: us, vaccineAppointments: vac, patients: pats, clinics: clins } };
}

export async function cleanupOldRecords() {
    const lastMonth = new Date(); lastMonth.setMonth(lastMonth.getMonth() - 1);
    const limitDate = lastMonth.toISOString();
    const cols = ['appointments', 'labAppointments', 'xrayAppointments', 'ultrasoundAppointments', 'vaccineAppointments', 'activityLog'];
    let total = 0;
    for (const col of cols) {
        const q = query(collection(adminDb, col), where('date', '<', limitDate));
        const snap = await getDocs(q);
        const batch = writeBatch(adminDb);
        snap.docs.forEach(d => { batch.delete(d.ref); total++; });
        await batch.commit();
    }
    return { success: true, deletedCount: total };
}

export async function bulkInsertCie10Glossary(items: any[]) {
    const batch = writeBatch(adminDb);
    items.forEach(i => batch.set(doc(adminDb, 'cie10_glossary', uuidv4()), i));
    await batch.commit(); return { success: true, processedCount: items.length };
}

export async function bulkInsertCie10Catalog(items: any[]) {
    const batch = writeBatch(adminDb);
    items.forEach(i => batch.set(doc(adminDb, 'cie10_catalog', uuidv4()), i));
    await batch.commit(); return { success: true, processedCount: items.length };
}

export async function deleteAllCie10Glossary() { const batch = writeBatch(adminDb); const snap = await getDocs(collection(adminDb, 'cie10_glossary')); snap.docs.forEach(d => batch.delete(d.ref)); await batch.commit(); return { success: true }; }
export async function deleteAllCie10Catalog() { const batch = writeBatch(adminDb); const snap = await getDocs(collection(adminDb, 'cie10_catalog')); snap.docs.forEach(d => batch.delete(d.ref)); await batch.commit(); return { success: true }; }

// --- SECURITY ---
export async function getAdminSettingsData() {
    const snap = await getDoc(doc(adminDb, 'settings', 'admin'));
    return snap.exists() ? serializeData(snap.data()) : { password: 'Hu1m4ngu1ll0' };
}
export async function updateAdminSettings(settings: AdminSettings) { await setDoc(doc(adminDb, 'settings', 'admin'), settings); return { success: true }; }
export async function getArchiveSettingsData() {
    const snap = await getDoc(doc(adminDb, 'settings', 'archive'));
    return snap.exists() ? serializeData(snap.data()) : { password: 'ArchivoPassword' };
}
export async function updateArchiveSettings(settings: ArchiveSettings) { await setDoc(doc(adminDb, 'settings', 'archive'), settings); return { success: true }; }
export async function getPharmacySettingsData() {
    const snap = await getDoc(doc(adminDb, 'settings', 'pharmacy'));
    return snap.exists() ? serializeData(snap.data()) : { password: 'PharmacyPassword' };
}
export async function updatePharmacySettings(settings: PharmacySettings) { await setDoc(doc(adminDb, 'settings', 'pharmacy'), settings); return { success: true }; }
export async function getWarehouseSettingsData() {
    const snap = await getDoc(doc(adminDb, 'settings', 'warehouse'));
    return snap.exists() ? serializeData(snap.data()) : { password: 'WarehousePassword' };
}
export async function updateWarehouseSettings(settings: WarehouseSettings) { await setDoc(doc(adminDb, 'settings', 'warehouse'), settings); return { success: true }; }
export async function getBISettingsData() {
    const snap = await getDoc(doc(adminDb, 'settings', 'bi'));
    return snap.exists() ? serializeData(snap.data()) : { password: 'BIPassword' };
}
export async function updateBISettings(settings: BISettings) { await setDoc(doc(adminDb, 'settings', 'bi'), settings); return { success: true }; }

export async function verifyAdminPassword(p: string) { const s = await getAdminSettingsData(); return s.password === p ? { success: true } : { success: false, message: 'Incorrecta' }; }
export async function verifyArchivePassword(p: string) { const s = await getArchiveSettingsData(); return s.password === p ? { success: true } : { success: false, message: 'Incorrecta' }; }
export async function verifyPharmacyPassword(p: string) { const s = await getPharmacySettingsData(); return s.password === p ? { success: true } : { success: false, message: 'Incorrecta' }; }
export async function verifyWarehousePassword(p: string) { const s = await getWarehouseSettingsData(); return s.password === p ? { success: true } : { success: false, message: 'Incorrecta' }; }
export async function verifyBIPassword(p: string) { const s = await getBISettingsData(); return s.password === p ? { success: true } : { success: false, message: 'Incorrecta' }; }
export async function verifyCitasMedicasPassword(p: string) { const s = await getModuleSettings(); return s.citasMedicasPassword === p ? { success: true } : { success: false, message: 'Incorrecta' }; }
export async function verifyLabPassword(p: string) { const s = await getLabSettings(); return s.password === p ? { success: true } : { success: false, message: 'Incorrecta' }; }
export async function verifyXRayPassword(p: string) { const s = await getXRaySettings(); return s.password === p ? { success: true } : { success: false, message: 'Incorrecta' }; }
export async function verifyUltrasoundPassword(p: string) { const s = await getUltrasoundSettings(); return s.password === p ? { success: true } : { success: false, message: 'Incorrecta' }; }
export async function verifyVaccinePassword(p: string) { const s = await getVaccineSettings(); return s.password === p ? { success: true } : { success: false, message: 'Incorrecta' }; }
export async function verifyClinicPassword(id: string, p: string) { const snap = await getDoc(doc(adminDb, 'clinics', id)); return snap.exists() && snap.data()?.password === p ? { success: true } : { success: false, message: 'Incorrecta' }; }

// --- LOGS ---
export async function getLogsData(): Promise<ActivityLog[]> {
    const q = query(collection(adminDb, 'activityLog'), orderBy('timestamp', 'desc'), limit(500));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as ActivityLog));
}
export async function logActivity(action: string, details: string) {
    await addDoc(collection(adminDb, 'activityLog'), { action, details, timestamp: serverTimestamp() });
}

// --- CONSULTATIONS & PRESCRIPTIONS ---
export async function getConsultationsByPatientId(patientId: string) {
    const snap = await getDocs(collection(adminDb, 'medicalConsultations'));
    return snap.docs
        .filter(d => d.data().patientId === patientId)
        .map(d => ({ ...serializeData(d.data()), id: d.id } as MedicalConsultation))
        .sort((a, b) => b.date.localeCompare(a.date));
}
export async function saveMedicalConsultation(consultation: any) {
    const id = consultation.id || uuidv4();
    await setDoc(doc(adminDb, 'medicalConsultations', id), { ...consultation, id }, { merge: true });
    if (consultation.isFinal) await updateDoc(doc(adminDb, 'appointments', consultation.appointmentId), { status: 'Atendido' });
    return { success: true, id };
}
export async function deleteMedicalConsultation(id: string) { await deleteDoc(doc(adminDb, 'medicalConsultations', id)); return { success: true }; }
export async function getConsultationByAppointmentId(appId: string) {
    const snap = await getDocs(collection(adminDb, 'medicalConsultations'));
    const match = snap.docs.find(d => d.data().appointmentId === appId);
    return match ? { ...serializeData(match.data()), id: match.id } as MedicalConsultation : null;
}
export async function getPrescriptionsByPatientId(patientId: string) {
    const snap = await getDocs(collection(adminDb, 'prescriptions'));
    return snap.docs
        .filter(d => d.data().patientId === patientId)
        .map(d => ({ ...serializeData(d.data()), id: d.id } as Prescription))
        .sort((a, b) => b.date.localeCompare(a.date));
}
export async function createPrescription(p: any) {
    const id = uuidv4();
    const folio = `REC-${uuidv4().split('-')[0].toUpperCase()}`;
    const expiresAt = new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString();
    const data = { ...p, id, folio, expiresAt, status: 'pendiente', createdAt: new Date().toISOString() };
    await setDoc(doc(adminDb, 'prescriptions', id), data);
    return { success: true, folio, prescription: data };
}
export async function updatePrescription(id: string, p: any) { await updateDoc(doc(adminDb, 'prescriptions', id), p); return { success: true }; }
export async function deletePrescription(id: string) { await deleteDoc(doc(adminDb, 'prescriptions', id)); return { success: true }; }
export async function dispensePrescription(id: string, items: any[]) {
    const batch = writeBatch(adminDb);
    items.forEach(item => batch.update(doc(adminDb, 'medications', item.medicationId), { existencia: increment(-item.quantity) }));
    batch.update(doc(adminDb, 'prescriptions', id), { status: 'surtida', dispensedDate: new Date().toISOString() });
    await batch.commit();
    return { success: true };
}

// --- OTHERS ---
export async function getAnnouncementsData() {
    const snap = await getDoc(doc(adminDb, 'settings', 'announcements'));
    return snap.exists() ? snap.data()?.messages || [] : [];
}
export async function updateAnnouncements(messages: string[]) { await setDoc(doc(adminDb, 'settings', 'announcements'), { messages }); return { success: true }; }
export async function getHolidaysData() {
    const snap = await getDocs(collection(adminDb, 'holidays'));
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as Holiday));
}
export async function updateHolidays(holidays: Holiday[]) {
    const batch = writeBatch(adminDb);
    const snap = await getDocs(collection(adminDb, 'holidays'));
    snap.docs.forEach(d => batch.delete(d.ref));
    holidays.forEach(h => batch.set(doc(adminDb, 'holidays', h.id || uuidv4()), h));
    await batch.commit();
    return { success: true };
}
export async function getSpecialActionDaysData() {
    const snap = await getDocs(collection(adminDb, 'specialActionDays'));
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as SpecialActionDay));
}
export async function updateSpecialActionDays(items: SpecialActionDay[]) {
    const batch = writeBatch(adminDb);
    const snap = await getDocs(collection(adminDb, 'specialActionDays'));
    snap.docs.forEach(d => batch.delete(d.ref));
    items.forEach(i => batch.set(doc(adminDb, 'specialActionDays', uuidv4()), i));
    await batch.commit();
    return { success: true };
}

export async function searchCie10Data(term: string) {
    const snap = await getDocs(collection(adminDb, 'cie10_catalog'));
    const upperTerm = term.toUpperCase();
    return snap.docs
        .map(d => ({ ...serializeData(d.data()), id: d.id } as Cie10Record))
        .filter(r => (r.nombre || '').toUpperCase().includes(upperTerm) || (r.catalogKey || '').toUpperCase().includes(upperTerm))
        .slice(0, 50);
}

export async function getLabSettings() { const snap = await getDoc(doc(adminDb, 'settings', 'labSettings')); return snap.exists() ? serializeData(snap.data()) : { dailySlots: 10, waitlistSlots: 0, weekendBookingEnabled: false }; }
export async function updateLabSettings(s: LabSettings) { await setDoc(doc(adminDb, 'settings', 'labSettings'), s); return { success: true }; }
export async function getXRaySettings() { const snap = await getDoc(doc(adminDb, 'settings', 'xraySettings')); return snap.exists() ? serializeData(snap.data()) : { dailySlots: 10, waitlistSlots: 0, weekendBookingEnabled: false }; }
export async function updateXRaySettings(s: XRaySettings) { await setDoc(doc(adminDb, 'settings', 'xraySettings'), s); return { success: true }; }
export async function getUltrasoundSettings() { const snap = await getDoc(doc(adminDb, 'settings', 'ultrasoundSettings')); return snap.exists() ? serializeData(snap.data()) : { dailySlots: 10, waitlistSlots: 0, weekendBookingEnabled: false }; }
export async function updateUltrasoundSettings(s: UltrasoundSettings) { await setDoc(doc(adminDb, 'settings', 'ultrasoundSettings'), s); return { success: true }; }
export async function getVaccineSettings() { const snap = await getDoc(doc(adminDb, 'settings', 'vaccineSettings')); return snap.exists() ? serializeData(snap.data()) : { dailySlots: 10, waitlistSlots: 0, weekendBookingEnabled: false }; }
export async function updateVaccineSettings(s: VaccineSettings) { await setDoc(doc(adminDb, 'settings', 'vaccineSettings'), s); return { success: true }; }

export async function getLabStudies() { const snap = await getDocs(collection(adminDb, 'labStudies')); return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as LabStudy)); }
export async function updateLabStudies(s: LabStudy[]) {
    const batch = writeBatch(adminDb);
    const snap = await getDocs(collection(adminDb, 'labStudies'));
    snap.docs.forEach(d => batch.delete(d.ref));
    s.forEach(i => batch.set(doc(adminDb, 'labStudies', i.id), i));
    await batch.commit();
    return { success: true };
}

export async function getXRayStudies() { const snap = await getDocs(collection(adminDb, 'xRayStudies')); return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as XRayStudy)); }
export async function updateXRayStudies(s: XRayStudy[]) {
    const batch = writeBatch(adminDb);
    const snap = await getDocs(collection(adminDb, 'xRayStudies'));
    snap.docs.forEach(d => batch.delete(d.ref));
    s.forEach(i => batch.set(doc(adminDb, 'xRayStudies', i.id), i));
    await batch.commit();
    return { success: true };
}

export async function getUltrasoundStudies() { const snap = await getDocs(collection(adminDb, 'ultrasoundStudies')); return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as UltrasoundStudy)); }
export async function updateUltrasoundStudies(s: UltrasoundStudy[]) {
    const batch = writeBatch(adminDb);
    const snap = await getDocs(collection(adminDb, 'ultrasoundStudies'));
    snap.docs.forEach(d => batch.delete(d.ref));
    s.forEach(i => batch.set(doc(adminDb, 'ultrasoundStudies', i.id), i));
    await batch.commit();
    return { success: true };
}

export async function getVaccines() { const snap = await getDocs(collection(adminDb, 'vaccines')); return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as Vaccine)); }
export async function updateVaccines(v: Vaccine[]) {
    const batch = writeBatch(adminDb);
    const snap = await getDocs(collection(adminDb, 'vaccines'));
    snap.docs.forEach(d => batch.delete(d.ref));
    v.forEach(i => batch.set(doc(adminDb, 'vaccines', i.id), i));
    await batch.commit();
    return { success: true };
}

export async function getMedications() { const snap = await getDocs(collection(adminDb, 'medications')); return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as Medication)); }
export async function bulkInsertMedications(meds: any[]) {
    const batch = writeBatch(adminDb);
    meds.forEach(m => batch.set(doc(adminDb, 'medications', uuidv4()), m));
    await batch.commit();
    return { success: true, processedCount: meds.length };
}
export async function deleteAllMedications() { const batch = writeBatch(adminDb); const snap = await getDocs(collection(adminDb, 'medications')); snap.docs.forEach(d => batch.delete(d.ref)); await batch.commit(); return { success: true }; }

export async function getSupplies() { const snap = await getDocs(collection(adminDb, 'supplies')); return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as Supply)); }
export async function bulkInsertSupplies(supplies: any[]) {
    const batch = writeBatch(adminDb);
    supplies.forEach(s => batch.set(doc(adminDb, 'supplies', uuidv4()), s));
    await batch.commit();
    return { success: true, processedCount: supplies.length };
}
export async function deleteAllSupplies() { const batch = writeBatch(adminDb); const snap = await getDocs(collection(adminDb, 'supplies')); snap.docs.forEach(d => batch.delete(d.ref)); await batch.commit(); return { success: true }; }

export async function getAttendedPatientsForClinic(clinicId: string) {
    const snap = await getDocs(collection(adminDb, 'appointments'));
    const ids = Array.from(new Set(snap.docs
        .filter(d => d.data().clinicId === clinicId && d.data().status === 'Atendido')
        .map(d => d.data().patientId)));
    if (ids.length === 0) return [];
    const patsSnap = await getDocs(collection(adminDb, 'patients'));
    return patsSnap.docs.filter(d => ids.includes(d.id)).map(d => ({ ...serializeData(d.data()), id: d.id } as Patient));
}

export async function getPrescriptionHistory(filters: any) {
    const snap = await getDocs(collection(adminDb, 'prescriptions'));
    let results = snap.docs
        .filter(d => d.data().status === 'surtida')
        .map(d => ({ ...serializeData(d.data()), id: d.id } as Prescription));
        
    if (filters?.startDate) {
        results = results.filter(r => r.date >= filters.startDate);
    }
    if (filters?.endDate) {
        results = results.filter(r => r.date <= filters.endDate);
    }
    
    return results.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 100);
}

export async function getPendingPrescriptions(filters: any) {
    const snap = await getDocs(collection(adminDb, 'prescriptions'));
    let results = snap.docs
        .filter(d => d.data().status === 'pendiente')
        .map(d => ({ ...serializeData(d.data()), id: d.id } as Prescription));
    
    if (filters?.folio) {
        results = results.filter(r => r.folio.toUpperCase() === filters.folio.toUpperCase());
    }
    if (filters?.clinicId && filters.clinicId !== 'all') {
        results = results.filter(r => r.clinicId === filters.clinicId);
    }
    
    return results.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getPatientPrescriptionsCountTodayAction(patientId: string) {
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const isoToday = todayStart.toISOString();
    const snap = await getDocs(collection(adminDb, 'prescriptions'));
    return snap.docs.filter(d => d.data().patientId === patientId && d.data().date >= isoToday).length;
}

export async function getAppointmentCountOnDate(clinicId: string, date: string) {
    const snap = await getDocs(collection(adminDb, 'appointments'));
    return snap.docs.filter(d => d.data().clinicId === clinicId && d.data().date === date).length;
}
