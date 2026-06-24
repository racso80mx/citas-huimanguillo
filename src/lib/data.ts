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
  getCountFromServer,
  increment,
  addDoc
} from 'firebase/firestore';
import { adminDb } from '@/firebase/server-config';
import { v4 as uuidv4 } from 'uuid';
import { addDays, startOfDay, endOfDay, subMonths } from 'date-fns';
import type { 
    Patient, 
    PatientStatus, 
    Appointment, 
    AppointmentStatus, 
    Holiday, 
    SpecialActionDay, 
    Prescription, 
    Specialty, 
    ServiceType, 
    LabStudy, 
    LabSettings,
    XRayStudy, 
    XRaySettings,
    UltrasoundStudy, 
    UltrasoundSettings,
    Vaccine, 
    VaccineSettings,
    VaccineAppointment,
    MedicalConsultation,
    Cie10Record,
    ModuleSettings,
    AdminSettings,
    ArchiveSettings,
    PharmacySettings,
    WarehouseSettings,
    BISettings,
    Medication,
    Supply,
    ActivityLog,
    Colonia,
    Clinic
} from './definitions';
import { BookingMode } from './definitions';

// --- UTILS ---
function serializeData(data: any) {
  if (!data) return data;
  const serialized = { ...data };
  for (const key in serialized) {
    if (serialized[key] instanceof Timestamp) {
      serialized[key] = serialized[key].toDate().toISOString();
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
    citasMedicasPassword: 'citas',
    archivoConsultaPassword: 'consulta'
  };
  await setDoc(doc(adminDb, 'settings', 'moduleSettings'), defaultSettings);
  return defaultSettings;
}

export async function updateModuleSettings(settings: ModuleSettings) {
  await setDoc(doc(adminDb, 'settings', 'moduleSettings'), settings);
  return { success: true };
}

// --- SERVICE TYPES ---
export async function getServiceTypes(): Promise<ServiceType[]> {
  const snap = await getDocs(collection(adminDb, 'serviceTypes'));
  let results = snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as ServiceType);
  
  if (results.length === 0) {
      const initial = ['CONSULTA EXTERNA', 'CONSULTA EXTERNA ESPECIALIZADA', 'PSICOLOGÍA', 'NUTRICIÓN', 'ODONTOLOGÍA'];
      const batch = writeBatch(adminDb);
      const seeded: ServiceType[] = [];
      for (const name of initial) {
          const id = uuidv4();
          const item = { id, name, available: true };
          batch.set(doc(adminDb, 'serviceTypes', id), item);
          seeded.push(item);
      }
      await batch.commit();
      return seeded;
  }
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

export async function updateServiceTypes(serviceTypes: ServiceType[]) {
  const snap = await getDocs(collection(adminDb, 'serviceTypes'));
  const batch = writeBatch(adminDb);
  snap.docs.forEach(d => batch.delete(d.ref));
  for (const s of serviceTypes) {
      const id = s.id || uuidv4();
      batch.set(doc(adminDb, 'serviceTypes', id), { ...s, id, name: s.name.toUpperCase() });
  }
  await batch.commit();
  return { success: true };
}

// --- SPECIALTIES ---
export async function getSpecialties(): Promise<Specialty[]> {
  const snap = await getDocs(collection(adminDb, 'specialties'));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Specialty).sort((a,b) => a.name.localeCompare(b.name));
}

export async function updateSpecialties(specialties: Specialty[]) {
  const snap = await getDocs(collection(adminDb, 'specialties'));
  const batch = writeBatch(adminDb);
  snap.docs.forEach(d => batch.delete(d.ref));
  for (const s of specialties) {
      const id = s.id || uuidv4();
      batch.set(doc(adminDb, 'specialties', id), { ...s, id, name: s.name.toUpperCase() });
  }
  await batch.commit();
  return { success: true };
}

// --- PATIENTS ---
export async function getPatients(options?: any): Promise<Patient[]> {
    let q = query(collection(adminDb, 'patients'), orderBy('paternalLastName'), limit(options?.limitNum || 100));
    if (options?.status && options.status !== 'Total') {
        q = query(collection(adminDb, 'patients'), where('status', '==', options.status), orderBy('paternalLastName'), limit(options?.limitNum || 100));
    }
    const snap = await getDocs(q);
    let results = snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Patient);
    
    if (options?.searchName) {
        const term = options.searchName.toUpperCase();
        results = results.filter(p => `${p.name} ${p.paternalLastName} ${p.maternalLastName}`.toUpperCase().includes(term));
    }
    if (options?.searchCurp) {
        const term = options.searchCurp.toUpperCase();
        results = results.filter(p => p.curp.toUpperCase().includes(term));
    }
    if (options?.searchExpediente) {
        results = results.filter(p => String(p.expediente || '').includes(options.searchExpediente));
    }
    return results;
}

