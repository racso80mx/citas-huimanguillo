
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

function fuzzyMapInsumo(item: any) {
    const keys = Object.keys(item);
    const normalize = (s: string) => String(s || '').toLowerCase().trim().replace(/[\s\._\-]/g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const findValue = (options: string[]) => {
        const normalizedOptions = options.map(normalize);
        const foundKey = keys.find(k => normalizedOptions.includes(normalize(k)));
        return foundKey ? item[foundKey] : undefined;
    };
    return {
        claveCuadroBasico: String(findValue(['clave', 'clavedecuadrobasico', 'articulo', 'codigo', 'cod', 'idinsumo', 'clv']) || 'S/C'),
        descripcion: String(findValue(['descripcion', 'nombre', 'insumo', 'producto', 'articulo', 'desc', 'sustancia']) || 'SIN DESCRIPCIÓN'),
        existencia: Number(findValue(['existencia', 'stock', 'cantidad', 'actual', 'total', 'cant', 'stockactual']) || 0),
        fechaCaducidad: String(findValue(['caducidad', 'vencimiento', 'fechadecaducidad', 'vence', 'fecha', 'venc', 'f.caducidad']) || ''),
        lote: String(findValue(['lote', 'numerodelote', 'loteo', 'n.lote', 'lot', 'num.lote']) || 'N/A'),
        grupo: String(findValue(['grupo', 'categoria', 'familia', 'tipo']) || ''),
        precioUnitario: Number(findValue(['precio', 'preciounitario', 'costo']) || 0),
        almacen: String(findValue(['almacen', 'deposito', 'bodega']) || '')
    };
}

async function getRawCollection(name: string, limitNum: number = 40000) {
    try {
        const colRef = collection(adminDb, name);
        const q = query(colRef, limit(limitNum));
        const snap = await getDocs(q);
        const results = snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id }));
        if (name.includes('Appointment') || name === 'appointments') {
            return results.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        }
        return results;
    } catch (e) {
        console.error(`Error al leer colección ${name}:`, e);
        return [];
    }
}

async function getPatientsForApps(apps: any[]) {
    const pIds = Array.from(new Set(apps.map(a => a.patientId).filter(id => !!id)));
    if (pIds.length === 0) return [];
    const pats: any[] = [];
    for (let i = 0; i < pIds.length; i += 30) {
        const chunk = pIds.slice(i, i + 30);
        const q = query(collection(adminDb, 'patients'), where('__name__', 'in', chunk));
        const snap = await getDocs(q);
        pats.push(...snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id })));
    }
    return pats;
}

async function getPasswordFromStore(id: string, defaultPass: string): Promise<string> {
    try {
        const snap = await getDoc(doc(adminDb, 'module_passwords', id));
        return snap.exists() ? snap.data().password : defaultPass;
    } catch (e) {
        return defaultPass;
    }
}

// --- EXPORTS SINCRONIZADOS ---
export async function logActivity(action: string, details: string) { 
    try {
        await addDoc(collection(adminDb, 'activityLog'), { timestamp: new Date().toISOString(), action: action.toUpperCase(), details }); 
    } catch (e) {}
    return { success: true }; 
}

export async function getLogsData() { return getRawCollection('activityLog', 500); }

export async function getModuleSettings(): Promise<ModuleSettings> {
  const snap = await getDoc(doc(adminDb, 'settings', 'moduleSettings'));
  const base = snap.exists() ? serializeData(snap.data()) as ModuleSettings : {
    citasMedicasEnabled: true, laboratorioEnabled: true, rayosXEnabled: true, ultrasoundEnabled: true, vacunasEnabled: true,
    archivoEnabled: true, farmaciaEnabled: true, almacenEnabled: true, archivoConsultaEnabled: true,
    citasMedicasWhatsAppEnabled: true, laboratorioWhatsAppEnabled: true, rayosXWhatsAppEnabled: true, ultrasoundWhatsAppEnabled: true, vacunasWhatsAppEnabled: true, archivoWhatsAppEnabled: true
  };
  const [citasPass, consultaPass] = await Promise.all([getPasswordFromStore('medical', 'citas2026'), getPasswordFromStore('archiveInquiry', '2026')]);
  return { ...base, citasMedicasPassword: citasPass, archivoConsultaPassword: consultaPass };
}

