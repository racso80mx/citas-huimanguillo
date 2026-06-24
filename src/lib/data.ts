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
  addDoc,
  increment
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

// --- TIPOS DE CONSULTA (SEEDING) ---
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

export async function updateServiceTypesData(types: ServiceType[]) {
  const batch = writeBatch(adminDb);
  const snap = await getDocs(collection(adminDb, 'serviceTypes'));
  snap.docs.forEach(d => batch.delete(d.ref));
  types.forEach(t => batch.set(doc(adminDb, 'serviceTypes', t.id), { ...t, name: t.name.toUpperCase() }));
  await batch.commit();
  return { success: true };
}

// --- ESPECIALIDADES ---
export async function getSpecialtiesData(): Promise<Specialty[]> {
  const snap = await getDocs(collection(adminDb, 'specialties'));
  return snap.docs.map(d => serializeData(d.data()) as Specialty).sort((a, b) => a.name.localeCompare(b.name));
}

export async function updateSpecialtiesData(specialties: Specialty[]) {
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
  
  if (options?.limitNum) {
      results = results.slice(0, options.limitNum);
  }
  
  return results;
}

export async function bulkInsertPatients(patients: any[]) {
    const batch = writeBatch(adminDb);
    let addedCount = 0;
    let updatedCount = 0;

    for (const p of patients) {
        const curp = String(p.CURP || p.curp || '').toUpperCase();
        if (!curp) continue;

        const patientRef = doc(adminDb, 'patients', curp);
        const patientSnap = await getDoc(patientRef);

        const data: Partial<Patient> = {
            id: curp,
            expediente: String(p['No.Expediente'] || p.expediente || ''),
            name: String(p.Nombre || p.name || '').toUpperCase(),
            paternalLastName: String(p.Apaterno || p.paternalLastName || '').toUpperCase(),
            maternalLastName: String(p.Amaterno || p.maternalLastName || '').toUpperCase(),
            birthDate: String(p.FNacimiento || p.birthDate || ''),
            age: parseInt(p.Edad || p.age) || 0,
            sex: (p.Sexo || p.sex) === 'Mujer' ? 'Mujer' : 'Hombre',
            status: (p.Estatus || p.status) as any || 'Vigente',
            address: String(p.Domicilio || p.address || '').toUpperCase(),
            coloniaName: String(p.Colonia || p.coloniaName || '').toUpperCase(),
            phoneNumber: String(p.Telefono || p.phoneNumber || ''),
            curp: curp,
            fatherName: String(p.NombrePadre || p.fatherName || '').toUpperCase(),
            motherName: String(p.NombreMadre || p.motherName || '').toUpperCase(),
            fatherAge: parseInt(p.EdadPadre || p.fatherAge) || null,
            motherAge: parseInt(p.EdadMadre || p.motherAge) || null,
            registrationDate: String(p.FechaApertura || p.registrationDate || ''),
            derechoAbiencia: String(p.DerechoAbiencia || p.derechoAbiencia || '').toUpperCase(),
        };

        batch.set(patientRef, data, { merge: true });
        if (patientSnap.exists()) updatedCount++; else addedCount++;
    }

    await batch.commit();
    return { success: true, addedCount, updatedCount, processedCount: addedCount + updatedCount };
}

export async function deletePatients(ids: string[]) {
    const batch = writeBatch(adminDb);
    ids.forEach(id => batch.delete(doc(adminDb, 'patients', id)));
    await batch.commit();
    return { success: true };
}

export async function scanDuplicates(criteria: 'expediente' | 'curp' | 'name'): Promise<Patient[][]> {
    const snap = await getDocs(collection(adminDb, 'patients'));
    const all = snap.docs.map(d => serializeData(d.data()) as Patient);
    const map = new Map<string, Patient[]>();

    all.forEach(p => {
        let key = '';
        if (criteria === 'expediente') key = p.expediente || '';
        else if (criteria === 'curp') key = p.curp || '';
        else if (criteria === 'name') key = `${p.name} ${p.paternalLastName}`.toUpperCase();

        if (!key || key === 'N/A' || key === 'S/E') return;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(p);
    });

    return Array.from(map.values()).filter(group => group.length > 1);
}