export async function getPatientByCURP(curp: string) {
    const q = query(collection(adminDb, 'patients'), where('curp', '==', curp.toUpperCase()));
    const snap = await getDocs(q);
    if (snap.empty) return { success: false };
    return { success: true, data: serializeData({ id: snap.docs[0].id, ...snap.docs[0].data() }) as Patient };
}

export async function savePatient(patient: Omit<Patient, 'id'>, id?: string) {
    const patientId = id || uuidv4();
    await setDoc(doc(adminDb, 'patients', patientId), { ...patient, id: patientId });
    return { success: true };
}

export async function updatePatient(id: string, patient: Partial<Patient>) {
    await updateDoc(doc(adminDb, 'patients', id), patient);
    return { success: true };
}

export async function updatePatientStatus(id: string, status: PatientStatus) {
    await updateDoc(doc(adminDb, 'patients', id), { status });
    return { success: true };
}

export async function deletePatient(id: string) {
    await deleteDoc(doc(adminDb, 'patients', id));
    return { success: true };
}

export async function bulkInsertPatients(patients: any[]) {
    const batch = writeBatch(adminDb);
    for (const p of patients) {
        const id = p.CURP || uuidv4();
        batch.set(doc(adminDb, 'patients', id), {
            id,
            curp: p.CURP || '',
            name: p.Nombre || '',
            paternalLastName: p.Apaterno || '',
            maternalLastName: p.Amaterno || '',
            phoneNumber: String(p.Telefono || ''),
            expediente: String(p['No.Expediente'] || ''),
            status: p.Estatus || 'Vigente'
        }, { merge: true });
    }
    await batch.commit();
    return { success: true, processedCount: patients.length };
}

export async function deletePatients(ids: string[]) {
    const batch = writeBatch(adminDb);
    ids.forEach(id => batch.delete(doc(adminDb, 'patients', id)));
    await batch.commit();
    return { success: true };
}

export async function scanDuplicates(criteria: 'expediente' | 'curp' | 'name') {
    const all = await getPatients({ limitNum: 5000 });
    const groups: Record<string, Patient[]> = {};
    all.forEach(p => {
        let key = '';
        if (criteria === 'expediente') key = p.expediente || '';
        else if (criteria === 'curp') key = p.curp || '';
        else if (criteria === 'name') key = `${p.name} ${p.paternalLastName}`.toUpperCase();
        if (key) {
            if (!groups[key]) groups[key] = [];
            groups[key].push(p);
        }
    });
    return Object.values(groups).filter(g => g.length > 1);
}

export async function normalizeExpedientesAction() {
    const snap = await getDocs(collection(adminDb, 'patients'));
    const batch = writeBatch(adminDb);
    let count = 0;
    snap.docs.forEach(d => {
        const data = d.data();
        if (data.expediente && !String(data.expediente).startsWith('0')) {
            batch.update(d.ref, { expediente: '0' + String(data.expediente) });
            count++;
        }
    });
    await batch.commit();
    return { success: true, count };
}

export async function applyStatusUpdateChunk(expedientes: string[], status: PatientStatus) {
    const batch = writeBatch(adminDb);
    let found = 0;
    for (const exp of expedientes) {
        const q = query(collection(adminDb, 'patients'), where('expediente', '==', exp));
        const snap = await getDocs(q);
        if (!snap.empty) {
            snap.forEach(d => {
                batch.update(d.ref, { status });
                found++;
            });
        }
    }
    await batch.commit();
    return { success: true, count: found };
}

// --- APPOINTMENTS (GENERAL) ---
export async function getAppointments(): Promise<Appointment[]> {
  const snap = await getDocs(query(collection(adminDb, 'appointments'), orderBy('date', 'desc'), limit(1000)));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Appointment);
}

export async function getAppointmentsForCalendar(month: number, year: number) {
    const start = new Date(year, month, 1).toISOString();
    const end = new Date(year, month + 1, 0).toISOString();
    const q = query(collection(adminDb, 'appointments'), where('date', '>=', start), where('date', '<=', end));
    const snap = await getDocs(q);
    return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }));
}