export async function updateModuleSettings(settings: ModuleSettings) {
    const { citasMedicasPassword, archivoConsultaPassword, ...rest } = settings;
    const batch = writeBatch(adminDb);
    batch.set(doc(adminDb, 'settings', 'moduleSettings'), rest);
    if (citasMedicasPassword) batch.set(doc(adminDb, 'module_passwords', 'medical'), { password: citasMedicasPassword });
    if (archivoConsultaPassword) batch.set(doc(adminDb, 'module_passwords', 'archiveInquiry'), { password: archivoConsultaPassword });
    await batch.commit();
    return { success: true };
}

export async function getPatientsData(options?: any): Promise<Patient[]> {
  const colRef = collection(adminDb, 'patients');
  let q: Query<DocumentData> = colRef;
  if (options?.searchCurp) q = query(colRef, where('curp', '==', options.searchCurp.toUpperCase()), limit(50));
  else if (options?.searchExpediente) q = query(colRef, where('expediente', '==', options.searchExpediente), limit(50));
  else if (options?.status && options.status !== 'Total') q = query(colRef, where('status', '==', options.status), limit(1000));
  else q = query(colRef, limit(options?.limitNum || 2000));
  const snap = await getDocs(q);
  let results = snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id })) as Patient[];
  if (options?.searchName) {
      const t = options.searchName.toUpperCase();
      results = results.filter(p => `${p.name} ${p.paternalLastName} ${p.maternalLastName}`.toUpperCase().includes(t));
  }
  return results.sort((a,b) => a.paternalLastName.localeCompare(b.paternalLastName));
}

export async function getPatientCounts(): Promise<ArchiveCounts> {
  const colRef = collection(adminDb, 'patients');
  const [totalSnap, vigenteSnap, bajaSnap, bajaDefSnap] = await Promise.all([
    getCountFromServer(colRef),
    getCountFromServer(query(colRef, where('status', '==', PatientStatus.Vigente))),
    getCountFromServer(query(colRef, where('status', '==', PatientStatus.Baja))),
    getCountFromServer(query(colRef, where('status', '==', PatientStatus.BajaDefinitiva)))
  ]);
  return { total: totalSnap.data().count, vigente: vigenteSnap.data().count, bajaTemporal: bajaSnap.data().count, bajaDefinitiva: bajaDefSnap.data().count };
}

export async function savePatient(patient: Omit<Patient, 'id'>, id: string) {
    const finalId = id || uuidv4();
    await setDoc(doc(adminDb, 'patients', finalId), { ...patient, id: finalId }, { merge: true });
    return { success: true, id: finalId };
}

export async function updatePatient(id: string, patient: Partial<Patient>) {
    await updateDoc(doc(adminDb, 'patients', id), patient);
    return { success: true };
}

export async function updatePatientStatus(id: string, s: string) { 
    await updateDoc(doc(adminDb, 'patients', id), { status: s }); 
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
    const q = query(collection(adminDb, 'patients'), where('curp', '==', curp.toUpperCase()), limit(1));
    const snap = await getDocs(q);
    return snap.empty ? { success: false } : { success: true, data: { ...serializeData(snap.docs[0].data()), id: snap.docs[0].id } };
}

export async function getAppointmentsData() {
    const apps = await getRawCollection('appointments', 40000); 
    const pats = await getPatientsForApps(apps);
    const clinics = await getClinicsData();
    return apps.map(a => ({ ...a, patient: pats.find(p => p.id === a.patientId), clinicName: clinics.find(c => c.id === a.clinicId)?.name || a.clinicName || 'N/A' }));
}
export async function getLabAppointmentsData() { 
    const apps = await getRawCollection('labAppointments', 40000); 
    const pats = await getPatientsForApps(apps); 
    return apps.map(a => ({ ...a, patient: pats.find(p => p.id === a.patientId) })); 
}
export async function getXRayAppointmentsData() { 
    const apps = await getRawCollection('xrayAppointments', 20000); 
    const pats = await getPatientsForApps(apps); 
    return apps.map(a => ({ ...a, patient: pats.find(p => p.id === a.patientId) })); 
}
export async function getUltrasoundAppointmentsData() { 
    const apps = await getRawCollection('ultrasoundAppointments', 20000); 
    const pats = await getPatientsForApps(apps); 
    return apps.map(a => ({ ...a, patient: pats.find(p => p.id === a.patientId) })); 
}
export async function getVaccineAppointmentsData() { 
    const apps = await getRawCollection('vaccineAppointments', 20000); 
    const pats = await getPatientsForApps(apps); 
    return apps.map(a => ({ ...a, patient: pats.find(p => p.id === a.patientId) })); 
}

