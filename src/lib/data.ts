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
  serverTimestamp,
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
  ActivityLog,
  ArchiveSettings,
  PharmacySettings,
  WarehouseSettings,
  BISettings,
  AdminSettings,
  ArchiveCounts,
  Medication,
  Supply,
  Holiday,
  SpecialActionDay,
  Specialty,
  ServiceType,
  MedicalConsultation,
  Cie10Record,
  Prescription
} from './definitions';
import { PatientStatus as PatientStatusEnum, BookingMode } from './definitions';

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
  return {
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
      const initial = [
          'CONSULTA EXTERNA', 
          'CONSULTA EXTERNA ESPECIALIZADA', 
          'PSICOLOGÍA', 
          'NUTRICIÓN', 
          'ODONTOLOGÍA'
      ];
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
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Specialty)
    .sort((a,b) => a.name.localeCompare(b.name));
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

export async function updatePatientStatus(id: string, status: PatientStatusEnum) {
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

// --- APPOINTMENTS ---

export async function getAppointments(): Promise<Appointment[]> {
  const snap = await getDocs(query(collection(adminDb, 'appointments'), orderBy('date', 'desc'), limit(1000)));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Appointment);
}

export async function saveNewAppointment(appointment: any, patient: any, isDouble: boolean, colonia: any) {
  const batch = writeBatch(adminDb);
  const pId = patient.curp;
  batch.set(doc(adminDb, 'patients', pId), { ...patient, id: pId }, { merge: true });
  const aId = uuidv4();
  const appointmentNumber = `MED-${uuidv4().split('-')[0].toUpperCase()}`;
  const finalApp = {
      ...appointment,
      id: aId,
      patientId: pId,
      patient,
      appointmentNumber,
      createdAt: new Date().toISOString(),
      duration: isDouble ? 60 : 30
  };
  batch.set(doc(adminDb, 'appointments', aId), finalApp);
  await batch.commit();
  return { success: true, data: { appointment: finalApp, clinic: {} } };
}

export async function getAppointmentsForCalendar(month: number, year: number) {
  const snap = await getDocs(collection(adminDb, 'appointments'));
  return snap.docs.map(d => serializeData(d.data()));
}

export async function getAppointmentsForClinic(clinicId: string) {
    const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', clinicId), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => serializeData(d.data()));
}

export async function getAttendedPatientsForClinic(clinicId: string): Promise<Patient[]> {
    const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', clinicId), where('status', '==', 'Atendido'));
    const snap = await getDocs(q);
    const patientIds = Array.from(new Set(snap.docs.map(d => d.data().patientId)));
    if (patientIds.length === 0) return [];
    const patients: Patient[] = [];
    for (const id of patientIds) {
        const pDoc = await getDoc(doc(adminDb, 'patients', id));
        if (pDoc.exists()) {
            patients.push(serializeData({ id: pDoc.id, ...pDoc.data() }) as Patient);
        }
    }
    return patients;
}

export async function getAppointmentCountOnDate(clinicId: string, date: string) {
    const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', clinicId), where('date', '==', date));
    const snap = await getCountFromServer(q);
    return snap.data().count;
}

export async function rescheduleAppointment(id: string, newDate: string, type: string) {
    const colName = type === 'lab' ? 'labAppointments' : type === 'xray' ? 'xrayAppointments' : type === 'ultrasound' ? 'ultrasoundAppointments' : type === 'vaccine' ? 'vaccineAppointments' : 'appointments';
    await updateDoc(doc(adminDb, colName, id), { date: newDate });
    return { success: true, message: 'La fecha de la cita ha sido actualizada.' };
}