export async function getAppointmentsForClinic(clinicId: string) {
    const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', clinicId), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }));
}

export async function getAttendedPatientsForClinic(clinicId: string) {
    const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', clinicId), where('status', '==', 'Atendido'));
    const snap = await getDocs(q);
    const patients: Patient[] = [];
    snap.forEach(d => {
        const data = d.data();
        if (data.patient) patients.push(data.patient);
    });
    return patients;
}

export async function getAppointmentCountOnDate(clinicId: string, date: string) {
    const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', clinicId), where('date', '>=', date + 'T00:00:00'), where('date', '<=', date + 'T23:59:59'));
    const snap = await getCountFromServer(q);
    return snap.data().count;
}

export async function rescheduleAppointment(id: string, newDate: string, type: string) {
    let col = 'appointments';
    if (type === 'lab') col = 'labAppointments';
    if (type === 'xray') col = 'xrayAppointments';
    if (type === 'ultrasound') col = 'ultrasoundAppointments';
    if (type === 'vaccine') col = 'vaccineAppointments';
    
    await updateDoc(doc(adminDb, col, id), { date: newDate });
    return { success: true, message: 'Fecha actualizada con éxito' };
}

export async function cloneAppointment(id: string, newDate: string, type: string, newTime?: string) {
    let col = 'appointments';
    if (type === 'lab') col = 'labAppointments';
    if (type === 'xray') col = 'xrayAppointments';
    if (type === 'ultrasound') col = 'ultrasoundAppointments';
    if (type === 'vaccine') col = 'vaccineAppointments';
    
    const snap = await getDoc(doc(adminDb, col, id));
    if (!snap.exists()) return { success: false, message: 'Cita no encontrada' };
    
    const data = snap.data();
    const newId = uuidv4();
    const newFolio = `${type.toUpperCase().substring(0, 3)}-${uuidv4().split('-')[0].toUpperCase()}`;
    
    await setDoc(doc(adminDb, col, newId), {
        ...data,
        id: newId,
        appointmentNumber: newFolio,
        date: newDate,
        time: newTime || data.time,
        status: 'Agendada',
        createdAt: new Date().toISOString()
    });
    
    return { success: true, message: 'Nueva cita agendada' };
}

// --- LAB, XRAY, US, VACCINE ---
export async function getLabAppointments() {
    const snap = await getDocs(collection(adminDb, 'labAppointments'));
    return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }));
}
export async function saveNewLabAppointment(app: any, patient: any) {
    const batch = writeBatch(adminDb);
    const pId = patient.curp;
    batch.set(doc(adminDb, 'patients', pId), { ...patient, id: pId }, { merge: true });
    const aId = uuidv4();
    const finalApp = { ...app, id: aId, patientId: pId, patient, createdAt: new Date().toISOString() };
    batch.set(doc(adminDb, 'labAppointments', aId), finalApp);
    await batch.commit();
    return { success: true, appointment: finalApp };
}
export async function deleteLabAppointment(id: string) {
    await deleteDoc(doc(adminDb, 'labAppointments', id));
    return { success: true };
}

export async function getXRayAppointments() {
    const snap = await getDocs(collection(adminDb, 'xrayAppointments'));
    return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }));
}
export async function saveNewXRayAppointment(app: any, patient: any) {
    const batch = writeBatch(adminDb);
    const pId = patient.curp;
    batch.set(doc(adminDb, 'patients', pId), { ...patient, id: pId }, { merge: true });
    const aId = uuidv4();
    const finalApp = { ...app, id: aId, patientId: pId, patient, createdAt: new Date().toISOString() };
    batch.set(doc(adminDb, 'xrayAppointments', aId), finalApp);
    await batch.commit();
    return { success: true, appointment: finalApp };
}
export async function deleteXRayAppointment(id: string) {
    await deleteDoc(doc(adminDb, 'xrayAppointments', id));
    return { success: true };
}

export async function getUltrasoundAppointments() {
    const snap = await getDocs(collection(adminDb, 'ultrasoundAppointments'));
    return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }));
}
export async function saveNewUltrasoundAppointment(app: any, patient: any) {
    const batch = writeBatch(adminDb);
    const pId = patient.curp;
    batch.set(doc(adminDb, 'patients', pId), { ...patient, id: pId }, { merge: true });
    const aId = uuidv4();
    const finalApp = { ...app, id: aId, patientId: pId, patient, createdAt: new Date().toISOString() };
    batch.set(doc(adminDb, 'ultrasoundAppointments', aId), finalApp);
    await batch.commit();
    return { success: true, appointment: finalApp };
}
export async function deleteUltrasoundAppointment(id: string) {
    await deleteDoc(doc(adminDb, 'ultrasoundAppointments', id));
    return { success: true };
}

