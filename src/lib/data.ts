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

// Helper de serialización para NextJS Server Actions
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

// Motor de normalización de encabezados Excel
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
        claveCuadroBasico: String(find(['clave', 'clavedecuadrobasico', 'articulo']) || 'S/C'),
        descripcion: String(find(['descripcion', 'nombre', 'insumo']) || 'SIN DESCRIPCIÓN'),
        existencia: Number(find(['existencia', 'stock', 'cantidad', 'actual']) || 0),
        fechaCaducidad: String(find(['caducidad', 'vencimiento', 'fechadecaducidad']) || ''),
        lote: String(find(['lote', 'numerodelote']) || 'N/A'),
        grupo: String(find(['grupo', 'categoria']) || ''),
        precioUnitario: Number(find(['precio', 'preciounitario', 'costo']) || 0),
        almacen: String(find(['almacen', 'deposito']) || '')
    };
}

// Lector genérico de colecciones
async function getRawCollection(name: string, limitNum?: number) {
    try {
        const colRef = collection(adminDb, name);
        let q: Query<DocumentData> = colRef;
        if (limitNum) q = query(colRef, limit(limitNum));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id }));
    } catch (e) {
        console.error(`Error al leer colección ${name}:`, e);
        return [];
    }
}

// Motor de Vinculación de Pacientes eficiente
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

// GESTIÓN DE SEGURIDAD BLINDADA
async function getPasswordFromStore(id: string, defaultPass: string): Promise<string> {
    const snap = await getDoc(doc(adminDb, 'module_passwords', id));
    return snap.exists() ? snap.data().password : defaultPass;
}

export async function logActivity(action: string, details: string) { 
    await addDoc(collection(adminDb, 'activityLog'), { timestamp: Timestamp.now(), action, details }); 
    return { success: true }; 
}

// CONFIGURACIONES
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

export async function getAdminSettingsData(): Promise<AdminSettings> { 
    const password = await getPasswordFromStore('superadmin', 'Hu1m4ngu1ll0');
    return { password };
}

export async function updateAdminSettings(settings: AdminSettings) { 
    if (settings.password) await setDoc(doc(adminDb, 'module_passwords', 'superadmin'), { password: settings.password });
    return { success: true }; 
}

export async function getArchiveSettingsData(): Promise<ArchiveSettings> {
    const password = await getPasswordFromStore('archive', '2026');
    return { password };
}

export async function updateArchiveSettings(settings: ArchiveSettings) {
    if (settings.password) await setDoc(doc(adminDb, 'module_passwords', 'archive'), { password: settings.password });
    return { success: true };
}

export async function getPharmacySettingsData(): Promise<PharmacySettings> {
    const password = await getPasswordFromStore('pharmacy', 'farmacia2026');
    return { password };
}

export async function updatePharmacySettings(settings: PharmacySettings) {
    if (settings.password) await setDoc(doc(adminDb, 'module_passwords', 'pharmacy'), { password: settings.password });
    return { success: true };
}

export async function getWarehouseSettingsData(): Promise<WarehouseSettings> {
    const password = await getPasswordFromStore('warehouse', 'almacen2026');
    return { password };
}

export async function updateWarehouseSettings(settings: WarehouseSettings) {
    if (settings.password) await setDoc(doc(adminDb, 'module_passwords', 'warehouse'), { password: settings.password });
    return { success: true };
}

export async function getBISettingsData(): Promise<BISettings> {
    const password = await getPasswordFromStore('bi', 'bi2026');
    return { password };
}

export async function updateBISettings(settings: BISettings) {
    if (settings.password) await setDoc(doc(adminDb, 'module_passwords', 'bi'), { password: settings.password });
    return { success: true };
}

// PACIENTES
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

export async function updatePatient(id: string, p: Partial<Patient>) { await updateDoc(doc(adminDb, 'patients', id), p); return { success: true }; }
export async function updatePatientStatus(id: string, s: string) { await updateDoc(doc(adminDb, 'patients', id), { status: s }); return { success: true }; }
export async function deletePatient(id: string) { await deleteDoc(doc(adminDb, 'patients', id)); return { success: true }; }
export async function deletePatients(ids: string[]) { const batch = writeBatch(adminDb); ids.forEach(id => batch.delete(doc(adminDb, 'patients', id))); await batch.commit(); return { success: true }; }
export async function savePatient(p: Omit<Patient, 'id'>, id: string) { await setDoc(doc(adminDb, 'patients', id), p); return { success: true }; }
export async function getPatientByCURP(curp: string) { const q = query(collection(adminDb, 'patients'), where('curp', '==', curp), limit(1)); const snap = await getDocs(q); return snap.empty ? { success: false } : { success: true, data: { ...serializeData(snap.docs[0].data()), id: snap.docs[0].id } }; }

