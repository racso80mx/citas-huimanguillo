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
  serverTimestamp,
  getCountFromServer,
  addDoc
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
  Prescription
} from './definitions';
import { v4 as uuidv4 } from 'uuid';

// --- Utilerías de Serialización ---
function serializeData(data: any) {
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

// --- CONFIGURACIÓN DE MÓDULOS ---
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

// --- CATÁLOGOS BASE ---
export async function getServiceTypes(): Promise<ServiceType[]> {
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
  return snap.docs.map(d => serializeData(d.data()) as ServiceType).sort((a, b) => a.name.localeCompare(b.name));
}

export async function updateServiceTypes(types: ServiceType[]) {
  const batch = writeBatch(adminDb);
  const snap = await getDocs(collection(adminDb, 'serviceTypes'));
  snap.docs.forEach(d => batch.delete(d.ref));
  types.forEach(t => batch.set(doc(adminDb, 'serviceTypes', t.id), { ...t, name: t.name.toUpperCase() }));
  await batch.commit();
  return { success: true };
}

export async function getSpecialties(): Promise<Specialty[]> {
  const snap = await getDocs(collection(adminDb, 'specialties'));
  return snap.docs.map(d => serializeData(d.data()) as Specialty).sort((a, b) => a.name.localeCompare(b.name));
}

export async function updateSpecialties(specialties: Specialty[]) {
  const batch = writeBatch(adminDb);
  const snap = await getDocs(collection(adminDb, 'specialties'));
  snap.docs.forEach(d => batch.delete(d.ref));
  specialties.forEach(s => batch.set(doc(adminDb, 'specialties', s.id), { ...s, name: s.name.toUpperCase() }));
  await batch.commit();
  return { success: true };
}

// --- PACIENTES ---
export async function getPatientsData(options?: any): Promise<Patient[]> {
  let q = query(collection(adminDb, 'patients'), orderBy('paternalLastName'));
  if (options?.status && options.status !== 'Total') {
    q = query(collection(adminDb, 'patients'), where('status', '==', options.status), orderBy('paternalLastName'));
  }
  const snap = await getDocs(q);
  let results = snap.docs.map(d => serializeData(d.data()) as Patient);
  
  if (options?.searchName) {
    const term = options.searchName.toUpperCase();
    results = results.filter(p => `${p.name} ${p.paternalLastName} ${p.maternalLastName}`.toUpperCase().includes(term));
  }
  if (options?.searchCurp) {
    results = results.filter(p => p.curp.toUpperCase().includes(options.searchCurp.toUpperCase()));
  }
  if (options?.searchExpediente) {
    results = results.filter(p => String(p.expediente || '').includes(options.searchExpediente));
  }
  return results;
}

export async function savePatientData(patient: Omit<Patient, 'id'>, id?: string) {
  const patientId = id || uuidv4();
  await setDoc(doc(adminDb, 'patients', patientId), { ...patient, id: patientId });
  return { success: true };
}

// --- CITAS MÉDICAS ---
export async function getAppointmentsData(): Promise<Appointment[]> {
  const snap = await getDocs(collection(adminDb, 'appointments'));
  return snap.docs.map(d => serializeData(d.data()) as Appointment);
}

// --- LABORATORIO ---
export async function getLabAppointmentsData(): Promise<LabAppointment[]> {
  const snap = await getDocs(collection(adminDb, 'labAppointments'));
  return snap.docs.map(d => serializeData(d.data()) as LabAppointment);
}

export async function getLabStudiesData(): Promise<LabStudy[]> {
  const snap = await getDocs(collection(adminDb, 'labStudies'));
  return snap.docs.map(d => serializeData(d.data()) as LabStudy);
}

export async function getLabSettingsData(): Promise<LabSettings> {
  const snap = await getDoc(doc(adminDb, 'settings', 'lab'));
  if (snap.exists()) return serializeData(snap.data()) as LabSettings;
  return { dailySlots: 20, waitlistSlots: 5, weekendBookingEnabled: false };
}

// --- RAYOS X ---
export async function getXRayAppointmentsData(): Promise<XRayAppointment[]> {
  const snap = await getDocs(collection(adminDb, 'xrayAppointments'));
  return snap.docs.map(d => serializeData(d.data()) as XRayAppointment);
}

export async function getXRayStudiesData(): Promise<XRayStudy[]> {
  const snap = await getDocs(collection(adminDb, 'xrayStudies'));
  return snap.docs.map(d => serializeData(d.data()) as XRayStudy);
}

export async function getXRaySettingsData(): Promise<XRaySettings> {
  const snap = await getDoc(doc(adminDb, 'settings', 'xray'));
  if (snap.exists()) return serializeData(snap.data()) as XRaySettings;
  return { dailySlots: 10, waitlistSlots: 2, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false };
}

// --- ULTRASONIDOS ---
export async function getUltrasoundAppointmentsData(): Promise<UltrasoundAppointment[]> {
  const snap = await getDocs(collection(adminDb, 'ultrasoundAppointments'));
  return snap.docs.map(d => serializeData(d.data()) as UltrasoundAppointment);
}

export async function getUltrasoundStudiesData(): Promise<UltrasoundStudy[]> {
  const snap = await getDocs(collection(adminDb, 'ultrasoundStudies'));
  return snap.docs.map(d => serializeData(d.data()) as UltrasoundStudy);
}

export async function getUltrasoundSettingsData(): Promise<UltrasoundSettings> {
  const snap = await getDoc(doc(adminDb, 'settings', 'ultrasound'));
  if (snap.exists()) return serializeData(snap.data()) as UltrasoundSettings;
  return { dailySlots: 10, waitlistSlots: 2, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false };
}

// --- VACUNAS ---
export async function getVaccineAppointmentsData(): Promise<VaccineAppointment[]> {
  const snap = await getDocs(collection(adminDb, 'vaccineAppointments'));
  return snap.docs.map(d => serializeData(d.data()) as VaccineAppointment);
}

export async function getVaccinesData(): Promise<Vaccine[]> {
  const snap = await getDocs(collection(adminDb, 'vaccines'));
  return snap.docs.map(d => serializeData(d.data()) as Vaccine);
}

export async function getVaccineSettingsData(): Promise<VaccineSettings> {
  const snap = await getDoc(doc(adminDb, 'settings', 'vaccine'));
  if (snap.exists()) return serializeData(snap.data()) as VaccineSettings;
  return { dailySlots: 20, waitlistSlots: 5, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false };
}

// --- INVENTARIOS ---
export async function getMedicationsData(): Promise<Medication[]> {
  const snap = await getDocs(collection(adminDb, 'medications'));
  return snap.docs.map(d => serializeData(d.data()) as Medication);
}

export async function getSuppliesData(): Promise<Supply[]> {
  const snap = await getDocs(collection(adminDb, 'supplies'));
  return snap.docs.map(d => serializeData(d.data()) as Supply);
}

// --- SEGURIDAD ---
export async function getAdminSettingsData(): Promise<AdminSettings> {
  const snap = await getDoc(doc(adminDb, 'settings', 'admin'));
  return snap.exists() ? serializeData(snap.data()) as AdminSettings : { password: 'SuperAdminPassword' };
}

export async function getArchiveSettingsData(): Promise<ArchiveSettings> {
  const snap = await getDoc(doc(adminDb, 'settings', 'archive'));
  return snap.exists() ? serializeData(snap.data()) as ArchiveSettings : { password: 'ArchivePassword' };
}

export async function getPharmacySettingsData(): Promise<PharmacySettings> {
  const snap = await getDoc(doc(adminDb, 'settings', 'pharmacy'));
  return snap.exists() ? serializeData(snap.data()) as PharmacySettings : { password: 'PharmacyPassword' };
}

export async function getWarehouseSettingsData(): Promise<WarehouseSettings> {
  const snap = await getDoc(doc(adminDb, 'settings', 'warehouse'));
  return snap.exists() ? serializeData(snap.data()) as WarehouseSettings : { password: 'WarehousePassword' };
}

export async function getBISettingsData(): Promise<BISettings> {
  const snap = await getDoc(doc(adminDb, 'settings', 'bi'));
  return snap.exists() ? serializeData(snap.data()) as BISettings : { password: 'BIPassword' };
}

// --- LOGS ---
export async function getLogsData(): Promise<ActivityLog[]> {
  const q = query(collection(adminDb, 'activityLog'), orderBy('timestamp', 'desc'), limit(500));
  const snap = await getDocs(q);
  return snap.docs.map(d => serializeData(d.data()) as ActivityLog);
}

// --- AVISOS Y FESTIVOS ---
export async function getAnnouncementsData(): Promise<string[]> {
  const snap = await getDoc(doc(adminDb, 'settings', 'announcements'));
  return snap.exists() ? (snap.data() as any).messages || [] : [];
}

export async function getHolidaysData(): Promise<Holiday[]> {
  const snap = await getDocs(collection(adminDb, 'holidays'));
  return snap.docs.map(d => serializeData(d.data()) as Holiday);
}

export async function getSpecialActionDaysData(): Promise<SpecialActionDay[]> {
  const snap = await getDocs(collection(adminDb, 'specialActionDays'));
  return snap.docs.map(d => serializeData(d.data()) as SpecialActionDay);
}

// --- CLÍNICAS Y COLONIAS ---
export async function getClinicsData(): Promise<Clinic[]> {
  const snap = await getDocs(collection(adminDb, 'clinics'));
  return snap.docs.map(d => serializeData(d.data()) as Clinic);
}

export async function getColoniasData(): Promise<Colonia[]> {
  const snap = await getDocs(collection(adminDb, 'colonias'));
  return snap.docs.map(d => serializeData(d.data()) as Colonia);
}