export async function updateAppointmentStatus(aid: string, s: string, type: string) {
    const coll = type === 'medical' ? 'appointments' : type === 'lab' ? 'labAppointments' : type === 'xray' ? 'xrayAppointments' : type === 'ultrasound' ? 'ultrasoundAppointments' : 'vaccineAppointments';
    await updateDoc(doc(adminDb, coll, aid), { status: s });
    return { success: true };
}

export async function getAppointmentsForClinic(cid: string) {
    const apps = await getRawCollection('appointments', 40000);
    const clinics = await getClinicsData();
    const target = clinics.find(c => c.id === cid);
    const pats = await getPatientsForApps(apps);
    return apps.filter(a => a.clinicId === cid || (target && (a.clinicName || '').toUpperCase() === target.name.toUpperCase()))
               .map(a => ({ ...a, patient: pats.find(p => p.id === a.patientId) }));
}

export async function saveNewAppointment(appointment: any, patient: any, isDouble: boolean, colonia?: string) {
    const batch = writeBatch(adminDb);
    const pId = patient.id || uuidv4();
    batch.set(doc(adminDb, 'patients', pId), { ...patient, id: pId }, { merge: true });
    const appNumber = `APP-${uuidv4().split('-')[0].toUpperCase()}`;
    const appId = uuidv4();
    const appData = { ...appointment, id: appId, patientId: pId, appointmentNumber: appNumber, coloniaName: colonia, createdAt: new Date().toISOString() };
    batch.set(doc(adminDb, 'appointments', appId), appData);
    if (isDouble) {
        const appId2 = uuidv4();
        batch.set(doc(adminDb, 'appointments', appId2), { ...appData, id: appId2, appointmentNumber: appNumber + '-2' });
    }
    await batch.commit();
    const clinic = (await getClinicsData()).find(c => c.id === appointment.clinicId);
    return { success: true, data: { appointment: { ...appData, patient }, clinic } };
}

export async function getClinicsData(): Promise<Clinic[]> { 
    const [clinicsSnap, settingsSnap] = await Promise.all([getDocs(collection(adminDb, 'clinics')), getDocs(collection(adminDb, 'clinic_settings'))]);
    const settingsMap = new Map();
    settingsSnap.docs.forEach(d => settingsMap.set(d.id, d.data()));
    return clinicsSnap.docs.map(d => ({ ...serializeData(d.data()), ...(settingsMap.get(d.id) || {}), id: d.id } as Clinic));
}

export async function updateClinics(clinics: Clinic[]) { 
    const batch = writeBatch(adminDb); 
    clinics.forEach(c => {
        const { id, unavailableDates, customSchedules, daysOfAction, password, ...baseInfo } = c;
        batch.set(doc(adminDb, 'clinics', id), { ...baseInfo, id }, { merge: true });
        batch.set(doc(adminDb, 'clinic_settings', id), { unavailableDates: unavailableDates || [], customSchedules: customSchedules || [], daysOfAction: daysOfAction || [], password: password || '123' }, { merge: true });
    });
    await batch.commit(); 
    return { success: true }; 
}

export async function getColoniasData() { return getRawCollection('colonias'); }
export async function updateColonias(c: Colonia[]) { const batch = writeBatch(adminDb); c.forEach(x => batch.set(doc(adminDb, 'colonias', x.id), x)); await batch.commit(); return { success: true }; }