export async function cloneAppointment(id: string, newDate: string, type: string, newTime?: string) {
    const colName = type === 'lab' ? 'labAppointments' : type === 'xray' ? 'xrayAppointments' : type === 'ultrasound' ? 'ultrasoundAppointments' : type === 'vaccine' ? 'vaccineAppointments' : 'appointments';
    const oldDoc = await getDoc(doc(adminDb, colName, id));
    if (!oldDoc.exists()) return { success: false, message: 'Cita original no encontrada.' };
    const data = oldDoc.data();
    const newId = uuidv4();
    const newAppNumber = `${type.toUpperCase()}-${uuidv4().split('-')[0].toUpperCase()}`;
    await setDoc(doc(adminDb, colName, newId), {
        ...data,
        id: newId,
        date: newDate,
        time: newTime || data.time,
        appointmentNumber: newAppNumber,
        status: 'Agendada',
        createdAt: new Date().toISOString()
    });
    return { success: true, message: 'Se ha agendado la nueva cita basada en la anterior.' };
}

export async function deleteAppointmentAction(id: string) {
    await deleteDoc(doc(adminDb, 'appointments', id));
    return { success: true };
}

// --- LOGS ---

export async function logActivity(action: string, details: string) {
    await addDoc(collection(adminDb, 'activityLog'), {
        timestamp: serverTimestamp(),
        action,
        details
    });
    return { success: true };
}

export async function getLogs(): Promise<ActivityLog[]> {
    const q = query(collection(adminDb, 'activityLog'), orderBy('timestamp', 'desc'), limit(500));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            action: data.action,
            details: data.details,
            timestamp: data.timestamp ? data.timestamp.toDate().toISOString() : new Date().toISOString()
        };
    });
}

// --- SETTINGS HELPERS ---

export async function getAdminSettingsAction(): Promise<AdminSettings> {
    const snap = await getDoc(doc(adminDb, 'settings', 'adminSettings'));
    return snap.exists() ? snap.data() as AdminSettings : { password: 'SuperAdminPassword' };
}

export async function getArchiveSettingsAction(): Promise<ArchiveSettings> {
    const snap = await getDoc(doc(adminDb, 'settings', 'archiveSettings'));
    return snap.exists() ? snap.data() as ArchiveSettings : { password: 'archive' };
}

export async function getPharmacySettingsAction(): Promise<PharmacySettings> {
    const snap = await getDoc(doc(adminDb, 'settings', 'pharmacySettings'));
    return snap.exists() ? snap.data() as PharmacySettings : { password: 'pharmacy' };
}

export async function getWarehouseSettingsAction(): Promise<WarehouseSettings> {
    const snap = await getDoc(doc(adminDb, 'settings', 'warehouseSettings'));
    return snap.exists() ? snap.data() as WarehouseSettings : { password: 'warehouse' };
}

export async function getBISettingsAction(): Promise<BISettings> {
    const snap = await getDoc(doc(adminDb, 'settings', 'biSettings'));
    return snap.exists() ? snap.data() as BISettings : { password: 'bi' };
}

export async function getLabSettingsAction(): Promise<LabSettings> {
  const snap = await getDoc(doc(adminDb, 'settings', 'labSettings'));
  return snap.exists() ? serializeData(snap.data()) as LabSettings : { dailySlots: 10, waitlistSlots: 5, weekendBookingEnabled: false, startTime: '07:00', endTime: '11:00' };
}

export async function getXRaySettingsAction(): Promise<XRaySettings> {
  const snap = await getDoc(doc(adminDb, 'settings', 'xraySettings'));
  return snap.exists() ? serializeData(snap.data()) as XRaySettings : { dailySlots: 10, waitlistSlots: 5, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false };
}

export async function getUltrasoundSettingsAction(): Promise<UltrasoundSettings> {
  const snap = await getDoc(doc(adminDb, 'settings', 'ultrasoundSettings'));
  return snap.exists() ? serializeData(snap.data()) as UltrasoundSettings : { dailySlots: 10, waitlistSlots: 5, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false };
}

export async function getVaccineSettingsAction(): Promise<VaccineSettings> {
  const snap = await getDoc(doc(adminDb, 'settings', 'vaccineSettings'));
  return snap.exists() ? serializeData(snap.data()) as VaccineSettings : { dailySlots: 20, waitlistSlots: 10, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false };
}

// --- DATA LISTS ---

