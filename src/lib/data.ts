
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  writeBatch, 
  Timestamp, 
  orderBy, 
  limit,
  setDoc,
  DocumentData
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
import { BookingMode, PatientStatus } from './definitions';
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

// Helpers for date filtering
export const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const endOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

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

// --- CATÁLOGOS ---
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
  return snap.docs.map(d => serializeData(d.data()) as ServiceType).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getSpecialtiesData(): Promise<Specialty[]> {
  const snap = await getDocs(collection(adminDb, 'specialties'));
  return snap.docs.map(d => serializeData(d.data()) as Specialty).sort((a, b) => a.name.localeCompare(b.name));
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

// --- CITAS ---
export async function getAppointmentsData() {
    const snap = await getDocs(collection(adminDb, 'appointments'));
    return snap.docs.map(d => serializeData(d.data()));
}
export async function getLabAppointmentsData() {
    const snap = await getDocs(collection(adminDb, 'labAppointments'));
    return snap.docs.map(d => serializeData(d.data()));
}
export async function getXRayAppointmentsData() {
    const snap = await getDocs(collection(adminDb, 'xrayAppointments'));
    return snap.docs.map(d => serializeData(d.data()));
}
export async function getUltrasoundAppointmentsData() {
    const snap = await getDocs(collection(adminDb, 'ultrasoundAppointments'));
    return snap.docs.map(d => serializeData(d.data()));
}
export async function getVaccineAppointmentsData() {
    const snap = await getDocs(collection(adminDb, 'vaccineAppointments'));
    return snap.docs.map(d => serializeData(d.data()));
}

// --- CLÍNICAS Y COLONIAS ---
export async function getClinicsData(): Promise<Clinic[]> {
    const snap = await getDocs(collection(adminDb, 'clinics'));
    return snap.docs.map(d => serializeData(d.data()));
}
export async function getColoniasData(): Promise<Colonia[]> {
    const snap = await getDocs(collection(adminDb, 'colonias'));
    return snap.docs.map(d => serializeData(d.data()));
}

// --- CONFIGURACIÓN DE SEGURIDAD ---
export async function getAdminSettingsData() {
    const snap = await getDoc(doc(adminDb, 'settings', 'admin'));
    return snap.exists() ? serializeData(snap.data()) : { password: 'Hu1m4ngu1ll0' };
}
export async function getArchiveSettingsData() {
    const snap = await getDoc(doc(adminDb, 'settings', 'archive'));
    return snap.exists() ? serializeData(snap.data()) : { password: 'ArchivoPassword' };
}
export async function getPharmacySettingsData() {
    const snap = await getDoc(doc(adminDb, 'settings', 'pharmacy'));
    return snap.exists() ? serializeData(snap.data()) : { password: 'PharmacyPassword' };
}
export async function getWarehouseSettingsData() {
    const snap = await getDoc(doc(adminDb, 'settings', 'warehouse'));
    return snap.exists() ? serializeData(snap.data()) : { password: 'WarehousePassword' };
}
export async function getBISettingsData() {
    const snap = await getDoc(doc(adminDb, 'settings', 'bi'));
    return snap.exists() ? serializeData(snap.data()) : { password: 'BIPassword' };
}

// --- LOGS ---
export async function getLogsData(): Promise<ActivityLog[]> {
    const q = query(collection(adminDb, 'activityLog'), orderBy('timestamp', 'desc'), limit(500));
    const snap = await getDocs(q);
    return snap.docs.map(d => serializeData(d.data()));
}

// --- CIE-10 ---
export async function searchCie10Data(term: string): Promise<Cie10Record[]> {
    const q = query(collection(adminDb, 'cie10_catalog'), limit(500));
    const snap = await getDocs(q);
    const results = snap.docs.map(d => serializeData(d.data()) as Cie10Record);
    const ut = term.toUpperCase();
    return results.filter(r => r.catalogKey.toUpperCase().includes(ut) || r.nombre.toUpperCase().includes(ut)).slice(0, 50);
}

// --- AVISOS Y FESTIVOS ---
export async function getAnnouncementsData(): Promise<string[]> {
    const snap = await getDoc(doc(adminDb, 'settings', 'announcements'));
    return snap.exists() ? (snap.data() as any).messages || [] : [];
}
export async function getHolidaysData(): Promise<Holiday[]> {
    const snap = await getDocs(collection(adminDb, 'holidays'));
    return snap.docs.map(d => serializeData(d.data()));
}
export async function getSpecialActionDaysData(): Promise<SpecialActionDay[]> {
    const snap = await getDocs(collection(adminDb, 'specialActionDays'));
    return snap.docs.map(d => serializeData(d.data()));
}

// --- INVENTARIOS ---
export async function getMedications() {
  const snap = await getDocs(collection(adminDb, 'medications'));
  return snap.docs.map(d => serializeData(d.data()) as Medication);
}
export async function getSupplies() {
  const snap = await getDocs(collection(adminDb, 'supplies'));
  return snap.docs.map(d => serializeData(d.data()) as Supply);
}

// --- ESTUDIOS Y SETTINGS ---
export async function getLabStudies() {
    const snap = await getDocs(collection(adminDb, 'labStudies'));
    return snap.docs.map(d => serializeData(d.data()) as LabStudy);
}
export async function getXRayStudies() {
    const snap = await getDocs(collection(adminDb, 'xRayStudies'));
    return snap.docs.map(d => serializeData(d.data()) as XRayStudy);
}
export async function getUltrasoundStudies() {
    const snap = await getDocs(collection(adminDb, 'ultrasoundStudies'));
    return snap.docs.map(d => serializeData(d.data()) as UltrasoundStudy);
}
export async function getVaccines() {
    const snap = await getDocs(collection(adminDb, 'vaccines'));
    return snap.docs.map(d => serializeData(d.data()) as Vaccine);
}

export async function getLabSettings() {
    const snap = await getDoc(doc(adminDb, 'settings', 'labSettings'));
    return snap.exists() ? serializeData(snap.data()) as LabSettings : { dailySlots: 20, waitlistSlots: 0, weekendBookingEnabled: false, password: 'LabPassword' };
}
export async function getXRaySettings() {
    const snap = await getDoc(doc(adminDb, 'settings', 'xraySettings'));
    return snap.exists() ? serializeData(snap.data()) as XRaySettings : { dailySlots: 10, waitlistSlots: 0, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false, password: 'XRayPassword' };
}
export async function getUltrasoundSettings() {
    const snap = await getDoc(doc(adminDb, 'settings', 'ultrasoundSettings'));
    return snap.exists() ? serializeData(snap.data()) as UltrasoundSettings : { dailySlots: 10, waitlistSlots: 0, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false, password: 'USPassword' };
}
export async function getVaccineSettings() {
    const snap = await getDoc(doc(adminDb, 'settings', 'vaccineSettings'));
    return snap.exists() ? serializeData(snap.data()) as VaccineSettings : { dailySlots: 30, waitlistSlots: 0, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false, password: 'VacunaPassword' };
}

// --- CONSULTAS Y RECETAS ---
export async function getAppointmentsForClinic(clinicId: string) {
    const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', clinicId));
    const snap = await getDocs(q);
    return snap.docs.map(d => serializeData(d.data()));
}
export async function getConsultationsByPatientId(patientId: string) {
    const q = query(collection(adminDb, 'medicalConsultations'), where('patientId', '==', patientId), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => serializeData(d.data()) as MedicalConsultation);
}
export async function getConsultationByAppointmentId(appId: string) {
    const q = query(collection(adminDb, 'medicalConsultations'), where('appointmentId', '==', appId), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return serializeData(snap.docs[0].data()) as MedicalConsultation;
}
export async function getPrescriptionsByPatientId(patientId: string) {
    const q = query(collection(adminDb, 'prescriptions'), where('patientId', '==', patientId), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => serializeData(d.data()) as Prescription);
}
export async function getPendingPrescriptions(filters: any) {
    let q = query(collection(adminDb, 'prescriptions'), where('status', '==', 'pendiente'));
    if (filters.folio) q = query(q, where('folio', '==', filters.folio.toUpperCase()));
    if (filters.clinicId) q = query(q, where('clinicId', '==', filters.clinicId));
    const snap = await getDocs(q);
    return snap.docs.map(d => serializeData(d.data()) as Prescription);
}
export async function getPrescriptionHistory(filters: any) {
    let q = query(collection(adminDb, 'prescriptions'), orderBy('date', 'desc'));
    if (filters.startDate && filters.endDate) {
        q = query(collection(adminDb, 'prescriptions'), where('date', '>=', filters.startDate), where('date', '<=', filters.endDate), orderBy('date', 'desc'));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => serializeData(d.data()) as Prescription);
}

// --- BULK INSERTS ---
export async function bulkInsertPatients(patients: any[]) {
    const batch = writeBatch(adminDb);
    let added = 0;
    let updated = 0;
    for (const p of patients) {
        if (!p.CURP) continue;
        const id = p.CURP.toUpperCase();
        const docRef = doc(adminDb, 'patients', id);
        const snap = await getDoc(docRef);
        if (snap.exists()) updated++; else added++;
        batch.set(docRef, {
            id,
            curp: id,
            expediente: p['No.Expediente'] || null,
            name: p.Nombre || '',
            paternalLastName: p.Apaterno || '',
            maternalLastName: p.Amaterno || '',
            birthDate: p.FNacimiento || null,
            age: parseInt(p.Edad) || 0,
            sex: p.Sexo || 'Hombre',
            birthState: p.Estado || '',
            address: p.Domicilio || '',
            coloniaName: p.Colonia || '',
            phoneNumber: p.Telefono || '',
            status: p.Estatus || 'Vigente',
            derechoAbiencia: p.DerechoAbiencia || null,
            registrationDate: p.FechaApertura || null
        }, { merge: true });
    }
    await batch.commit();
    return { success: true, addedCount: added, updatedCount: updated, processedCount: patients.length };
}

export async function bulkInsertDoctors(doctors: any[]) {
    const batch = writeBatch(adminDb);
    for (const d of doctors) {
        const id = uuidv4();
        batch.set(doc(adminDb, 'clinics', id), {
            id,
            doctorName: d.Médico || '',
            doctorCurp: d.CURP || '',
            professionalLicense: d.Cédula || '',
            name: d.Unidad || '',
            clinicType: d.Servicio || 'Consulta Externa',
            password: 'hospital_default',
            dailySlots: 10,
            bookingMode: BookingMode.Time,
            consultationDuration: 30,
            startTime: '08:00',
            endTime: '13:00',
            weekendBookingEnabled: false
        });
    }
    await batch.commit();
    return { success: true, processedCount: doctors.length };
}