export async function getVaccineAppointments() {
    const snap = await getDocs(collection(adminDb, 'vaccineAppointments'));
    return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }));
}
export async function saveNewVaccineAppointment(app: any, patient: any) {
    const batch = writeBatch(adminDb);
    const pId = patient.curp;
    batch.set(doc(adminDb, 'patients', pId), { ...patient, id: pId }, { merge: true });
    const aId = uuidv4();
    const finalApp = { ...app, id: aId, patientId: pId, patient, createdAt: new Date().toISOString() };
    batch.set(doc(adminDb, 'vaccineAppointments', aId), finalApp);
    await batch.commit();
    return { success: true, appointment: finalApp };
}
export async function deleteVaccineAppointment(id: string) {
    await deleteDoc(doc(adminDb, 'vaccineAppointments', id));
    return { success: true };
}

// --- GLOBAL SETTINGS & CATALOGS ---
export async function getAnnouncements() {
    const snap = await getDoc(doc(adminDb, 'settings', 'announcements'));
    return snap.exists() ? (snap.data().messages as string[]) : [];
}
export async function updateAnnouncementsData(messages: string[]) {
    await setDoc(doc(adminDb, 'settings', 'announcements'), { messages });
    return { success: true };
}

export async function getClinics() {
    const snap = await getDocs(collection(adminDb, 'clinics'));
    return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Clinic);
}
export async function updateClinics(clinics: any[]) {
    const batch = writeBatch(adminDb);
    for (const c of clinics) {
        batch.set(doc(adminDb, 'clinics', c.id), c);
    }
    await batch.commit();
    return { success: true };
}
export async function deleteClinicData(id: string) {
    await deleteDoc(doc(adminDb, 'clinics', id));
    return { success: true };
}

export async function bulkInsertDoctors(doctors: any[]) {
    const batch = writeBatch(adminDb);
    for (const d of doctors) {
        const id = uuidv4();
        batch.set(doc(adminDb, 'clinics', id), {
            id,
            doctorName: String(d.Médico).toUpperCase(),
            doctorCurp: String(d.CURP || '').toUpperCase(),
            professionalLicense: String(d.Cédula || '').toUpperCase(),
            name: String(d.Unidad).toUpperCase(),
            clinicType: d.Servicio,
            dailySlots: 15,
            startTime: '08:00',
            endTime: '13:00',
            weekendBookingEnabled: false,
            password: 'hospital_default'
        });
    }
    await batch.commit();
    return { success: true };
}

export async function getHolidays() {
    const snap = await getDocs(collection(adminDb, 'holidays'));
    return snap.docs.map(d => serializeData(d.data()));
}
export async function updateHolidaysData(holidays: any[]) {
    const snap = await getDocs(collection(adminDb, 'holidays'));
    const batch = writeBatch(adminDb);
    snap.docs.forEach(d => batch.delete(d.ref));
    holidays.forEach(h => batch.set(doc(adminDb, 'holidays', uuidv4()), h));
    await batch.commit();
    return { success: true };
}

export async function getSpecialActionDays() {
    const snap = await getDocs(collection(adminDb, 'specialActionDays'));
    return snap.docs.map(d => serializeData(d.data()));
}
export async function updateSpecialActionDaysData(days: any[]) {
    const snap = await getDocs(collection(adminDb, 'specialActionDays'));
    const batch = writeBatch(adminDb);
    snap.docs.forEach(d => batch.delete(d.ref));
    days.forEach(d => batch.set(doc(adminDb, 'specialActionDays', uuidv4()), d));
    await batch.commit();
    return { success: true };
}

// --- AUTH SETTINGS ---
export async function getAdminSettings() {
    const snap = await getDoc(doc(adminDb, 'settings', 'admin'));
    return snap.exists() ? snap.data() : { password: 'SuperAdmin' };
}
export async function updateAdminSettingsData(s: any) {
    await setDoc(doc(adminDb, 'settings', 'admin'), s);
    return { success: true };
}