export async function getHolidaysData() { return getRawCollection('holidays'); }
export async function updateHolidays(h: Holiday[]) { const batch = writeBatch(adminDb); const snap = await getDocs(collection(adminDb, 'holidays')); snap.docs.forEach(d => batch.delete(d.ref)); h.forEach(x => batch.set(doc(adminDb, 'holidays', uuidv4()), x)); await batch.commit(); return { success: true }; }

export async function bulkInsertMedications(p: any[]) { 
    const batch = writeBatch(adminDb); 
    p.forEach(item => {
        const mapped = fuzzyMapInsumo(item);
        const id = uuidv4();
        batch.set(doc(adminDb, 'medications', id), { ...mapped, id, updatedAt: new Date().toISOString() });
    });
    await batch.commit(); 
    return { success: true, processedCount: p.length }; 
}

export async function deleteAllMedications() { const snap = await getDocs(collection(adminDb, 'medications')); const batch = writeBatch(adminDb); snap.docs.forEach(d => batch.delete(d.ref)); await batch.commit(); return { success: true }; }

export async function bulkInsertSupplies(p: any[]) { 
    const batch = writeBatch(adminDb); 
    p.forEach(item => {
        const mapped = fuzzyMapInsumo(item);
        const id = uuidv4();
        batch.set(doc(adminDb, 'supplies', id), { ...mapped, id, updatedAt: new Date().toISOString() });
    });
    await batch.commit(); 
    return { success: true, processedCount: p.length }; 
}

export async function bulkInsertDoctors(doctors: any[]) { 
    const batch = writeBatch(adminDb); 
    doctors.forEach(d => {
        const id = uuidv4();
        batch.set(doc(adminDb, 'clinics', id), { 
            id, name: (d.Unidad || d.unidad || 'NUEVA UNIDAD').toUpperCase(),
            doctorName: (d.Médico || d.medico || d.Nombre || 'DR. POR ASIGNAR').toUpperCase(),
            professionalLicense: (d.Cédula || d.cedula || '').toUpperCase(),
            doctorCurp: (d.CURP || d.curp || '').toUpperCase(),
            serviceTypeId: d.Categoría || d.categoria || 'CONSULTA EXTERNA',
            dailySlots: 15, startTime: '08:00', endTime: '13:00', bookingMode: BookingMode.Time, weekendBookingEnabled: false
        });
    });
    await batch.commit(); 
    return { success: true, processedCount: doctors.length }; 
}

export async function getArchiveSettingsData(): Promise<ArchiveSettings> { const password = await getPasswordFromStore('archive', '2026'); return { password }; }
export async function getPharmacySettingsData(): Promise<PharmacySettings> { const password = await getPasswordFromStore('pharmacy', 'farmacia2026'); return { password }; }
export async function getWarehouseSettingsData(): Promise<WarehouseSettings> { const password = await getPasswordFromStore('warehouse', 'almacen2026'); return { password }; }
export async function getBISettingsData(): Promise<BISettings> { const password = await getPasswordFromStore('bi', 'bi2026'); return { password }; }
export async function getAdminSettingsData(): Promise<AdminSettings> { const password = await getPasswordFromStore('superadmin', 'Hu1m4ngu1ll0'); return { password }; }

export async function getLabSettings() { const d = await getDoc(doc(adminDb, 'settings', 'labSettings')); const p = await getPasswordFromStore('lab', 'lab2026'); return d.exists() ? { ...serializeData(d.data()), password: p } : { dailySlots: 20, waitlistSlots: 5, weekendBookingEnabled: false, password: p }; }
export async function getXRaySettings() { const d = await getDoc(doc(adminDb, 'settings', 'xraySettings')); const p = await getPasswordFromStore('xray', 'rx2026'); return d.exists() ? { ...serializeData(d.data()), password: p } : { dailySlots: 10, waitlistSlots: 5, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false, password: p }; }
export async function getUltrasoundSettings() { const d = await getDoc(doc(adminDb, 'settings', 'ultrasoundSettings')); const p = await getPasswordFromStore('ultrasound', 'us2026'); return d.exists() ? { ...serializeData(d.data()), password: p } : { dailySlots: 10, waitlistSlots: 5, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false, password: p }; }
export async function getVaccineSettings() { const d = await getDoc(doc(adminDb, 'settings', 'vaccineSettings')); const p = await getPasswordFromStore('vaccine', 'vac2026'); return d.exists() ? { ...serializeData(d.data()), password: p } : { dailySlots: 30, waitlistSlots: 10, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false, password: p }; }