export async function getLabStudiesAction(): Promise<LabStudy[]> {
  const snap = await getDocs(collection(adminDb, 'labStudies'));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as LabStudy);
}

export async function getXRayStudiesAction(): Promise<XRayStudy[]> {
  const snap = await getDocs(collection(adminDb, 'xrayStudies'));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as XRayStudy);
}

export async function getUltrasoundStudiesAction(): Promise<UltrasoundStudy[]> {
  const snap = await getDocs(collection(adminDb, 'ultrasoundStudies'));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as UltrasoundStudy);
}

export async function getVaccinesAction(): Promise<Vaccine[]> {
  const snap = await getDocs(collection(adminDb, 'vaccines'));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Vaccine);
}

// --- MUTATIONS ---

export async function saveNewXRayAppointmentAction(app: any, patient: any) {
    const batch = writeBatch(adminDb);
    const pId = patient.curp;
    batch.set(doc(adminDb, 'patients', pId), { ...patient, id: pId }, { merge: true });
    const aId = uuidv4();
    batch.set(doc(adminDb, 'xrayAppointments', aId), { ...app, id: aId, patientId: pId, createdAt: new Date().toISOString() });
    await batch.commit();
    return { success: true, data: { ...app, patient } };
}

export async function saveNewUltrasoundAppointmentAction(app: any, patient: any) {
    const batch = writeBatch(adminDb);
    const pId = patient.curp;
    batch.set(doc(adminDb, 'patients', pId), { ...patient, id: pId }, { merge: true });
    const aId = uuidv4();
    batch.set(doc(adminDb, 'ultrasoundAppointments', aId), { ...app, id: aId, patientId: pId, createdAt: new Date().toISOString() });
    await batch.commit();
    return { success: true, data: { ...app, patient } };
}

export async function saveNewVaccineAppointmentAction(app: any, patient: any) {
    const batch = writeBatch(adminDb);
    const pId = patient.curp;
    batch.set(doc(adminDb, 'patients', pId), { ...patient, id: pId }, { merge: true });
    const aId = uuidv4();
    batch.set(doc(adminDb, 'vaccineAppointments', aId), { ...app, id: aId, patientId: pId, createdAt: new Date().toISOString() });
    await batch.commit();
    return { success: true, data: { ...app, patient } };
}

export async function getPatientCountsAction(): Promise<ArchiveCounts> {
  const col = collection(adminDb, 'patients');
  const [total, vigente, baja, bajaDef] = await Promise.all([
    getCountFromServer(col),
    getCountFromServer(query(col, where('status', '==', PatientStatusEnum.Vigente))),
    getCountFromServer(query(col, where('status', '==', PatientStatusEnum.Baja))),
    getCountFromServer(query(col, where('status', '==', PatientStatusEnum.BajaDefinitiva)))
  ]);
  return {
    total: total.data().count,
    vigente: vigente.data().count,
    bajaTemporal: baja.data().count,
    bajaDefinitiva: bajaDef.data().count
  };
}

export async function getHolidaysAction() {
    const snap = await getDocs(collection(adminDb, 'holidays'));
    return snap.docs.map(d => serializeData(d.data()));
}

export async function getSpecialActionDaysAction() {
    const snap = await getDocs(collection(adminDb, 'specialActionDays'));
    return snap.docs.map(d => serializeData(d.data()));
}

export async function getMedicationsAction(): Promise<Medication[]> {
    const snap = await getDocs(collection(adminDb, 'medications'));
    return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Medication);
}

export async function getSuppliesAction(): Promise<Supply[]> {
    const snap = await getDocs(collection(adminDb, 'supplies'));
    return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Supply);
}

export async function bulkInsertMedicationsAction(meds: any[]) {
    const batch = writeBatch(adminDb);
    meds.forEach(m => {
        const id = uuidv4();
        batch.set(doc(adminDb, 'medications', id), { ...m, id });
    });
    await batch.commit();
    return { success: true, processedCount: meds.length };
}