export async function getArchiveSettings() {
    const snap = await getDoc(doc(adminDb, 'settings', 'archive'));
    return snap.exists() ? snap.data() : { password: 'archivo' };
}
export async function updateArchiveSettingsData(s: any) {
    await setDoc(doc(adminDb, 'settings', 'archive'), s);
    return { success: true };
}

export async function getPharmacySettings() {
    const snap = await getDoc(doc(adminDb, 'settings', 'pharmacy'));
    return snap.exists() ? snap.data() : { password: 'farmacia' };
}
export async function updatePharmacySettingsData(s: any) {
    await setDoc(doc(adminDb, 'settings', 'pharmacy'), s);
    return { success: true };
}

export async function getWarehouseSettings() {
    const snap = await getDoc(doc(adminDb, 'settings', 'warehouse'));
    return snap.exists() ? snap.data() : { password: 'almacen' };
}
export async function updateWarehouseSettingsData(s: any) {
    await setDoc(doc(adminDb, 'settings', 'warehouse'), s);
    return { success: true };
}

export async function getBISettings() {
    const snap = await getDoc(doc(adminDb, 'settings', 'bi'));
    return snap.exists() ? snap.data() : { password: 'bi' };
}
export async function updateBISettingsData(s: any) {
    await setDoc(doc(adminDb, 'settings', 'bi'), s);
    return { success: true };
}

// --- INVENTORY ---
export async function getMedications() {
    const snap = await getDocs(collection(adminDb, 'medications'));
    return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }));
}
export async function bulkInsertMedications(m: any[]) {
    const batch = writeBatch(adminDb);
    m.forEach(item => {
        const id = uuidv4();
        batch.set(doc(adminDb, 'medications', id), {
            ...item,
            id,
            existencia: parseInt(item.existencia) || 0,
            precioUnitario: parseFloat(item.precioUnitario) || 0,
            totalImporte: parseFloat(item.totalImporte) || 0,
            descripcion: String(item.descripcion).toUpperCase(),
            claveCuadroBasico: String(item.claveCuadroBasico).toUpperCase(),
            updatedAt: new Date().toISOString()
        });
    });
    await batch.commit();
    return { success: true, processedCount: m.length };
}
export async function deleteAllMedications() {
    const snap = await getDocs(collection(adminDb, 'medications'));
    const batch = writeBatch(adminDb);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return { success: true };
}

export async function getSupplies() {
    const snap = await getDocs(collection(adminDb, 'supplies'));
    return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }));
}
export async function bulkInsertSupplies(m: any[]) {
    const batch = writeBatch(adminDb);
    m.forEach(item => {
        const id = uuidv4();
        batch.set(doc(adminDb, 'supplies', id), {
            ...item,
            id,
            existencia: parseInt(item.existencia) || 0,
            precioUnitario: parseFloat(item.precioUnitario) || 0,
            totalImporte: parseFloat(item.totalImporte) || 0,
            descripcion: String(item.descripcion).toUpperCase(),
            claveCuadroBasico: String(item.claveCuadroBasico).toUpperCase(),
            updatedAt: new Date().toISOString()
        });
    });
    await batch.commit();
    return { success: true, processedCount: m.length };
}
export async function deleteAllSupplies() {
    const snap = await getDocs(collection(adminDb, 'supplies'));
    const batch = writeBatch(adminDb);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return { success: true };
}

// --- BI & BACKUP ---
export async function getBIData() {
    const [apps, lab, xr, us, vac, clins, cols] = await Promise.all([
        getAppointments(),
        getLabAppointments(),
        getXRayAppointments(),
        getUltrasoundAppointments(),
        getVaccineAppointments(),
        getClinics(),
        getColonias()
    ]);
    return {
        appointments: apps,
        labAppointments: lab,
        xRayAppointments: xr,
        ultrasoundAppointments: us,
        vaccineAppointments: vac,
        clinics: clins,
        colonias: cols
    };
}

export async function downloadBackupAction() {
    const data = await getBIData();
    const patients = await getPatients({ limitNum: 10000 });
    return { success: true, data: { ...data, patients } };
}

// --- CIE-10 LOGIC ---
export async function bulkInsertCie10Glossary(items: any[]) {
    const batch = writeBatch(adminDb);
    items.forEach(item => {
        const id = uuidv4();
        batch.set(doc(adminDb, 'cie10_glossary', id), { ...item, id });
    });
    await batch.commit();
    return { success: true, processedCount: items.length };
}

