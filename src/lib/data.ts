
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
  orderBy,
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

// Helper de serialización robusto para Server Actions
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

// Motor de normalización de encabezados Excel (Mapeo Inteligente)
function fuzzyMapInsumo(item: any) {
    const keys = Object.keys(item);
    const find = (options: string[]) => {
        const found = keys.find(k => {
            const cleanK = k.toLowerCase().trim().replace(/\s/g, '').replace(/[áéíóú]/g, (m) => ({'á':'a','é':'e','í':'i','ó':'o','ú':'u'}[m] || m));
            return options.some(opt => {
                const cleanOpt = opt.toLowerCase().trim().replace(/\s/g, '');
                return cleanK === cleanOpt;
            });
        });
        return found ? item[found] : undefined;
    };

    return {
        claveCuadroBasico: String(find(['clave', 'clavedecuadrobasico', 'articulo', 'codigo']) || 'S/C'),
        descripcion: String(find(['descripcion', 'nombre', 'insumo', 'producto']) || 'SIN DESCRIPCIÓN'),
        existencia: Number(find(['existencia', 'stock', 'cantidad', 'actual', 'cantidadenexistencia']) || 0),
        fechaCaducidad: String(find(['caducidad', 'vencimiento', 'fechadecaducidad', 'fechavencimiento']) || ''),
        lote: String(find(['lote', 'numerodelote', 'loteo']) || 'N/A'),
        grupo: String(find(['grupo', 'categoria', 'familia']) || ''),
        precioUnitario: Number(find(['precio', 'preciounitario', 'costo']) || 0),
        almacen: String(find(['almacen', 'deposito', 'bodega']) || '')
    };
}

// Lector genérico de colecciones con mayor límite para evitar pérdida de datos
async function getRawCollection(name: string, limitNum: number = 40000) {
    try {
        const colRef = collection(adminDb, name);
        let q: Query<DocumentData> = colRef;
        // Ordenar por fecha si es una colección de citas
        if (name.includes('Appointment') || name === 'appointments' || name === 'activityLog' || name === 'prescriptions') {
            q = query(colRef, orderBy(name === 'activityLog' || name === 'prescriptions' ? 'timestamp' : 'date', 'desc'), limit(limitNum));
        } else {
            q = query(colRef, limit(limitNum));
        }
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id }));
    } catch (e) {
        console.error(`Error al leer colección ${name}:`, e);
        return [];
    }
}

// Vinculación de Pacientes robusta
async function getPatientsForApps(apps: any[]) {
    const pIds = Array.from(new Set(apps.map(a => a.patientId).filter(id => !!id)));
    if (pIds.length === 0) return [];
    const pats: any[] = [];
    // Firestore "in" limit is 30
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

// --- ACTIVIDAD ---
export async function logActivity(action: string, details: string) { 
    try {
        await addDoc(collection(adminDb, 'activityLog'), { 
            timestamp: Timestamp.now(), 
            action: action.toUpperCase(), 
            details 
        }); 
    } catch (e) {}
    return { success: true }; 
}

export async function getLogsData() { return getRawCollection('activityLog', 500) as Promise<ActivityLog[]>; }

// --- MÓDULOS ---
export async function getModuleSettings(): Promise<ModuleSettings> {
  const snap = await getDoc(doc(adminDb, 'settings', 'moduleSettings'));
  const base = snap.exists() ? serializeData(snap.data()) as ModuleSettings : {
    citasMedicasEnabled: true, laboratorioEnabled: true, rayosXEnabled: true, ultrasoundEnabled: true, vacunasEnabled: true,
    archivoEnabled: true, farmaciaEnabled: true, almacenEnabled: true, archivoConsultaEnabled: true,
    citasMedicasWhatsAppEnabled: true, laboratorioWhatsAppEnabled: true, rayosXWhatsAppEnabled: true, ultrasoundWhatsAppEnabled: true, vacunasWhatsAppEnabled: true, archivoWhatsAppEnabled: true
  };
  const [citasPass, consultaPass] = await Promise.all([
      getPasswordFromStore('medical', 'citas2026'),
      getPasswordFromStore('archiveInquiry', '2026')
  ]);
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

// --- PACIENTES ---
export async function getPatientsData(options?: any): Promise<Patient[]> {
  const colRef = collection(adminDb, 'patients');
  let q: Query<DocumentData> = colRef;
  if (options?.searchCurp) q = query(colRef, where('curp', '==', options.searchCurp.toUpperCase()), limit(50));
  else if (options?.searchExpediente) q = query(colRef, where('expediente', '==', options.searchExpediente), limit(50));
  else if (options?.status && options.status !== 'Total') q = query(colRef, where('status', '==', options.status), limit(1000));
  else q = query(colRef, orderBy('paternalLastName'), limit(options?.limitNum || 2000));
  const snap = await getDocs(q);
  let results = snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id })) as Patient[];
  if (options?.searchName) {
      const t = options.searchName.toUpperCase();
      results = results.filter(p => `${p.name} ${p.paternalLastName} ${p.maternalLastName}`.toUpperCase().includes(t));
  }
  return results;
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