// CITAS
export async function getAppointmentsData() {
    const apps = await getRawCollection('appointments', 15000); 
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
export async function getLabAppointmentsData() { const apps = await getRawCollection('labAppointments', 2000); const pats = await getPatientsForApps(apps); return apps.map(a => ({ ...a, patient: pats.find(p => p.id === a.patientId) })); }
export async function getXRayAppointmentsData() { const apps = await getRawCollection('xrayAppointments', 2000); const pats = await getPatientsForApps(apps); return apps.map(a => ({ ...a, patient: pats.find(p => p.id === a.patientId) })); }
export async function getUltrasoundAppointmentsData() { const apps = await getRawCollection('ultrasoundAppointments', 2000); const pats = await getPatientsForApps(apps); return apps.map(a => ({ ...a, patient: pats.find(p => p.id === a.patientId) })); }
export async function getVaccineAppointmentsData() { const apps = await getRawCollection('vaccineAppointments', 2000); const pats = await getPatientsForApps(apps); return apps.map(a => ({ ...a, patient: pats.find(p => p.id === a.patientId) })); }

export async function saveNewAppointment(a: any, pData: any, isDouble: boolean, colonia?: string) {
    let pId;
    const q = query(collection(adminDb, 'patients'), where('curp', '==', pData.curp), limit(1));
    const pSnap = await getDocs(q);
    if (!pSnap.empty) { pId = pSnap.docs[0].id; await updateDoc(doc(adminDb, 'patients', pId), pData); }
    else { pId = uuidv4(); await setDoc(doc(adminDb, 'patients', pId), pData); }
    const app = { ...a, patientId: pId, coloniaName: colonia, createdAt: new Date().toISOString() };
    const docRef = await addDoc(collection(adminDb, 'appointments'), app);
    const finalApp = { ...app, id: docRef.id, patient: { ...pData, id: pId }, appointmentNumber: `MED-${docRef.id.substring(0, 5).toUpperCase()}` };
    await updateDoc(docRef, { appointmentNumber: finalApp.appointmentNumber });
    const clinic = await getDoc(doc(adminDb, 'clinics', a.clinicId));
    return { success: true, data: { appointment: finalApp, clinic: clinic.data() } };
}

export async function saveNewLabAppointment(a: any, p: any) { return genericSaveApp(a, p, 'labAppointments', 'LAB'); }
export async function saveNewXRayAppointment(a: any, p: any) { return genericSaveApp(a, p, 'xrayAppointments', 'RX'); }
export async function saveNewUltrasoundAppointment(a: any, p: any) { return genericSaveApp(a, p, 'ultrasoundAppointments', 'US'); }
export async function saveNewVaccineAppointment(a: any, p: any) { return genericSaveApp(a, p, 'vaccineAppointments', 'VAC'); }

async function genericSaveApp(a: any, pData: any, col: string, prefix: string) {
    let pId;
    const q = query(collection(adminDb, 'patients'), where('curp', '==', pData.curp), limit(1));
    const pSnap = await getDocs(q);
    if (!pSnap.empty) { pId = pSnap.docs[0].id; await updateDoc(doc(adminDb, 'patients', pId), pData); }
    else { pId = uuidv4(); await setDoc(doc(adminDb, 'patients', pId), pData); }
    const app = { ...a, patientId: pId, createdAt: new Date().toISOString() };
    const docRef = await addDoc(collection(adminDb, col), app);
    const folio = `${prefix}-${docRef.id.substring(0, 5).toUpperCase()}`;
    await updateDoc(docRef, { appointmentNumber: folio });
    return { success: true, data: { ...app, id: docRef.id, patient: { ...pData, id: pId }, appointmentNumber: folio } };
}

export async function updateAppointmentStatus(aid: string, s: string, type: string) {
    const colMap: any = { medical: 'appointments', lab: 'labAppointments', xray: 'xrayAppointments', ultrasound: 'ultrasoundAppointments', vaccine: 'vaccineAppointments' };
    await updateDoc(doc(adminDb, colMap[type] || 'appointments', aid), { status: s });
    return { success: true };
}

export async function deleteAppointment(id: string) { await deleteDoc(doc(adminDb, 'appointments', id)); return { success: true }; }
export async function deleteLabAppointment(id: string) { await deleteDoc(doc(adminDb, 'labAppointments', id)); return { success: true }; }
export async function deleteXRayAppointment(id: string) { await deleteDoc(doc(adminDb, 'xrayAppointments', id)); return { success: true }; }
export async function deleteUltrasoundAppointment(id: string) { await deleteDoc(doc(adminDb, 'ultrasoundAppointments', id)); return { success: true }; }
export async function deleteVaccineAppointment(id: string) { await deleteDoc(doc(adminDb, 'vaccineAppointments', id)); return { success: true }; }

export async function rescheduleAppointment(id: string, d: string, type: string) {
    const colMap: any = { medical: 'appointments', lab: 'labAppointments', xray: 'xrayAppointments', ultrasound: 'ultrasoundAppointments', vaccine: 'vaccineAppointments' };
    await updateDoc(doc(adminDb, colMap[type] || 'appointments', id), { date: d });
    return { success: true, message: 'Fecha actualizada.' };
}

export async function cloneAppointment(id: string, d: string, type: string, time?: string) {
    const colMap: any = { medical: 'appointments', lab: 'labAppointments', xray: 'xrayAppointments', ultrasound: 'ultrasoundAppointments', vaccine: 'vaccineAppointments' };
    const snap = await getDoc(doc(adminDb, colMap[type], id));
    if (!snap.exists()) return { success: false };
    const data = snap.data();
    const newId = uuidv4();
    const folio = `${type.substring(0,3).toUpperCase()}-${newId.substring(0,5).toUpperCase()}`;
    await setDoc(doc(adminDb, colMap[type], newId), { ...data, id: newId, date: d, time: time || data.time, status: 'Agendada', appointmentNumber: folio, createdAt: new Date().toISOString() });
    return { success: true, message: 'Nueva cita asignada.' };
}

export async function getAppointmentsForClinic(cid: string) {
    const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', cid));
    const snap = await getDocs(q);
    const apps = snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id }));
    const pats = await getPatientsForApps(apps);
    return apps.map(a => ({ ...a, patient: pats.find(p => p.id === a.patientId) }));
}