export async function bulkInsertCie10Catalog(items: any[]) {
    const batch = writeBatch(adminDb);
    items.forEach(item => {
        const id = uuidv4();
        batch.set(doc(adminDb, 'cie10_catalog', id), { ...item, id });
    });
    await batch.commit();
    return { success: true, processedCount: items.length };
}

export async function deleteAllCie10Glossary() {
    const snap = await getDocs(collection(adminDb, 'cie10_glossary'));
    const batch = writeBatch(adminDb);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return { success: true };
}

export async function deleteAllCie10Catalog() {
    const snap = await getDocs(collection(adminDb, 'cie10_catalog'));
    const batch = writeBatch(adminDb);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return { success: true };
}

// --- MEDICAL LOGIC ---
export async function saveMedicalConsultationReal(c: any) {
    const id = c.id || uuidv4();
    await setDoc(doc(adminDb, 'consultations', id), { ...c, id, updatedAt: new Date().toISOString() });
    return { success: true, id };
}

export async function getConsultationsByPatientIdReal(id: string) {
    const q = query(collection(adminDb, 'consultations'), where('patientId', '==', id), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => serializeData(d.data()) as MedicalConsultation);
}

export async function getPrescriptionsByPatientId(id: string) {
    const q = query(collection(adminDb, 'prescriptions'), where('patientId', '==', id), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => serializeData(d.data()) as Prescription);
}

export async function getPendingPrescriptionsReal(filters?: any) {
    let q = query(collection(adminDb, 'prescriptions'), where('status', '==', 'pendiente'), orderBy('date', 'desc'));
    if (filters?.clinicId) {
        q = query(collection(adminDb, 'prescriptions'), where('status', '==', 'pendiente'), where('clinicId', '==', filters.clinicId), orderBy('date', 'desc'));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => serializeData(d.data()) as Prescription);
}

export async function createPrescriptionReal(p: any) {
    const id = uuidv4();
    const folio = `REC-${Math.floor(1000 + Math.random() * 9000)}-${format(new Date(), 'ddMM')}`;
    const expiresAt = addDays(new Date(), 1).toISOString();
    const prescription = { ...p, id, folio, expiresAt, status: 'pendiente' };
    await setDoc(doc(adminDb, 'prescriptions', id), prescription);
    return { success: true, folio, prescription };
}

export async function updatePrescriptionReal(id: string, p: any) {
    await updateDoc(doc(adminDb, 'prescriptions', id), p);
    return { success: true };
}

export async function dispensePrescriptionReal(id: string, items: any[]) {
    const batch = writeBatch(adminDb);
    for (const item of items) {
        const medRef = doc(adminDb, 'medications', item.medicationId);
        batch.update(medRef, { existencia: increment(-item.quantity) });
    }
    batch.update(doc(adminDb, 'prescriptions', id), { status: 'surtida', dispensedAt: new Date().toISOString() });
    await batch.commit();
    return { success: true };
}

export async function deletePrescriptionReal(id: string) {
    await deleteDoc(doc(adminDb, 'prescriptions', id));
    return { success: true };
}

export async function deleteMedicalConsultationReal(id: string) {
    await deleteDoc(doc(adminDb, 'consultations', id));
    return { success: true };
}

export async function getPrescriptionHistoryReal(filters?: any) {
    let q = query(collection(adminDb, 'prescriptions'), where('status', '==', 'surtida'), orderBy('dispensedAt', 'desc'), limit(500));
    if (filters?.startDate && filters?.endDate) {
        q = query(collection(adminDb, 'prescriptions'), where('status', '==', 'surtida'), where('dispensedAt', '>=', filters.startDate), where('dispensedAt', '<=', filters.endDate), orderBy('dispensedAt', 'desc'));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => serializeData(d.data()) as Prescription);
}

export async function getPatientPrescriptionsCountToday(patientId: string) {
    const today = startOfDay(new Date()).toISOString();
    const q = query(collection(adminDb, 'prescriptions'), where('patientId', '==', patientId), where('date', '>=', today));
    const snap = await getCountFromServer(q);
    return snap.data().count;
}

export async function getAppointmentsForCalendarReal(month: number, year: number) {
    const start = new Date(year, month, 1).toISOString();
    const end = new Date(year, month + 1, 0).toISOString();
    const q = query(collection(adminDb, 'appointments'), where('date', '>=', start), where('date', '<=', end));
    const snap = await getDocs(q);
    return snap.docs.map(d => serializeData(d.data()));
}