export async function normalizeExpedientesAction() {
    const snap = await getDocs(collection(adminDb, 'patients'));
    const batch = writeBatch(adminDb);
    let count = 0;
    snap.docs.forEach(d => {
        const p = d.data() as Patient;
        if (p.expediente && !p.expediente.startsWith('0')) {
            batch.update(d.ref, { expediente: `0${p.expediente}` });
            count++;
        }
    });
    await batch.commit();
    return { success: true, count };
}

export async function applyStatusUpdateChunk(expedientes: string[], status: string) {
    const batch = writeBatch(adminDb);
    let count = 0;
    const patientsSnap = await getDocs(collection(adminDb, 'patients'));
    const allPatients = patientsSnap.docs;
    expedientes.forEach(targetExp => {
        const match = allPatients.find(d => {
            const exp = String(d.data().expediente || '');
            return exp === targetExp || exp === `0${targetExp}` || exp === targetExp.replace(/^0+/, '');
        });
        if (match) { batch.update(match.ref, { status }); count++; }
    });
    await batch.commit();
    return { success: true, count };
}

// --- CITAS (TODOS LOS SERVICIOS) ---
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
export async function updateClinicsData(clinics: Clinic[]) {
    const batch = writeBatch(adminDb);
    clinics.forEach(c => batch.set(doc(adminDb, 'clinics', c.id), c));
    await batch.commit(); return { success: true };
}
export async function getColoniasData(): Promise<Colonia[]> {
    const snap = await getDocs(collection(adminDb, 'colonias'));
    return snap.docs.map(d => serializeData(d.data()));
}
export async function updateColoniasData(colonias: Colonia[]) {
    const batch = writeBatch(adminDb);
    const snap = await getDocs(collection(adminDb, 'colonias'));
    snap.docs.forEach(d => batch.delete(d.ref));
    colonias.forEach(c => batch.set(doc(adminDb, 'colonias', c.id), c));
    await batch.commit(); return { success: true };
}

// --- CONFIGURACIÓN DE SEGURIDAD ---
export async function getAdminSettingsData(): Promise<AdminSettings> {
    const snap = await getDoc(doc(adminDb, 'settings', 'admin'));
    return snap.exists() ? serializeData(snap.data()) : { password: 'SuperAdminPassword' };
}
export async function getArchiveSettingsData(): Promise<ArchiveSettings> {
    const snap = await getDoc(doc(adminDb, 'settings', 'archive'));
    return snap.exists() ? serializeData(snap.data()) : { password: 'ArchivePassword' };
}
export async function getPharmacySettingsData(): Promise<PharmacySettings> {
    const snap = await getDoc(doc(adminDb, 'settings', 'pharmacy'));
    return snap.exists() ? serializeData(snap.data()) : { password: 'PharmacyPassword' };
}
export async function getWarehouseSettingsData(): Promise<WarehouseSettings> {
    const snap = await getDoc(doc(adminDb, 'settings', 'warehouse'));
    return snap.exists() ? serializeData(snap.data()) : { password: 'WarehousePassword' };
}
export async function getBISettingsData(): Promise<BISettings> {
    const snap = await getDoc(doc(adminDb, 'settings', 'bi'));
    return snap.exists() ? serializeData(snap.data()) : { password: 'BIPassword' };
}

// --- LOGS Y MANTENIMIENTO ---
export async function getLogsData(): Promise<ActivityLog[]> {
    const q = query(collection(adminDb, 'activityLog'), orderBy('timestamp', 'desc'), limit(500));
    const snap = await getDocs(q);
    return snap.docs.map(d => serializeData(d.data()));
}

// --- CIE-10 SEARCH ---
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