export async function getAppointmentCountOnDate(cid: string, d: string) { 
    const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', cid));
    const snap = await getDocs(q);
    const count = snap.docs.filter(docSnap => {
        const data = docSnap.data();
        const dateVal = data.date;
        const dateStr = dateVal instanceof Timestamp ? dateVal.toDate().toISOString() : String(dateVal || '');
        return dateStr.startsWith(d);
    }).length;
    return count; 
}

export async function getAvailableSlotsForDate(clinicId: string, date: string) {
    const clinicRef = doc(adminDb, 'clinics', clinicId);
    const [clinicSnap, settingsSnap] = await Promise.all([
        getDoc(clinicRef),
        getDoc(doc(adminDb, 'clinic_settings', clinicId))
    ]);
    if (!clinicSnap.exists()) return { timeSlots: [], tokens: [] };
    const clinic = { ...clinicSnap.data(), ...(settingsSnap.exists() ? settingsSnap.data() : {}) } as Clinic;
    const dateStr = date.split('T')[0];
    const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', clinicId));
    const snap = await getDocs(q);
    const booked = snap.docs.filter(docSnap => {
        const dateVal = docSnap.data().date;
        const docDateStr = dateVal instanceof Timestamp ? dateVal.toDate().toISOString() : String(dateVal || '');
        return docDateStr.startsWith(dateStr);
    }).map(d => d.data().time);
    if (clinic.bookingMode === BookingMode.Token) {
        const total = (clinic.dailySlots || 15) + (clinic.waitlistSlots || 0);
        const tokens = Array.from({ length: total }, (_, i) => i + 1).filter(t => !booked.includes(`Ficha ${t}`));
        return { tokens };
    } else {
        const start = new Date(`1970-01-01T${clinic.startTime}:00`);
        const end = new Date(`1970-01-01T${clinic.endTime}:00`);
        const slots: string[] = [];
        let curr = start;
        while (curr < end) {
            const t = curr.toTimeString().substring(0, 5);
            if (t !== clinic.breakTime && !booked.includes(t)) slots.push(t);
            curr = new Date(curr.getTime() + (clinic.consultationDuration || 30) * 60000);
        }
        return { timeSlots: slots };
    }
}