// --- CITAS ---
export async function getAppointmentsData() {
    const apps = await getRawCollection('appointments', 40000); 
    const pats = await getPatientsForApps(apps);
    const clinics = await getClinicsData();
    return apps.map(a => {
        const clinic = clinics.find(c => c.id === a.clinicId) || clinics.find(c => c.name.toUpperCase() === (a.clinicName || '').toUpperCase());
        return { 
            ...a, 
            patient: pats.find(p => p.id === a.patientId), 
            clinicName: clinic?.name || a.clinicName || 'N/A' 
        };
    });
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

export async function deleteAppointment(id: string) { await deleteDoc(doc(adminDb, 'appointments', id)); return { success: true }; }
export async function deleteLabAppointment(id: string) { await deleteDoc(doc(adminDb, 'labAppointments', id)); return { success: true }; }
export async function deleteXRayAppointment(id: string) { await deleteDoc(doc(adminDb, 'xrayAppointments', id)); return { success: true }; }
export async function deleteUltrasoundAppointment(id: string) { await deleteDoc(doc(adminDb, 'ultrasoundAppointments', id)); return { success: true }; }
export async function deleteVaccineAppointment(id: string) { await deleteDoc(doc(adminDb, 'vaccineAppointments', id)); return { success: true }; }

export async function rescheduleAppointment(id: string, date: string, type: string) {
    const coll = type === 'medical' ? 'appointments' : type === 'lab' ? 'labAppointments' : type === 'xray' ? 'xrayAppointments' : type === 'ultrasound' ? 'ultrasoundAppointments' : 'vaccineAppointments';
    await updateDoc(doc(adminDb, coll, id), { date });
    return { success: true, message: 'Fecha actualizada correctamente.' };
}

export async function cloneAppointment(id: string, date: string, type: string, time?: string) {
    const coll = type === 'medical' ? 'appointments' : type === 'lab' ? 'labAppointments' : type === 'xray' ? 'xrayAppointments' : type === 'ultrasound' ? 'ultrasoundAppointments' : 'vaccineAppointments';
    const snap = await getDoc(doc(adminDb, coll, id));
    if (!snap.exists()) return { success: false, message: 'Cita no encontrada.' };
    const data = snap.data();
    const newId = uuidv4();
    const newFolio = data.appointmentNumber + '-R';
    await setDoc(doc(adminDb, coll, newId), { ...data, id: newId, date, time: time || data.time, appointmentNumber: newFolio, status: 'Agendada', createdAt: new Date().toISOString() });
    return { success: true, message: 'Nueva cita asignada exitosamente.' };
}

export async function getAppointmentsForClinic(cid: string) {
    const apps = await getRawCollection('appointments', 40000);
    const clinics = await getClinicsData();
    const target = clinics.find(c => c.id === cid);
    const pats = await getPatientsForApps(apps);
    return apps.filter(a => a.clinicId === cid || (target && (a.clinicName || '').toUpperCase() === target.name.toUpperCase()))
               .map(a => ({ ...a, patient: pats.find(p => p.id === a.patientId) }));
}

export async function getAvailableSlotsForDate(cid: string, date: string) {
    const dateStr = date.split('T')[0];
    const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', cid));
    const snap = await getDocs(q);
    const booked = snap.docs.filter(d => (serializeData(d.data().date) || '').startsWith(dateStr)).map(d => d.data().time);
    const clinic = (await getClinicsData()).find(c => c.id === cid);
    if (!clinic) return {};
    
    if (clinic.bookingMode === BookingMode.Token) {
        const total = (clinic.dailySlots || 15) + (clinic.waitlistSlots || 0);
        const tokens = Array.from({ length: total }, (_, i) => i + 1).filter(t => !booked.some(b => b === `Ficha ${t}`));
        return { tokens };
    } else {
        // Simple 30 min distribution for fallback
        const slots = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30"].filter(s => !booked.includes(s));
        return { timeSlots: slots };
    }
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

export async function saveNewLabAppointment(appointment: any, patient: any) {
    const batch = writeBatch(adminDb);
    const pId = patient.id || uuidv4();
    batch.set(doc(adminDb, 'patients', pId), { ...patient, id: pId }, { merge: true });
    const appId = uuidv4();
    const appData = { ...appointment, id: appId, patientId: pId, createdAt: new Date().toISOString() };
    batch.set(doc(adminDb, 'labAppointments', appId), appData);
    await batch.commit();
    return { success: true, data: { ...appData, patient } };
}

export async function saveNewXRayAppointment(appointment: any, patient: any) {
    const batch = writeBatch(adminDb);
    const pId = patient.id || uuidv4();
    batch.set(doc(adminDb, 'patients', pId), { ...patient, id: pId }, { merge: true });
    const appId = uuidv4();
    const appData = { ...appointment, id: appId, patientId: pId, createdAt: new Date().toISOString() };
    batch.set(doc(adminDb, 'xrayAppointments', appId), appData);
    await batch.commit();
    const studies = await getXRayStudies();
    return { success: true, data: { appointment: { ...appData, patient }, study: studies.find(s => s.id === appointment.studyId) } };
}

export async function saveNewUltrasoundAppointment(appointment: any, patient: any) {
    const batch = writeBatch(adminDb);
    const pId = patient.id || uuidv4();
    batch.set(doc(adminDb, 'patients', pId), { ...patient, id: pId }, { merge: true });
    const appId = uuidv4();
    const appData = { ...appointment, id: appId, patientId: pId, createdAt: new Date().toISOString() };
    batch.set(doc(adminDb, 'ultrasoundAppointments', appId), appData);
    await batch.commit();
    const studies = await getUltrasoundStudies();
    return { success: true, data: { appointment: { ...appData, patient }, study: studies.find(s => s.id === appointment.studyId) } };
}

export async function saveNewVaccineAppointment(appointment: any, patient: any) {
    const batch = writeBatch(adminDb);
    const pId = patient.id || uuidv4();
    batch.set(doc(adminDb, 'patients', pId), { ...patient, id: pId }, { merge: true });
    const appId = uuidv4();
    const appData = { ...appointment, id: appId, patientId: pId, createdAt: new Date().toISOString() };
    batch.set(doc(adminDb, 'vaccineAppointments', appId), appData);
    await batch.commit();
    return { success: true, data: { ...appData, patient } };
}

// --- CLÍNICAS Y COLONIAS ---
export async function getClinicsData(): Promise<Clinic[]> { 
    const [clinicsSnap, settingsSnap] = await Promise.all([
        getDocs(collection(adminDb, 'clinics')),
        getDocs(collection(adminDb, 'clinic_settings'))
    ]);
    const settingsMap = new Map();
    settingsSnap.docs.forEach(d => settingsMap.set(d.id, d.data()));
    return clinicsSnap.docs.map(d => ({ ...serializeData(d.data()), ...(settingsMap.get(d.id) || {}), id: d.id } as Clinic));
}

export async function updateClinics(clinics: Clinic[]) { 
    const batch = writeBatch(adminDb); 
    clinics.forEach(c => {
        const { id, unavailableDates, customSchedules, daysOfAction, password, ...baseInfo } = c;
        batch.set(doc(adminDb, 'clinics', id), { ...baseInfo, id }, { merge: true });
        batch.set(doc(adminDb, 'clinic_settings', id), { 
            unavailableDates: unavailableDates || [], 
            customSchedules: customSchedules || [], 
            daysOfAction: daysOfAction || [], 
            password: password || '123' 
        }, { merge: true });
    });
    await batch.commit(); 
    return { success: true }; 
}

export async function deleteClinic(id: string) { await deleteDoc(doc(adminDb, 'clinics', id)); await deleteDoc(doc(adminDb, 'clinic_settings', id)); return { success: true }; }
export async function getColoniasData() { return getRawCollection('colonias') as Promise<Colonia[]>; }
export async function updateColonias(c: Colonia[]) { const batch = writeBatch(adminDb); c.forEach(x => batch.set(doc(adminDb, 'colonias', x.id), x)); await batch.commit(); return { success: true }; }

// --- MANTENIMIENTO Y CIE-10 ---
export async function bulkInsertCie10Glossary(items: any[]) { const batch = writeBatch(adminDb); items.forEach(i => batch.set(doc(adminDb, 'cie10_glossary', uuidv4()), i)); await batch.commit(); return { success: true, processedCount: items.length }; }
export async function bulkInsertCie10Catalog(items: any[]) { const batch = writeBatch(adminDb); items.forEach(i => batch.set(doc(adminDb, 'cie10_catalog', uuidv4()), i)); await batch.commit(); return { success: true, processedCount: items.length }; }
export async function deleteAllCie10Glossary() { const snap = await getDocs(collection(adminDb, 'cie10_glossary')); const batch = writeBatch(adminDb); snap.docs.forEach(d => batch.delete(d.ref)); await batch.commit(); return { success: true }; }
export async function deleteAllCie10Catalog() { const snap = await getDocs(collection(adminDb, 'cie10_catalog')); const batch = writeBatch(adminDb); snap.docs.forEach(d => batch.delete(d.ref)); await batch.commit(); return { success: true }; }
export async function searchCie10Data(term: string) {
    const colRef = collection(adminDb, 'cie10_catalog');
    const q = query(colRef, where('nombre', '>=', term), where('nombre', '<=', term + '\uf8ff'), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id })) as Cie10Record[];
}

