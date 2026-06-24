
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
  addDoc,
  getFirestore,
  getCountFromServer,
  increment,
  or,
  and,
  deleteField,
  serverTimestamp
} from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
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
  PharmacySettings,
  WarehouseSettings,
  BISettings,
  AdminSettings,
  PatientStatus,
  ArchiveCounts,
  Medication,
  Supply,
  Holiday,
  SpecialActionDay,
  Prescription,
  Specialty,
  ServiceType,
  MedicalConsultation,
  Cie10Glossary,
  Cie10Record,
} from './definitions';
import { BookingMode, PatientStatus as PatientStatusEnum } from './definitions';

function getDb() {
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return getFirestore(app);
}

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

// --- SERVICE TYPES (CATALOGO DE CONSULTAS) ---
export async function getServiceTypes(): Promise<ServiceType[]> {
  const db = getDb();
  const snap = await getDocs(collection(db, 'serviceTypes'));
  let results = snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as ServiceType);
  
  if (results.length === 0) {
      // Sembrar datos iniciales basados en la imagen del usuario
      const initial = [
          'Consulta Externa',
          'Consulta Externa Especializada',
          'Psicología',
          'Nutrición',
          'Odontología'
      ];
      const batch = writeBatch(db);
      const seeded: ServiceType[] = [];
      initial.forEach(name => {
          const id = uuidv4();
          const item = { id, name: name.toUpperCase(), available: true };
          batch.set(doc(db, 'serviceTypes', id), item);
          seeded.push(item);
      });
      await batch.commit();
      return seeded.sort((a, b) => a.name.localeCompare(b.name));
  }
  
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

export async function updateServiceTypes(serviceTypes: ServiceType[]) {
  const db = getDb();
  const snap = await getDocs(collection(db, 'serviceTypes'));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  serviceTypes.forEach(s => {
      const id = s.id || uuidv4();
      batch.set(doc(db, 'serviceTypes', id), { ...s, id, name: s.name.toUpperCase() });
  });
  await batch.commit();
  return { success: true };
}

// --- SPECIALTIES (CATALOGO DE ESPECIALISTAS) ---
export async function getSpecialties(): Promise<Specialty[]> {
  const db = getDb();
  const snap = await getDocs(collection(db, 'specialties'));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Specialty).sort((a,b) => a.name.localeCompare(b.name));
}

export async function updateSpecialties(specialties: Specialty[]) {
  const db = getDb();
  const snap = await getDocs(collection(db, 'specialties'));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  specialties.forEach(s => {
      const id = s.id || uuidv4();
      batch.set(doc(db, 'specialties', id), { ...s, id, name: s.name.toUpperCase() });
  });
  await batch.commit();
  return { success: true };
}

// --- OTROS METODOS (RESUMIDOS PARA CONTEXTO) ---
export async function getAnnouncements(): Promise<string[]> {
  const db = getDb();
  const docRef = doc(db, 'settings', 'announcements');
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data().messages : [];
}

export async function getClinics(): Promise<Clinic[]> {
  const db = getDb();
  const snap = await getDocs(collection(db, 'clinics'));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Clinic);
}

export async function getColonias(): Promise<Colonia[]> {
  const db = getDb();
  const snap = await getDocs(collection(db, 'colonias'));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Colonia);
}

export async function getHolidays(): Promise<Holiday[]> {
  const db = getDb();
  const snap = await getDocs(collection(db, 'holidays'));
  return snap.docs.map(d => serializeData(d.data()) as Holiday);
}

export async function getModuleSettings(): Promise<ModuleSettings> {
  const db = getDb();
  const docSnap = await getDoc(doc(db, 'settings', 'modules'));
  return docSnap.exists() ? (serializeData(docSnap.data()) as ModuleSettings) : {
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
    citasMedicasPassword: '123',
    archivoConsultaPassword: '123'
  };
}

export async function getPatients(options?: any): Promise<Patient[]> {
    const db = getDb();
    let q = query(collection(db, 'patients'), limit(options?.limitNum || 100));
    // ... logic for searching ...
    const snap = await getDocs(q);
    return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Patient);
}

export async function getPatientCounts(): Promise<ArchiveCounts> {
    const db = getDb();
    const coll = collection(db, 'patients');
    const [total, vigente, baja, def] = await Promise.all([
        getCountFromServer(coll),
        getCountFromServer(query(coll, where('status', '==', PatientStatusEnum.Vigente))),
        getCountFromServer(query(coll, where('status', '==', PatientStatusEnum.Baja))),
        getCountFromServer(query(coll, where('status', '==', PatientStatusEnum.BajaDefinitiva))),
    ]);
    return {
        total: total.data().count,
        vigente: vigente.data().count,
        bajaTemporal: baja.data().count,
        bajaDefinitiva: def.data().count
    };
}

export async function getAppointments(): Promise<Appointment[]> {
    const db = getDb();
    const snap = await getDocs(collection(db, 'appointments'));
    const apps = snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Appointment);
    // Enriquecer con datos de paciente
    const patients = await getPatients({ limitNum: 500 });
    return apps.map(a => ({
        ...a,
        patient: patients.find(p => p.id === a.patientId) || {} as Patient
    }));
}

export async function getLabAppointments(): Promise<LabAppointment[]> {
    const db = getDb();
    const snap = await getDocs(collection(db, 'labAppointments'));
    const apps = snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as LabAppointment);
    const patients = await getPatients({ limitNum: 500 });
    return apps.map(a => ({
        ...a,
        patient: patients.find(p => p.id === a.patientId) || {} as Patient
    }));
}

export async function getXRayAppointments(): Promise<XRayAppointment[]> {
    const db = getDb();
    const snap = await getDocs(collection(db, 'xrayAppointments'));
    const apps = snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as XRayAppointment);
    const patients = await getPatients({ limitNum: 500 });
    return apps.map(a => ({
        ...a,
        patient: patients.find(p => p.id === a.patientId) || {} as Patient
    }));
}

export async function getUltrasoundAppointments(): Promise<UltrasoundAppointment[]> {
    const db = getDb();
    const snap = await getDocs(collection(db, 'ultrasoundAppointments'));
    const apps = snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as UltrasoundAppointment);
    const patients = await getPatients({ limitNum: 500 });
    return apps.map(a => ({
        ...a,
        patient: patients.find(p => p.id === a.patientId) || {} as Patient
    }));
}

export async function getVaccineAppointments(): Promise<VaccineAppointment[]> {
    const db = getDb();
    const snap = await getDocs(collection(db, 'vaccineAppointments'));
    const apps = snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as VaccineAppointment);
    const patients = await getPatients({ limitNum: 500 });
    return apps.map(a => ({
        ...a,
        patient: patients.find(p => p.id === a.patientId) || {} as Patient
    }));
}