// CLÍNICAS Y CONFIGURACIÓN BLINDADA
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
export async function updateColonias(cols: Colonia[]) { const batch = writeBatch(adminDb); cols.forEach(c => batch.set(doc(adminDb, 'colonias', c.id), c)); await batch.commit(); return { success: true }; }
export async function getServiceTypesData() { return getRawCollection('serviceTypes') as Promise<ServiceType[]>; }
export async function updateServiceTypes(types: ServiceType[]) { const batch = writeBatch(adminDb); types.forEach(t => batch.set(doc(adminDb, 'serviceTypes', t.id), t)); await batch.commit(); return { success: true }; }
export async function getSpecialtiesData() { return getRawCollection('specialties') as Promise<Specialty[]>; }
export async function updateSpecialties(s: Specialty[]) { const batch = writeBatch(adminDb); s.forEach(x => batch.set(doc(adminDb, 'specialties', x.id), x)); await batch.commit(); return { success: true }; }

// OTROS
export async function getAnnouncementsData() { const snap = await getDoc(doc(adminDb, 'settings', 'announcements')); return snap.exists() ? snap.data().messages : []; }
export async function updateAnnouncements(messages: string[]) { await setDoc(doc(adminDb, 'settings', 'announcements'), { messages }); return { success: true }; }
export async function getHolidaysData() { return getRawCollection('holidays') as Promise<Holiday[]>; }
export async function updateHolidays(h: Holiday[]) { const batch = writeBatch(adminDb); h.forEach(x => batch.set(doc(adminDb, 'holidays', x.date), x)); await batch.commit(); return { success: true }; }
export async function getSpecialActionDaysData() { return getRawCollection('specialActionDays') as Promise<SpecialActionDay[]>; }
export async function updateSpecialActionDays(items: SpecialActionDay[]) { const batch = writeBatch(adminDb); items.forEach(x => batch.set(doc(adminDb, 'specialActionDays', `${x.date}_${x.clinicType}`), x)); await batch.commit(); return { success: true }; }

export async function getLabSettings() { const snap = await getDoc(doc(adminDb, 'settings', 'labSettings')); return snap.exists() ? serializeData(snap.data()) as LabSettings : { dailySlots: 20, waitlistSlots: 0, weekendBookingEnabled: false, password: '123', startTime: '07:00', endTime: '10:00' }; }
export async function updateLabSettings(s: LabSettings) { await setDoc(doc(adminDb, 'settings', 'labSettings'), s); return { success: true }; }
export async function getXRaySettings() { const snap = await getDoc(doc(adminDb, 'settings', 'xraySettings')); return snap.exists() ? serializeData(snap.data()) as XRaySettings : { dailySlots: 10, waitlistSlots: 0, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false, password: '123' }; }
export async function updateXRaySettings(s: XRaySettings) { await setDoc(doc(adminDb, 'settings', 'xraySettings'), s); return { success: true }; }
export async function getUltrasoundSettings() { const snap = await getDoc(doc(adminDb, 'settings', 'ultrasoundSettings')); return snap.exists() ? serializeData(snap.data()) as UltrasoundSettings : { dailySlots: 10, waitlistSlots: 0, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false, password: '123' }; }
export async function updateUltrasoundSettings(s: UltrasoundSettings) { await setDoc(doc(adminDb, 'settings', 'ultrasoundSettings'), s); return { success: true }; }
export async function getVaccineSettings() { const snap = await getDoc(doc(adminDb, 'settings', 'vaccineSettings')); return snap.exists() ? serializeData(snap.data()) as VaccineSettings : { dailySlots: 30, waitlistSlots: 0, startTime: '08:00', endTime: '14:00', weekendBookingEnabled: false, password: '123' }; }
export async function updateVaccineSettings(s: VaccineSettings) { await setDoc(doc(adminDb, 'settings', 'vaccineSettings'), s); return { success: true }; }