export async function bulkInsertPatients(p: any[]) {
    const batch = writeBatch(adminDb);
    p.forEach(item => {
        const id = uuidv4();
        batch.set(doc(adminDb, 'patients', id), { ...item, id, status: PatientStatus.Vigente });
    });
    await batch.commit();
    return { success: true, processedCount: p.length };
}

export async function bulkInsertDoctors(doctors: any[]) { 
    const batch = writeBatch(adminDb); 
    doctors.forEach(d => {
        const id = uuidv4();
        batch.set(doc(adminDb, 'clinics', id), { 
            id, 
            name: (d.Unidad || d.unidad || 'NUEVA UNIDAD').toUpperCase(),
            doctorName: (d.Médico || d.medico || d.Nombre || 'DR. POR ASIGNAR').toUpperCase(),
            professionalLicense: (d.Cédula || d.cedula || '').toUpperCase(),
            doctorCurp: (d.CURP || d.curp || '').toUpperCase(),
            serviceTypeId: d.Categoría || d.categoria || 'CONSULTA EXTERNA',
            dailySlots: 15,
            startTime: '08:00',
            endTime: '13:00',
            bookingMode: BookingMode.Time,
            weekendBookingEnabled: false
        });
    });
    await batch.commit(); 
    return { success: true, processedCount: doctors.length }; 
}

