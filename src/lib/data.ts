
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
  setDoc
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
  return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as ServiceType)).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getSpecialtiesData(): Promise<Specialty[]> {
  const snap = await getDocs(collection(adminDb, 'specialties'));
  return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as Specialty)).sort((a, b) => a.name.localeCompare(b.name));
}

// --- PACIENTES ---
export async function getPatientsData(options?: any): Promise<Patient[]> {
  let q = query(collection(adminDb, 'patients'), orderBy('paternalLastName'));
  if (options?.status && options.status !== 'Total') {
    q = query(collection(adminDb, 'patients'), where('status', '==', options.status), orderBy('paternalLastName'));
  }
  const snap = await getDocs(q);
  let results = snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as Patient));
  
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

// --- CLÍNICAS Y COLONIAS ---
export async function getClinicsData(): Promise<Clinic[]> {
    const snap = await getDocs(collection(adminDb, 'clinics'));
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as Clinic));
}
export async function getColoniasData(): Promise<Colonia[]> {
    const snap = await getDocs(collection(adminDb, 'colonias'));
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as Colonia));
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
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as ActivityLog));
}

// --- CIE-10 ---
export async function searchCie10Data(term: string): Promise<Cie10Record[]> {
    const q = query(collection(adminDb, 'cie10_catalog'), limit(500));
    const snap = await getDocs(q);
    const results = snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as Cie10Record));
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
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as Holiday));
}
export async function getSpecialActionDaysData(): Promise<SpecialActionDay[]> {
    const snap = await getDocs(collection(adminDb, 'specialActionDays'));
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as SpecialActionDay));
}

// --- INVENTARIOS ---
export async function getMedications() {
  const snap = await getDocs(collection(adminDb, 'medications'));
  return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as Medication));
}
export async function getSupplies() {
  const snap = await getDocs(collection(adminDb, 'supplies'));
  return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as Supply));
}

// --- ESTUDIOS Y SETTINGS ---
export async function getLabStudies() {
    const snap = await getDocs(collection(adminDb, 'labStudies'));
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as LabStudy));
}
export async function getXRayStudies() {
    const snap = await getDocs(collection(adminDb, 'xRayStudies'));
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as XRayStudy));
}
export async function getUltrasoundStudies() {
    const snap = await getDocs(collection(adminDb, 'ultrasoundStudies'));
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as UltrasoundStudy));
}
export async function getVaccines() {
    const snap = await getDocs(collection(adminDb, 'vaccines'));
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as Vaccine));
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
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id }));
}
export async function getConsultationsByPatientId(patientId: string) {
    const q = query(collection(adminDb, 'medicalConsultations'), where('patientId', '==', patientId), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as MedicalConsultation));
}
export async function getConsultationByAppointmentId(appId: string) {
    const q = query(collection(adminDb, 'medicalConsultations'), where('appointmentId', '==', appId), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { ...serializeData(snap.docs[0].data()), id: snap.docs[0].id } as MedicalConsultation;
}
export async function getPrescriptionsByPatientId(patientId: string) {
    const q = query(collection(adminDb, 'prescriptions'), where('patientId', '==', patientId), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as Prescription));
}
export async function getPendingPrescriptions(filters: any) {
    let q = query(collection(adminDb, 'prescriptions'), where('status', '==', 'pendiente'));
    if (filters.folio) q = query(q, where('folio', '==', filters.folio.toUpperCase()));
    if (filters.clinicId) q = query(q, where('clinicId', '==', filters.clinicId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as Prescription));
}
export async function getPrescriptionHistory(filters: any) {
    let q = query(collection(adminDb, 'prescriptions'), orderBy('date', 'desc'));
    if (filters.startDate && filters.endDate) {
        q = query(collection(adminDb, 'prescriptions'), where('date', '>=', filters.startDate), where('date', '<=', filters.endDate), orderBy('date', 'desc'));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as Prescription));
}

// --- BULK INSERTS ---
export async function bulkInsertPatients(patients: any[]) {
    const batch = writeBatch(adminDb);
    let addedCount = 0;
    let updatedCount = 0;

    for (const p of patients) {
        const curp = String(p.CURP || '').toUpperCase().trim();
        if (!curp) continue;

        const patientRef = doc(adminDb, 'patients', curp);
        const patientSnap = await getDoc(patientRef);

        const patientData: Partial<Patient> = {
            id: curp,
            expediente: String(p['No.Expediente'] || ''),
            name: String(p.Nombre || '').toUpperCase(),
            paternalLastName: String(p.Apaterno || '').toUpperCase(),
            maternalLastName: String(p.Amaterno || '').toUpperCase(),
            birthDate: String(p.FNacimiento || ''),
            age: parseInt(p.Edad) || 0,
            sex: p.Sexo === 'H' ? 'Hombre' : 'Mujer',
            status: (p.Estatus as PatientStatus) || PatientStatus.Vigente,
            address: String(p.Domicilio || '').toUpperCase(),
            coloniaName: String(p.Colonia || '').toUpperCase(),
            fatherName: String(p.NombrePadre || '').toUpperCase(),
            motherName: String(p.NombreMadre || '').toUpperCase(),
            fatherAge: parseInt(p.EdadPadre) || undefined,
            motherAge: parseInt(p.EdadMadre) || undefined,
            registrationDate: String(p.FechaApertura || ''),
            derechoAbiencia: String(p.DerechoAbiencia || '').toUpperCase(),
            phoneNumber: String(p.Telefono || ''),
            curp: curp
        };

        if (patientSnap.exists()) {
            batch.update(patientRef, patientData);
            updatedCount++;
        } else {
            batch.set(patientRef, patientData);
            addedCount++;
        }
    }
    await batch.commit();
    return { success: true, addedCount, updatedCount, processedCount: patients.length };
}

export async function bulkInsertDoctors(doctors: any[]) {
    const batch = writeBatch(adminDb);
    for (const d of doctors) {
        const id = uuidv4();
        const docData: Partial<Clinic> = {
            id,
            doctorName: String(d.Médico || '').toUpperCase(),
            doctorCurp: String(d.CURP || '').toUpperCase(),
            professionalLicense: String(d.Cédula || '').toUpperCase(),
            name: String(d.Unidad || '').toUpperCase(),
            clinicType: d.Servicio || 'Consulta Externa',
            password: 'hospital_default',
            dailySlots: 15,
            startTime: '08:00',
            endTime: '13:00',
            bookingMode: BookingMode.Time,
            consultationDuration: 30,
            weekendBookingEnabled: false
        };
        batch.set(doc(adminDb, 'clinics', id), docData);
    }
    await batch.commit();
    return { success: true, processedCount: doctors.length };
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