export async function getLabStudies() { return getRawCollection('labStudies') as Promise<LabStudy[]>; }
export async function updateLabStudies(s: LabStudy[]) { const batch = writeBatch(adminDb); s.forEach(x => batch.set(doc(adminDb, 'labStudies', x.id), x)); await batch.commit(); return { success: true }; }
export async function getXRayStudies() { return getRawCollection('xrayStudies') as Promise<XRayStudy[]>; }
export async function updateXRayStudies(s: XRayStudy[]) { const batch = writeBatch(adminDb); s.forEach(x => batch.set(doc(adminDb, 'xrayStudies', x.id), x)); await batch.commit(); return { success: true }; }
export async function getUltrasoundStudies() { return getRawCollection('ultrasoundStudies') as Promise<UltrasoundStudy[]>; }
export async function updateUltrasoundStudies(s: UltrasoundStudy[]) { const batch = writeBatch(adminDb); s.forEach(x => batch.set(doc(adminDb, 'ultrasoundStudies', x.id), x)); await batch.commit(); return { success: true }; }
export async function getVaccines() { return getRawCollection('vaccines') as Promise<Vaccine[]>; }
export async function updateVaccines(v: Vaccine[]) { const batch = writeBatch(adminDb); v.forEach(x => batch.set(doc(adminDb, 'vaccines', x.id), x)); await batch.commit(); return { success: true }; }

export async function getMedications() { return getRawCollection('medications') as Promise<Medication[]>; }
export async function getSupplies() { return getRawCollection('supplies') as Promise<Supply[]>; }
export async function getLogsData() { return getRawCollection('activityLog', 500) as Promise<ActivityLog[]>; }

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

export async function bulkInsertPatients(pats: any[]) { const batch = writeBatch(adminDb); pats.forEach(p => { const id = uuidv4(); batch.set(doc(adminDb, 'patients', id), { ...p, id }); }); await batch.commit(); return { success: true, processedCount: pats.length }; }
export async function bulkInsertDoctors(docs: any[]) { const batch = writeBatch(adminDb); docs.forEach(d => { const id = uuidv4(); batch.set(doc(adminDb, 'clinics', id), { ...d, id }); }); await batch.commit(); return { success: true, processedCount: docs.length }; }
export async function scanDuplicates(criteria: string) { const pats = await getRawCollection('patients') as Patient[]; const groups = new Map<string, Patient[]>(); pats.forEach(p => { const k = (criteria === 'expediente' ? p.expediente : (criteria === 'curp' ? p.curp : `${p.name} ${p.paternalLastName}`)) || ''; if (!k) return; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(p); }); return Array.from(groups.values()).filter(g => g.length > 1); }
export async function applyStatusUpdateChunk(exps: string[], s: string) { const batch = writeBatch(adminDb); let count = 0; for (const exp of exps) { const q = query(collection(adminDb, 'patients'), where('expediente', '==', exp)); const snap = await getDocs(q); snap.docs.forEach(d => { batch.update(d.ref, { status: s }); count++; }); } await batch.commit(); return { success: true, count }; }
export async function normalizeExpedientesAction() { const pats = await getRawCollection('patients') as Patient[]; const batch = writeBatch(adminDb); let count = 0; pats.forEach(p => { if (p.expediente && !p.expediente.startsWith('0')) { batch.update(doc(adminDb, 'patients', p.id), { expediente: '0' + p.expediente }); count++; } }); await batch.commit(); return { success: true, count }; }
export async function downloadBackupAction() { 
    const [p, a, l, x, u, v, c] = await Promise.all([
        getRawCollection('patients'), getRawCollection('appointments'), getRawCollection('labAppointments'),
        getRawCollection('xrayAppointments'), getRawCollection('ultrasoundAppointments'), getRawCollection('vaccineAppointments'),
        getRawCollection('clinics')
    ]);
    return { success: true, data: { patients: p, appointments: a, labAppointments: l, xRayAppointments: x, ultrasoundAppointments: u, vaccineAppointments: v, clinics: c } };
}
export async function cleanupOldRecords() { const snap = await getDocs(collection(adminDb, 'appointments')); const batch = writeBatch(adminDb); snap.docs.forEach(d => batch.delete(d.ref)); await batch.commit(); return { success: true, deletedCount: snap.size }; }