export async function scanDuplicates(criteria: string) {
    const patients = await getRawCollection('patients') as Patient[];
    const groups = new Map<string, Patient[]>();
    patients.forEach(p => {
        let key = '';
        if (criteria === 'expediente') key = p.expediente || '';
        else if (criteria === 'curp') key = p.curp || '';
        else key = `${p.name} ${p.paternalLastName}`;
        if (!key) return;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(p);
    });
    return Array.from(groups.values()).filter(g => g.length > 1);
}

export async function applyStatusUpdateChunk(exps: string[], s: string) { 
    const batch = writeBatch(adminDb); 
    let count = 0; 
    for (const exp of exps) { 
        const q = query(collection(adminDb, 'patients'), where('expediente', '==', exp)); 
        const snap = await getDocs(q); 
        snap.docs.forEach(d => { batch.update(d.ref, { status: s }); count++; }); 
    } 
    await batch.commit(); 
    return { success: true, count }; 
}

export async function normalizeExpedientesAction() { 
    const pats = await getRawCollection('patients') as Patient[]; 
    const batch = writeBatch(adminDb); 
    let count = 0; 
    pats.forEach(p => { if (p.expediente && !p.expediente.startsWith('0')) { batch.update(doc(adminDb, 'patients', p.id), { expediente: '0' + p.expediente }); count++; } }); 
    await batch.commit(); 
    return { success: true, count }; 
}