export async function bulkInsertSuppliesAction(supplies: any[]) {
    const batch = writeBatch(adminDb);
    supplies.forEach(s => {
        const id = uuidv4();
        batch.set(doc(adminDb, 'supplies', id), { ...s, id });
    });
    await batch.commit();
    return { success: true, processedCount: supplies.length };
}

export async function deleteAllMedicationsAction() {
    const snap = await getDocs(collection(adminDb, 'medications'));
    const batch = writeBatch(adminDb);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return { success: true };
}

export async function deleteAllSuppliesAction() {
    const snap = await getDocs(collection(adminDb, 'supplies'));
    const batch = writeBatch(adminDb);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return { success: true };
}

export async function getPendingPrescriptionsAction(filters?: any) {
    return getPendingPrescriptionsReal(filters);
}

export async function createPrescriptionAction(p: any) {
    return createPrescriptionReal(p);
}

export async function updatePrescriptionAction(id: string, p: any) {
    return updatePrescriptionReal(id, p);
}

export async function dispensePrescriptionAction(id: string, items: any[]) {
    return dispensePrescriptionReal(id, items);
}

export async function deletePrescriptionAction(id: string) {
    return deletePrescriptionReal(id);
}

export async function deleteMedicalConsultationAction(id: string) {
    return deleteMedicalConsultationReal(id);
}

export async function getConsultationsByPatientIdAction(id: string) {
    return getConsultationsByPatientIdReal(id);
}

export async function saveMedicalConsultationAction(c: any) {
    return saveMedicalConsultationReal(c);
}

export async function searchCie10Action(t: string) {
    return searchCie10Real(t);
}

export async function getBIDataAction() {
    const [appointments, lab, xray, us, vaccine, clinics, colonias] = await Promise.all([
        getAppointments(),
        data.getLabAppointmentsReal(),
        getXRayAppointments(),
        getUltrasoundAppointments(),
        getVaccineAppointments(),
        getClinics(),
        getColonias()
    ]);
    return {
        appointments,
        labAppointments: lab,
        xRayAppointments: xray,
        ultrasoundAppointments: us,
        vaccineAppointments: vaccine,
        clinics,
        colonias
    };
}

export async function downloadBackupActionAction() {
    const [appointments, lab, xray, us, vaccine, clinics, patients] = await Promise.all([
        getAppointments(),
        data.getLabAppointmentsReal(),
        getXRayAppointments(),
        getUltrasoundAppointments(),
        getVaccineAppointments(),
        getClinics(),
        getPatients({ limitNum: 10000 })
    ]);
    return {
        success: true,
        data: { appointments, labAppointments: lab, xRayAppointments: xray, ultrasoundAppointments: us, vaccineAppointments: vaccine, clinics, patients }
    };
}

export async function cleanupOldRecordsAction() {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const q = query(collection(adminDb, 'appointments'), where('date', '<', lastMonth.toISOString()));
    const snap = await getDocs(q);
    const batch = writeBatch(adminDb);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return { success: true, deletedCount: snap.size };
}

export async function verifyAdminPasswordReal(password: string) {
    const settings = await getAdminSettings();
    return { success: settings.password === password };
}

export async function verifyCitasMedicasPasswordReal(password: string) {
    const settings = await getModuleSettings();
    return { success: settings.citasMedicasPassword === password };
}

export async function verifyXRayPasswordReal(password: string) {
    const settings = await getXRaySettings();
    return { success: settings.password === password };
}

export async function verifyUltrasoundPasswordReal(password: string) {
    const settings = await getUltrasoundSettings();
    return { success: settings.password === password };
}

export async function verifyLabPasswordReal(password: string) {
    const settings = await getLabSettings();
    return { success: settings.password === password };
}

export async function verifyVaccinePasswordReal(password: string) {
    const settings = await getVaccineSettings();
    return { success: settings.password === password };
}

export async function getLabAppointmentsReal() {
    const snap = await getDocs(collection(adminDb, 'labAppointments'));
    return snap.docs.map(d => serializeData(d.data()));
}