export async function getConsultationsByPatientId(pid: string) { const q = query(collection(adminDb, 'medicalConsultations'), where('patientId', '==', pid), orderBy('date', 'desc'), limit(100)); const snap = await getDocs(q); return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id })) as MedicalConsultation[]; }
export async function saveMedicalConsultation(c: any) { const id = c.id || uuidv4(); await setDoc(doc(adminDb, 'medicalConsultations', id), { ...c, id }, { merge: true }); if (c.isFinal) await updateDoc(doc(adminDb, 'appointments', c.appointmentId), { status: 'Atendido' }); return { success: true, id }; }
export async function getConsultationByAppointmentId(aid: string) { const q = query(collection(adminDb, 'medicalConsultations'), where('appointmentId', '==', aid), limit(1)); const snap = await getDocs(q); return snap.empty ? null : { ...serializeData(snap.docs[0].data()), id: snap.docs[0].id } as MedicalConsultation; }
export async function getPrescriptionsByPatientId(pid: string) { const q = query(collection(adminDb, 'prescriptions'), where('patientId', '==', pid), orderBy('date', 'desc'), limit(50)); const snap = await getDocs(q); return snap.docs.map(d => ({ ...serializeData(d.data()), id: d.id })) as Prescription[]; }
export async function createPrescription(p: any) { const id = uuidv4(); const folio = `REC-${uuidv4().split('-')[0].toUpperCase()}`; const expAt = new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString(); const data = { ...p, id, folio, expiresAt: expAt, status: 'pendiente', createdAt: new Date().toISOString() }; await setDoc(doc(adminDb, 'prescriptions', id), data); return { success: true, folio, prescription: data }; }
export async function dispensePrescription(id: string, items: any[]) { const batch = writeBatch(adminDb); items.forEach(i => batch.update(doc(adminDb, 'medications', i.medicationId), { existencia: increment(-i.quantity) })); batch.update(doc(adminDb, 'prescriptions', id), { status: 'surtida', dispensedDate: new Date().toISOString() }); await batch.commit(); return { success: true }; }
export async function deletePrescription(id: string) { await deleteDoc(doc(adminDb, 'prescriptions', id)); return { success: true }; }
export async function getPendingPrescriptions(f: any) { const all = await getRawCollection('prescriptions', 500) as Prescription[]; let res = f?.status ? all.filter(r => r.status === f.status) : all; if (f?.folio) res = res.filter(r => r.folio.toUpperCase() === f.folio.toUpperCase()); if (f?.clinicId && f.clinicId !== 'all') res = res.filter(r => r.clinicId === f.clinicId); return res.sort((a, b) => b.date.localeCompare(a.date)); }
export async function getPatientPrescriptionsCountTodayAction(pid: string) { const start = startOfDay(new Date()).toISOString(); const q = query(collection(adminDb, 'prescriptions'), where('patientId', '==', pid), where('createdAt', '>=', start)); const snap = await getDocs(q); return snap.size; }
export async function getAttendedPatientsForClinic(cid: string) { const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', cid), where('status', '==', 'Atendido'), limit(300)); const snap = await getDocs(q); const pIds = Array.from(new Set(snap.docs.map(d => d.data().patientId))); if (pIds.length === 0) return []; const pats: Patient[] = []; for (let i = 0; i < pIds.length; i += 30) { const chunk = pIds.slice(i, i + 30); const pq = query(collection(adminDb, 'patients'), where('__name__', 'in', chunk)); const psnap = await getDocs(pq); pats.push(...psnap.docs.map(d => ({ ...serializeData(d.data()), id: d.id } as Patient))); } return pats; }
export async function deleteMedicalConsultation(id: string) { await deleteDoc(doc(adminDb, 'medicalConsultations', id)); return { success: true }; }
export async function updatePrescription(id: string, p: any) { await updateDoc(doc(adminDb, 'prescriptions', id), p); return { success: true }; }

export async function bulkInsertMedications(p: any[]) { 
    const batch = writeBatch(adminDb); 
    p.forEach(item => {
        const id = uuidv4();
        const mapped = fuzzyMapInsumo(item);
        batch.set(doc(adminDb, 'medications', id), { ...mapped, id, updatedAt: new Date().toISOString() });
    });
    await batch.commit(); 
    return { success: true, processedCount: p.length }; 
}
export async function bulkInsertSupplies(p: any[]) { 
    const batch = writeBatch(adminDb); 
    p.forEach(item => {
        const id = uuidv4();
        const mapped = fuzzyMapInsumo(item);
        batch.set(doc(adminDb, 'supplies', id), { ...mapped, id, updatedAt: new Date().toISOString() });
    });
    await batch.commit(); 
    return { success: true, processedCount: p.length }; 
}
export async function deleteAllMedications() { 
    const snap = await getDocs(collection(adminDb, 'medications'));
    const batch = writeBatch(adminDb);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return { success: true };
}
export async function deleteAllSupplies() { 
    const snap = await getDocs(collection(adminDb, 'supplies'));
    const batch = writeBatch(adminDb);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return { success: true };
}

function startOfDay(d: Date) { const res = new Date(d); res.setHours(0,0,0,0); return res; }