export async function downloadBackupAction() { 
    const [p, a, l, x, u, v, c] = await Promise.all([
        getRawCollection('patients'), getRawCollection('appointments'), getRawCollection('labAppointments'),
        getRawCollection('xrayAppointments'), getRawCollection('ultrasoundAppointments'), getRawCollection('vaccineAppointments'),
        getRawCollection('clinics')
    ]);
    return { success: true, data: { patients: p, appointments: a, labAppointments: l, xRayAppointments: x, ultrasoundAppointments: u, vaccineAppointments: v, clinics: c } };
}

export async function cleanupOldRecords() { 
    const snap = await getDocs(collection(adminDb, 'appointments')); 
    const batch = writeBatch(adminDb); 
    snap.docs.forEach(d => batch.delete(d.ref)); 
    await batch.commit(); 
    return { success: true, deletedCount: snap.size }; 
}

// --- CONSULTAS Y RECETAS ---
export async function getConsultationsByPatientId(pid: string) { const q = query(collection(adminDb, 'medicalConsultations'), where('patientId', '==', pid), orderBy('date', 'desc'), limit(100)); const snap = await getDocs(q); return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id })) as MedicalConsultation[]; }
export async function saveMedicalConsultation(c: any) { const id = c.id || uuidv4(); await setDoc(doc(adminDb, 'medicalConsultations', id), { ...c, id }, { merge: true }); if (c.isFinal) await updateDoc(doc(adminDb, 'appointments', c.appointmentId), { status: 'Atendido' }); return { success: true, id }; }
export async function getConsultationByAppointmentId(aid: string) { const q = query(collection(adminDb, 'medicalConsultations'), where('appointmentId', '==', aid), limit(1)); const snap = await getDocs(q); return snap.empty ? null : { ...serializeData(snap.docs[0].data()), id: snap.docs[0].id } as MedicalConsultation; }
export async function getPrescriptionsByPatientId(pid: string) { const q = query(collection(adminDb, 'prescriptions'), where('patientId', '==', pid), orderBy('date', 'desc'), limit(50)); const snap = await getDocs(q); return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id })) as Prescription[]; }
export async function createPrescription(p: any) { const id = uuidv4(); const folio = `REC-${uuidv4().split('-')[0].toUpperCase()}`; const expAt = new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString(); const data = { ...p, id, folio, expiresAt: expAt, status: 'pendiente', createdAt: new Date().toISOString(), timestamp: Timestamp.now() }; await setDoc(doc(adminDb, 'prescriptions', id), data); return { success: true, folio, prescription: data }; }
export async function dispensePrescription(id: string, items: any[]) { const batch = writeBatch(adminDb); items.forEach(i => batch.update(doc(adminDb, 'medications', i.medicationId), { existencia: increment(-i.quantity) })); batch.update(doc(adminDb, 'prescriptions', id), { status: 'surtida', dispensedDate: new Date().toISOString() }); await batch.commit(); return { success: true }; }
export async function deletePrescription(id: string) { await deleteDoc(doc(adminDb, 'prescriptions', id)); return { success: true }; }
export async function getPendingPrescriptions(f: any) { const all = await getRawCollection('prescriptions', 1000) as Prescription[]; let res = f?.status ? all.filter(r => r.status === f.status) : all; if (f?.folio) res = res.filter(r => r.folio.toUpperCase() === f.folio.toUpperCase()); if (f?.clinicId && f.clinicId !== 'all') res = res.filter(r => r.clinicId === f.clinicId); return res.sort((a, b) => b.date.localeCompare(a.date)); }
export async function getPatientPrescriptionsCountTodayAction(pid: string) { const now = new Date(); now.setHours(0,0,0,0); const start = now.toISOString(); const q = query(collection(adminDb, 'prescriptions'), where('patientId', '==', pid), where('createdAt', '>=', start)); const snap = await getDocs(q); return snap.size; }
export async function getAttendedPatientsForClinic(cid: string) { const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', cid), where('status', '==', 'Atendido'), limit(500)); const snap = await getDocs(q); const pIds = Array.from(new Set(snap.docs.map(d => d.data().patientId))); if (pIds.length === 0) return []; const pats: Patient[] = []; for (let i = 0; i < pIds.length; i += 30) { const chunk = pIds.slice(i, i + 30); const pq = query(collection(adminDb, 'patients'), where('__name__', 'in', chunk)); const psnap = await getDocs(pq); pats.push(...psnap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as Patient))); } return pats; }
export async function deleteMedicalConsultation(id: string) { await deleteDoc(doc(adminDb, 'medicalConsultations', id)); return { success: true }; }
export async function updatePrescription(id: string, p: any) { await updateDoc(doc(adminDb, 'prescriptions', id), p); return { success: true }; }

// --- SEGURIDAD ---
export async function getAdminSettingsData(): Promise<AdminSettings> { const password = await getPasswordFromStore('superadmin', 'Hu1m4ngu1ll0'); return { password }; }
export async function updateAdminSettings(s: AdminSettings) { if(s.password) await setDoc(doc(adminDb, 'module_passwords', 'superadmin'), { password: s.password }); return { success: true }; }
export async function getArchiveSettingsData(): Promise<ArchiveSettings> { const password = await getPasswordFromStore('archive', '2026'); return { password }; }
export async function updateArchiveSettings(s: ArchiveSettings) { if(s.password) await setDoc(doc(adminDb, 'module_passwords', 'archive'), { password: s.password }); return { success: true }; }
export async function getPharmacySettingsData(): Promise<PharmacySettings> { const password = await getPasswordFromStore('pharmacy', 'farmacia2026'); return { password }; }
export async function updatePharmacySettings(s: PharmacySettings) { if(s.password) await setDoc(doc(adminDb, 'module_passwords', 'pharmacy'), { password: s.password }); return { success: true }; }
export async function getWarehouseSettingsData(): Promise<WarehouseSettings> { const password = await getPasswordFromStore('warehouse', 'almacen2026'); return { password }; }
export async function updateWarehouseSettings(s: WarehouseSettings) { if(s.password) await setDoc(doc(adminDb, 'module_passwords', 'warehouse'), { password: s.password }); return { success: true }; }
export async function getBISettingsData(): Promise<BISettings> { const password = await getPasswordFromStore('bi', 'bi2026'); return { password }; }
export async function updateBISettings(s: BISettings) { if(s.password) await setDoc(doc(adminDb, 'module_passwords', 'bi'), { password: s.password }); return { success: true }; }

// --- CONFIGURACIÓN POR SERVICIO ---
export async function getLabSettings() { const d = await getDoc(doc(adminDb, 'settings', 'labSettings')); const p = await getPasswordFromStore('lab', 'lab2026'); return d.exists() ? { ...serializeData(d.data()), password: p } : { dailySlots: 20, waitlistSlots: 5, weekendBookingEnabled: false, password: p }; }
export async function updateLabSettings(s: LabSettings) { const { password, ...rest } = s; await setDoc(doc(adminDb, 'settings', 'labSettings'), rest); if (password) await setDoc(doc(adminDb, 'module_passwords', 'lab'), { password }); return { success: true }; }
export async function getXRaySettings() { const d = await getDoc(doc(adminDb, 'settings', 'xraySettings')); const p = await getPasswordFromStore('xray', 'rx2026'); return d.exists() ? { ...serializeData(d.data()), password: p } : { dailySlots: 10, waitlistSlots: 5, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false, password: p }; }
export async function updateXRaySettings(s: XRaySettings) { const { password, ...rest } = s; await setDoc(doc(adminDb, 'settings', 'xraySettings'), rest); if (password) await setDoc(doc(adminDb, 'module_passwords', 'xray'), { password }); return { success: true }; }
export async function getUltrasoundSettings() { const d = await getDoc(doc(adminDb, 'settings', 'ultrasoundSettings')); const p = await getPasswordFromStore('ultrasound', 'us2026'); return d.exists() ? { ...serializeData(d.data()), password: p } : { dailySlots: 10, waitlistSlots: 5, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false, password: p }; }
export async function updateUltrasoundSettings(s: UltrasoundSettings) { const { password, ...rest } = s; await setDoc(doc(adminDb, 'settings', 'ultrasoundSettings'), rest); if (password) await setDoc(doc(adminDb, 'module_passwords', 'ultrasound'), { password }); return { success: true }; }
export async function getVaccineSettings() { const d = await getDoc(doc(adminDb, 'settings', 'vaccineSettings')); const p = await getPasswordFromStore('vaccine', 'vac2026'); return d.exists() ? { ...serializeData(d.data()), password: p } : { dailySlots: 30, waitlistSlots: 10, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false, password: p }; }
export async function updateVaccineSettings(s: VaccineSettings) { const { password, ...rest } = s; await setDoc(doc(adminDb, 'settings', 'vaccineSettings'), rest); if (password) await setDoc(doc(adminDb, 'module_passwords', 'vaccine'), { password }); return { success: true }; }

// --- CATÁLOGOS Y ESTUDIOS ---
export async function getHolidaysData() { return getRawCollection('holidays') as Promise<Holiday[]>; }
export async function updateHolidays(h: Holiday[]) { const batch = writeBatch(adminDb); const snap = await getDocs(collection(adminDb, 'holidays')); snap.docs.forEach(d => batch.delete(d.ref)); h.forEach(x => batch.set(doc(adminDb, 'holidays', uuidv4()), x)); await batch.commit(); return { success: true }; }
export async function getSpecialActionDaysData() { return getRawCollection('specialActionDays') as Promise<SpecialActionDay[]>; }
export async function updateSpecialActionDays(items: SpecialActionDay[]) { const batch = writeBatch(adminDb); const snap = await getDocs(collection(adminDb, 'specialActionDays')); snap.docs.forEach(d => batch.delete(d.ref)); items.forEach(i => batch.set(doc(adminDb, 'specialActionDays', uuidv4()), i)); await batch.commit(); return { success: true }; }
export async function getLabStudies() { return getRawCollection('labStudies') as Promise<LabStudy[]>; }
export async function updateLabStudies(s: LabStudy[]) { const batch = writeBatch(adminDb); s.forEach(x => batch.set(doc(adminDb, 'labStudies', x.id), x)); await batch.commit(); return { success: true }; }
export async function getXRayStudies() { return getRawCollection('xrayStudies') as Promise<XRayStudy[]>; }
export async function updateXRayStudies(s: XRayStudy[]) { const batch = writeBatch(adminDb); s.forEach(x => batch.set(doc(adminDb, 'xrayStudies', x.id), x)); await batch.commit(); return { success: true }; }
export async function getUltrasoundStudies() { return getRawCollection('ultrasoundStudies') as Promise<UltrasoundStudy[]>; }
export async function updateUltrasoundStudies(s: UltrasoundStudy[]) { const batch = writeBatch(adminDb); s.forEach(x => batch.set(doc(adminDb, 'ultrasoundStudies', x.id), x)); await batch.commit(); return { success: true }; }
export async function getVaccines() { return getRawCollection('vaccines') as Promise<Vaccine[]>; }
export async function updateVaccines(v: Vaccine[]) { const batch = writeBatch(adminDb); v.forEach(x => batch.set(doc(adminDb, 'vaccines', x.id), x)); await batch.commit(); return { success: true }; }

export async function getMedications() { return getRawCollection('medications') as Promise<Medication[]>; }
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

export async function getSupplies() { return getRawCollection('supplies') as Promise<Supply[]>; }
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
export async function deleteAllSupplies() { const snap = await getDocs(collection(adminDb, 'supplies')); const batch = writeBatch(adminDb); snap.docs.forEach(d => batch.delete(d.ref)); await batch.commit(); return { success: true }; }

export async function getServiceTypesData() { return getRawCollection('serviceTypes') as Promise<ServiceType[]>; }
export async function updateServiceTypes(s: ServiceType[]) { const batch = writeBatch(adminDb); s.forEach(x => batch.set(doc(adminDb, 'serviceTypes', x.id), x)); await batch.commit(); return { success: true }; }
export async function getSpecialtiesData() { return getRawCollection('specialties') as Promise<Specialty[]>; }
export async function updateSpecialties(s: Specialty[]) { const batch = writeBatch(adminDb); s.forEach(x => batch.set(doc(adminDb, 'specialties', x.id), x)); await batch.commit(); return { success: true }; }

export async function getAnnouncementsData() { const d = await getDoc(doc(adminDb, 'settings', 'announcements')); return d.exists() ? d.data().messages : []; }
export async function updateAnnouncements(m: string[]) { await setDoc(doc(adminDb, 'settings', 'announcements'), { messages: m }); return { success: true }; }

export async function getAppointmentCountOnDate(cid: string, d: string) { 
    const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', cid));
    const snap = await getDocs(q);
    const count = snap.docs.filter(docSnap => {
        const dateVal = docSnap.data().date;
        const dateStr = dateVal instanceof Timestamp ? dateVal.toDate().toISOString() : String(dateVal || '');
        return dateStr.startsWith(d);
    }).length;
    return count; 
}