export async function getLabStudies() { return getRawCollection('labStudies'); }
export async function getXRayStudies() { return getRawCollection('xrayStudies'); }
export async function getUltrasoundStudies() { return getRawCollection('ultrasoundStudies'); }
export async function getVaccines() { return getRawCollection('vaccines'); }
export async function getMedications() { return getRawCollection('medications', 40000); }
export async function getSupplies() { return getRawCollection('supplies', 40000); }
export async function getServiceTypesData() { return getRawCollection('serviceTypes'); }
export async function getSpecialtiesData() { return getRawCollection('specialties'); }

export async function rescheduleAppointment(id: string, date: string, type: string) { await updateDoc(doc(adminDb, type === 'medical' ? 'appointments' : type === 'lab' ? 'labAppointments' : type === 'xray' ? 'xrayAppointments' : type === 'ultrasound' ? 'ultrasoundAppointments' : 'vaccineAppointments', id), { date }); return { success: true, message: 'Fecha actualizada.' }; }
export async function cloneAppointment(id: string, date: string, type: string, time?: string) {
    const coll = type === 'medical' ? 'appointments' : type === 'lab' ? 'labAppointments' : type === 'xray' ? 'xrayAppointments' : type === 'ultrasound' ? 'ultrasoundAppointments' : 'vaccineAppointments';
    const snap = await getDoc(doc(adminDb, coll, id));
    if (!snap.exists()) return { success: false };
    const nid = uuidv4();
    await setDoc(doc(adminDb, coll, nid), { ...snap.data(), id: nid, date, time: time || snap.data().time, appointmentNumber: snap.data().appointmentNumber + '-R', status: 'Agendada', createdAt: new Date().toISOString() });
    return { success: true, message: 'Nueva cita asignada.' };
}

export async function saveNewLabAppointment(appointment: any, patient: any) { const batch = writeBatch(adminDb); const pid = patient.id || uuidv4(); batch.set(doc(adminDb, 'patients', pid), { ...patient, id: pid }, { merge: true }); const aid = uuidv4(); const data = { ...appointment, id: aid, patientId: pid, createdAt: new Date().toISOString() }; batch.set(doc(adminDb, 'labAppointments', aid), data); await batch.commit(); return { success: true, data: { ...data, patient } }; }
export async function saveNewXRayAppointment(appointment: any, patient: any) { const batch = writeBatch(adminDb); const pid = patient.id || uuidv4(); batch.set(doc(adminDb, 'patients', pid), { ...patient, id: pid }, { merge: true }); const aid = uuidv4(); const data = { ...appointment, id: aid, patientId: pid, createdAt: new Date().toISOString() }; batch.set(doc(adminDb, 'xrayAppointments', aid), data); await batch.commit(); return { success: true, data: { appointment: { ...data, patient } } }; }
export async function saveNewUltrasoundAppointment(appointment: any, patient: any) { const batch = writeBatch(adminDb); const pid = patient.id || uuidv4(); batch.set(doc(adminDb, 'patients', pid), { ...patient, id: pid }, { merge: true }); const aid = uuidv4(); const data = { ...appointment, id: aid, patientId: pid, createdAt: new Date().toISOString() }; batch.set(doc(adminDb, 'ultrasoundAppointments', aid), data); await batch.commit(); return { success: true, data: { appointment: { ...data, patient } } }; }
export async function saveNewVaccineAppointment(appointment: any, patient: any) { const batch = writeBatch(adminDb); const pid = patient.id || uuidv4(); batch.set(doc(adminDb, 'patients', pid), { ...patient, id: pid }, { merge: true }); const aid = uuidv4(); const data = { ...appointment, id: aid, patientId: pid, createdAt: new Date().toISOString() }; batch.set(doc(adminDb, 'vaccineAppointments', aid), data); await batch.commit(); return { success: true, data: { ...data, patient } }; }
