'use server';

import { promises as fs, readFileSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Clinic, Colonia, Appointment, Patient, LabAppointment, LabStudy, LabSettings, XRayAppointment, XRayStudy, XRaySettings, UltrasoundAppointment, UltrasoundStudy, UltrasoundSettings, VaccineAppointment, Vaccine, VaccineSettings, ModuleSettings, User, ActivityLog, AppointmentStatus } from './definitions';
import { fileURLToPath } from 'url';
import { format, isSaturday, isSunday, startOfMonth } from 'date-fns';

// Since we're in a server component, we need to resolve paths differently.
const dataPath = path.join(process.cwd(), 'src', 'lib', 'data');

const paths = {
  clinics: path.join(dataPath, 'clinics.json'),
  colonias: path.join(dataPath, 'colonias.json'),
  announcements: path.join(dataPath, 'announcements.json'),
  appointments: path.join(dataPath, 'appointments.json'),
  patients: path.join(dataPath, 'patients.json'),
  labAppointments: path.join(dataPath, 'lab-appointments.json'),
  labStudies: path.join(dataPath, 'lab-studies.json'),
  labSettings: path.join(dataPath, 'lab-settings.json'),
  xrayAppointments: path.join(dataPath, 'x-ray-appointments.json'),
  xrayStudies: path.join(dataPath, 'x-ray-studies.json'),
  xraySettings: path.join(dataPath, 'x-ray-settings.json'),
  ultrasoundAppointments: path.join(dataPath, 'ultrasound-appointments.json'),
  ultrasoundStudies: path.join(dataPath, 'ultrasound-studies.json'),
  ultrasoundSettings: path.join(dataPath, 'ultrasound-settings.json'),
  vaccineAppointments: path.join(dataPath, 'vaccine-appointments.json'),
  vaccines: path.join(dataPath, 'vaccines.json'),
  vaccineSettings: path.join(dataPath, 'vaccine-settings.json'),
  moduleSettings: path.join(dataPath, 'module-settings.json'),
  users: path.join(dataPath, 'users.json'),
  activityLog: path.join(dataPath, 'activity-log.json'),
  transactionLog: path.join(dataPath, 'transaction_log.jsonl'),
  lockFile: path.join(process.cwd(), '.data.lock'),
};

type DataType = keyof typeof paths;

// --- Transaction Log and Locking Mechanism ---

let isLocking = false;
const lockQueue: (() => void)[] = [];

async function acquireLock(): Promise<void> {
    return new Promise(resolve => {
        if (!isLocking) {
            isLocking = true;
            resolve();
        } else {
            lockQueue.push(resolve);
        }
    });
}

function releaseLock(): void {
    const next = lockQueue.shift();
    if (next) {
        next();
    } else {
        isLocking = false;
    }
}

async function withFileLock<T>(fn: () => Promise<T>): Promise<T> {
    await acquireLock();
    try {
        return await fn();
    } finally {
        releaseLock();
    }
}

async function logTransaction(type: 'CREATE' | 'UPDATE' | 'DELETE' | 'BATCH_UPDATE', entity: string, data: any) {
    const logEntry = {
        type,
        entity,
        timestamp: new Date().toISOString(),
        data
    };
    await fs.appendFile(paths.transactionLog, JSON.stringify(logEntry) + '\n');
}

// --- Generic Data Access Functions ---

function readData<T>(type: DataType): T {
    try {
        const rawData = readFileSync(paths[type], 'utf-8');
        return JSON.parse(rawData);
    } catch (error) {
        // Handle cases where the file might not exist, especially for new data types
        if (type === 'announcements') return { messages: [] } as T;
        if (type.includes('Appointments') || type === 'patients' || type === 'clinics' || type === 'colonias') return [] as T;
        // Default empty object for settings that might not exist yet
        if (type.includes('Settings')) return {} as T;
        return [] as T;
    }
}

async function writeData<T>(type: DataType, data: T): Promise<void> {
    return await fs.writeFile(paths[type], JSON.stringify(data, null, 2), 'utf-8');
}


// --- Specific Data Functions ---

// Settings
export async function getAnnouncements(): Promise<string[]> { return readData<{ messages: string[] }>('announcements').messages || []; }
export async function updateAnnouncements(newAnnouncements: string[]) {
    return withFileLock(async () => {
        const data = { messages: newAnnouncements.slice(0, 4) }; // Max 4
        await logTransaction('UPDATE', 'announcements', data);
        await writeData('announcements', data);
        return { success: true };
    });
}
export async function getModuleSettings(): Promise<ModuleSettings> { return readData<ModuleSettings>('moduleSettings'); }
export async function updateModuleSettings(settings: ModuleSettings) { 
    return withFileLock(async () => {
        await logTransaction('UPDATE', 'moduleSettings', settings);
        await writeData('moduleSettings', settings);
        return { success: true };
    });
}
export async function getLabSettings(): Promise<LabSettings> { return readData<LabSettings>('labSettings'); }
export async function updateLabSettings(settings: LabSettings) {
    return withFileLock(async () => {
        await logTransaction('UPDATE', 'labSettings', settings);
        await writeData('labSettings', settings);
        return { success: true };
    });
}
export async function getXRaySettings(): Promise<XRaySettings> { return readData<XRaySettings>('xraySettings'); }
export async function updateXRaySettings(settings: XRaySettings) {
    return withFileLock(async () => {
        await logTransaction('UPDATE', 'xraySettings', settings);
        await writeData('xraySettings', settings);
        return { success: true };
    });
}
export async function getUltrasoundSettings(): Promise<UltrasoundSettings> { return readData<UltrasoundSettings>('ultrasoundSettings'); }
export async function updateUltrasoundSettings(settings: UltrasoundSettings) {
    return withFileLock(async () => {
        await logTransaction('UPDATE', 'ultrasoundSettings', settings);
        await writeData('ultrasoundSettings', settings);
        return { success: true };
    });
}
export async function getVaccineSettings(): Promise<VaccineSettings> { return readData<VaccineSettings>('vaccineSettings'); }
export async function updateVaccineSettings(settings: VaccineSettings) {
    return withFileLock(async () => {
        await logTransaction('UPDATE', 'vaccineSettings', settings);
        await writeData('vaccineSettings', settings);
        return { success: true };
    });
}

// Collections
export async function getClinics(): Promise<Clinic[]> { return readData<Clinic[]>('clinics'); }
export async function updateClinics(clinics: Clinic[]) {
    return withFileLock(async () => {
        await logTransaction('BATCH_UPDATE', 'clinics', clinics);
        await writeData('clinics', clinics);
        return { success: true };
    });
}

export async function getColonias(): Promise<Colonia[]> { return readData<Colonia[]>('colonias'); }
export async function updateColonias(colonias: Colonia[]) {
    return withFileLock(async () => {
        await logTransaction('BATCH_UPDATE', 'colonias', colonias);
        await writeData('colonias', colonias);
        return { success: true };
    });
}

export async function getLabStudies(): Promise<LabStudy[]> { return readData<LabStudy[]>('labStudies'); }
export async function updateLabStudies(studies: LabStudy[]) {
    return withFileLock(async () => {
        await logTransaction('BATCH_UPDATE', 'labStudies', studies);
        await writeData('labStudies', studies);
        return { success: true };
    });
}

export async function getXRayStudies(): Promise<XRayStudy[]> { return readData<XRayStudy[]>('xrayStudies'); }
export async function updateXRayStudies(studies: XRayStudy[]) {
    return withFileLock(async () => {
        await logTransaction('BATCH_UPDATE', 'xrayStudies', studies);
        await writeData('xrayStudies', studies);
        return { success: true };
    });
}

export async function getUltrasoundStudies(): Promise<UltrasoundStudy[]> { return readData<UltrasoundStudy[]>('ultrasoundStudies'); }
export async function updateUltrasoundStudies(studies: UltrasoundStudy[]) {
    return withFileLock(async () => {
        await logTransaction('BATCH_UPDATE', 'ultrasoundStudies', studies);
        await writeData('ultrasoundStudies', studies);
        return { success: true };
    });
}

export async function getVaccines(): Promise<Vaccine[]> { return readData<Vaccine[]>('vaccines'); }
export async function updateVaccines(vaccines: Vaccine[]) {
    return withFileLock(async () => {
        await logTransaction('BATCH_UPDATE', 'vaccines', vaccines);
        await writeData('vaccines', vaccines);
        return { success: true };
    });
}

export async function getUsers(): Promise<User[]> { return readData<User[]>('users'); }
export async function updateUsers(users: User[]) {
     return withFileLock(async () => {
        await logTransaction('BATCH_UPDATE', 'users', users);
        await writeData('users', users);
        return { success: true };
    });
}

export async function getLogs(): Promise<ActivityLog[]> {
    const logs = readData<ActivityLog[]>('activityLog');
    // Sort by timestamp descending
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 500);
}

// Passwords
export async function verifyClinicPassword(clinicId: string, passwordAttempt: string): Promise<{ isValid: boolean; error?: string }> { 
    const clinics = await getClinics(); 
    const clinic = clinics.find(c => c.id === clinicId); 
    if (!clinic) return { isValid: false, error: 'La clínica seleccionada no existe.' }; 
    return { isValid: clinic.password === passwordAttempt, error: clinic.password !== passwordAttempt ? 'La contraseña es incorrecta.' : undefined }; 
}
export async function verifyLabPassword(passwordAttempt: string): Promise<{ isValid: boolean; error?: string }> { const settings = await getLabSettings(); return { isValid: settings.password === passwordAttempt, error: settings.password !== passwordAttempt ? 'Contraseña incorrecta.' : undefined }; }
export async function verifyXRayPassword(passwordAttempt: string): Promise<{ isValid: boolean; error?: string }> { const settings = await getXRaySettings(); return { isValid: settings.password === passwordAttempt, error: settings.password !== passwordAttempt ? 'Contraseña incorrecta.' : undefined }; }
export async function verifyUltrasoundPassword(passwordAttempt: string): Promise<{ isValid: boolean; error?: string }> { const settings = await getUltrasoundSettings(); return { isValid: settings.password === passwordAttempt, error: settings.password !== passwordAttempt ? 'Contraseña incorrecta.' : undefined }; }
export async function verifyVaccinePassword(passwordAttempt: string): Promise<{ isValid: boolean; error?: string }> { const settings = await getVaccineSettings(); return { isValid: settings.password === passwordAttempt, error: settings.password !== passwordAttempt ? 'Contraseña incorrecta.' : undefined }; }


// --- Patient & Appointment Data ---
async function getFullAppointments<T extends { patientId: string }>(appointmentType: DataType): Promise<Array<T & { patient: Patient | undefined }>> {
    const appointments = readData<T[]>(appointmentType);
    const patients = readData<Patient[]>('patients');
    const patientMap = new Map(patients.map(p => [p.id, p]));
    return appointments.map(app => ({
        ...app,
        patient: patientMap.get(app.patientId)
    }));
}
export async function getAppointments(): Promise<(Appointment & { patient: Patient | undefined })[]> { return getFullAppointments<Appointment>('appointments'); }
export async function getLabAppointments(): Promise<(LabAppointment & { patient: Patient | undefined })[]> { return getFullAppointments<LabAppointment>('labAppointments'); }
export async function getXRayAppointments(): Promise<(XRayAppointment & { patient: Patient | undefined })[]> { return getFullAppointments<XRayAppointment>('xrayAppointments'); }
export async function getUltrasoundAppointments(): Promise<(UltrasoundAppointment & { patient: Patient | undefined })[]> { return getFullAppointments<UltrasoundAppointment>('ultrasoundAppointments'); }
export async function getVaccineAppointments(): Promise<(VaccineAppointment & { patient: Patient | undefined })[]> { return getFullAppointments<VaccineAppointment>('vaccineAppointments'); }


export async function getPatientByCURP(curp: string): Promise<Patient | null> {
    const patients = readData<Patient[]>('patients');
    return patients.find(p => p.curp.toUpperCase() === curp.toUpperCase()) || null;
}

export async function getPatientById(id: string): Promise<Patient | null> {
    const patients = readData<Patient[]>('patients');
    return patients.find(p => p.id === id) || null;
}

export async function getAppointmentById(id: string, type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine'): Promise<any | null> {
    const collectionName = type === 'medical' ? 'appointments' : `${type.toLowerCase()}-appointments`;
    const appointments = readData<any[]>(collectionName as DataType);
    const appointment = appointments.find(app => app.id === id);
    if (!appointment) return null;
    const patient = await getPatientById(appointment.patientId);
    return { ...appointment, patient };
}


export async function getAppointmentsForClinic(clinicId: string): Promise<(Appointment & { patient: Patient | undefined })[]> {
    const appointments = await getAppointments();
    return appointments.filter(a => a.clinicId === clinicId);
}

async function getAppointmentsByDateGeneric<T extends { date: string }>(appointmentType: DataType, date: Date): Promise<Array<T & { patient: Patient | undefined }>> {
    const allAppointments = await getFullAppointments<T>(appointmentType);
    const targetDate = format(date, 'yyyy-MM-dd');
    return allAppointments.filter(app => format(new Date(app.date), 'yyyy-MM-dd') === targetDate);
}
export const getAppointmentsByDate = async (date: Date) => getAppointmentsByDateGeneric<Appointment>('appointments', date);
export const getLabAppointmentsByDate = async (date: Date) => getAppointmentsByDateGeneric<LabAppointment>('labAppointments', date);
export const getXRayAppointmentsByDate = async (date: Date) => getAppointmentsByDateGeneric<XRayAppointment>('xrayAppointments', date);
export const getUltrasoundAppointmentsByDate = async (date: Date) => getAppointmentsByDateGeneric<UltrasoundAppointment>('ultrasoundAppointments', date);
export const getVaccineAppointmentsByDate = async (date: Date) => getAppointmentsByDateGeneric<VaccineAppointment>('vaccineAppointments', date);

async function logActivity(action: string, details: string) {
    return withFileLock(async () => {
        const logs = await getLogs();
        const newLog = { id: uuidv4(), timestamp: new Date().toISOString(), action, details };
        logs.unshift(newLog); // Add to the beginning
        await writeData('activityLog', logs.slice(0, 500)); // Keep only the latest 500
    });
}

// --- Data Mutation Functions (with locking) ---

async function saveAppointmentBase<T extends { patientId?: string, date: string }>(
    appointmentType: DataType,
    appointmentData: T,
    patientData: Omit<Patient, 'id'>,
    logAction: string,
    validationFn: (allApps: any[], clinic?: Clinic) => Promise<void> = async () => {}
): Promise<T & { patient: Patient }> {
    return withFileLock(async () => {
        const allAppointments = readData<any[]>(appointmentType);
        const patients = readData<Patient[]>('patients');
        
        let clinic: Clinic | undefined;
        if ((appointmentData as Appointment).clinicId) {
            const clinics = await getClinics();
            clinic = clinics.find(c => c.id === (appointmentData as Appointment).clinicId);
            if (!clinic) throw new Error("La clínica seleccionada no es válida.");
        }

        await validationFn(allAppointments, clinic);

        let existingPatient = patients.find(p => p.curp.toUpperCase() === patientData.curp.toUpperCase());
        let patientId: string;

        if (existingPatient) {
            // Update existing patient
            Object.assign(existingPatient, patientData);
            patientId = existingPatient.id;
        } else {
            // Create new patient
            patientId = uuidv4();
            existingPatient = { id: patientId, ...patientData };
            patients.push(existingPatient);
        }

        const newAppointment = { ...appointmentData, id: uuidv4(), patientId, status: 'Agendada' };
        allAppointments.push(newAppointment);

        await logTransaction('CREATE', appointmentType, { appointment: newAppointment, patient: existingPatient });
        
        await writeData('patients', patients);
        await writeData(appointmentType, allAppointments);
        await logActivity(logAction, `Folio ${newAppointment.appointmentNumber} para ${existingPatient.name}.`);

        return { ...newAppointment, patient: existingPatient };
    });
}

export async function saveAppointment(appointmentData: Omit<Appointment, 'id' | 'patientId' | 'patient' | 'status'>, patientData: Omit<Patient, 'id'>): Promise<Appointment> {
    const validationFn = async (allApps: Appointment[], clinic?: Clinic) => {
        if (!clinic) throw new Error("Clínica no proporcionada para validación.");
        
        const date = new Date(appointmentData.date);
        const dateString = appointmentData.date.split('T')[0];
        
        const isWeekend = isSaturday(date) || isSunday(date);
        const dayOfWeek = date.getDay();
        const dayOfWeekMap: { [key: string]: number } = { "Domingo": 0, "Lunes": 1, "Martes": 2, "Miércoles": 3, "Jueves": 4, "Viernes": 5, "Sábado": 6 };
        
        if (clinic.dayOfAction && dayOfWeekMap[clinic.dayOfAction] === dayOfWeek) {
             throw new Error(`No se pueden agendar citas los ${clinic.dayOfAction} en este núcleo.`);
        }
        if(clinic.unavailableDates?.includes(dateString)) {
             throw new Error("El núcleo no tiene citas disponibles en la fecha seleccionada por vacaciones.");
        }
        if (isWeekend && !clinic.weekendBookingEnabled) {
            throw new Error("Este núcleo no permite citas en fin de semana.");
        }
        
        const appointmentsOnDate = allApps.filter(app => app.clinicId === clinic.id && app.date.startsWith(dateString));
        if (appointmentsOnDate.length >= clinic.dailySlots) {
            throw new Error("No hay más cupos disponibles en este núcleo para la fecha seleccionada.");
        }
        if (appointmentsOnDate.some(app => app.time === appointmentData.time)) {
            throw new Error(`El horario de ${appointmentData.time} ya no está disponible.`);
        }
        const existingPatient = await getPatientByCURP(patientData.curp);
        if(allApps.some(app => app.patientId === existingPatient?.id && app.date.startsWith(dateString))) {
            throw new Error('Ya existe una cita agendada con esta CURP para el día seleccionado.');
        }
    };
    return saveAppointmentBase('appointments', appointmentData, patientData, 'Creación Cita Médica', validationFn);
}
export async function saveLabAppointment(appointmentData: any, patientData: any, settings: { dailySlots: number, weekendBookingEnabled: boolean }): Promise<any> { return saveAppointmentBase('labAppointments', appointmentData, patientData, 'Creación Cita Laboratorio'); }
export async function saveXRayAppointment(appointmentData: any, patientData: any): Promise<any> { return saveAppointmentBase('xrayAppointments', appointmentData, patientData, 'Creación Cita Rayos X'); }
export async function saveUltrasoundAppointment(appointmentData: any, patientData: any): Promise<any> { return saveAppointmentBase('ultrasoundAppointments', appointmentData, patientData, 'Creación Cita Ultrasonido'); }
export async function saveVaccineAppointment(appointmentData: any, patientData: any): Promise<any> { return saveAppointmentBase('vaccineAppointments', appointmentData, patientData, 'Creación Cita Vacunación'); }


async function deleteAppointmentBase(appointmentType: DataType, id: string, logAction: string) {
    return withFileLock(async () => {
        let allAppointments = readData<any[]>(appointmentType);
        const appointmentToDelete = allAppointments.find(app => app.id === id);
        if (!appointmentToDelete) return; // Already deleted
        
        const filteredAppointments = allAppointments.filter(app => app.id !== id);
        
        await logTransaction('DELETE', appointmentType, appointmentToDelete);
        await writeData(appointmentType, filteredAppointments);
        await logActivity(logAction, `Se eliminó el folio: ${appointmentToDelete.appointmentNumber}.`);
    });
}
export async function deleteAppointment(id: string) { await deleteAppointmentBase('appointments', id, 'Eliminación Cita Médica'); }
export async function deleteLabAppointment(id: string) { await deleteAppointmentBase('labAppointments', id, 'Eliminación Cita Laboratorio'); }
export async function deleteXRayAppointment(id: string) { await deleteAppointmentBase('xrayAppointments', id, 'Eliminación Cita Rayos X'); }
export async function deleteUltrasoundAppointment(id: string) { await deleteAppointmentBase('ultrasoundAppointments', id, 'Eliminación Cita Ultrasonido'); }
export async function deleteVaccineAppointment(id: string) { await deleteAppointmentBase('vaccineAppointments', id, 'Eliminación Cita Vacunación'); }

export async function updatePatient(patientId: string, patientData: Partial<Omit<Patient, 'id'>>) {
    return withFileLock(async () => {
        const patients = readData<Patient[]>('patients');
        const patientIndex = patients.findIndex(p => p.id === patientId);
        if (patientIndex === -1) {
            return { success: false, message: 'Patient not found.' };
        }
        const updatedPatient = { ...patients[patientIndex], ...patientData };
        patients[patientIndex] = updatedPatient;
        
        await logTransaction('UPDATE', 'patients', updatedPatient);
        await writeData('patients', patients);
        await logActivity('Actualización de Paciente', `Datos del paciente con ID ${patientId} actualizados.`);
        return { success: true };
    });
}

export async function updateAppointmentStatus(appointmentId: string, status: AppointmentStatus, type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine'): Promise<{ success: boolean; message?: string }> {
    const collectionName = type === 'medical' ? 'appointments' : `${type.toLowerCase()}-appointments`;
    return withFileLock(async () => {
        const appointments = readData<any[]>(collectionName as DataType);
        const appIndex = appointments.findIndex(a => a.id === appointmentId);
        if (appIndex === -1) return { success: false, message: 'Cita no encontrada.' };

        appointments[appIndex].status = status;

        await logTransaction('UPDATE', collectionName, appointments[appIndex]);
        await writeData(collectionName as DataType, appointments);
        await logActivity('Actualización de Estado', `Cita ${appointments[appIndex].appointmentNumber} (${type}) actualizada a: ${status}.`);
        return { success: true };
    });
}

export async function rescheduleAppointment(appointmentId: string, newDate: string, type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine'): Promise<{ success: boolean; message: string; newTime?: string }> {
    const collectionName = type === 'medical' ? 'appointments' : `${type.toLowerCase()}-appointments`;
     return withFileLock(async () => {
        const appointments = readData<any[]>(collectionName as DataType);
        const appIndex = appointments.findIndex(a => a.id === appointmentId);
        if (appIndex === -1) return { success: false, message: 'Cita no encontrada.' };

        appointments[appIndex].date = newDate;
        appointments[appIndex].status = 'Agendada';

        await logTransaction('UPDATE', collectionName, appointments[appIndex]);
        await writeData(collectionName as DataType, appointments);
        await logActivity('Cambio de Fecha Cita', `Cita ${appointments[appIndex].appointmentNumber} (${type}) movida a ${newDate}.`);
        return { success: true, message: 'Fecha de la cita actualizada.' };
    });
}

export async function cloneAppointment(originalAppointmentId: string, newDate: string, type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine'): Promise<{ success: boolean; message: string; data?: any }> {
    return withFileLock(async () => {
        const originalAppointment = await getAppointmentById(originalAppointmentId, type);
        if (!originalAppointment) throw new Error('Cita original no encontrada.');

        const { id, patientId, patient, status, date, appointmentNumber, ...payload } = originalAppointment;
        if (!patient) throw new Error('Paciente no encontrado en la cita original.');
        
        const newAppointmentData = { ...payload, date: newDate, appointmentNumber: `${type.substring(0,3).toUpperCase()}-${uuidv4().split('-')[0]}` };
        let result: any;
        
        if (type === 'medical') {
            result = await saveAppointment(newAppointmentData, patient);
        } else if (type === 'lab') {
            const labSettings = await getLabSettings();
            result = await saveLabAppointment(newAppointmentData, patient, labSettings);
        } else if (type === 'xray') {
            result = await saveXRayAppointment(newAppointmentData, patient);
        } else if (type === 'ultrasound') {
            result = await saveUltrasoundAppointment(newAppointmentData, patient);
        } else if (type === 'vaccine') {
            result = await saveVaccineAppointment(newAppointmentData, patient);
        } else {
            throw new Error('Tipo de cita no válido.');
        }

        await logActivity('Clonación de Cita', `Folio original ${appointmentNumber} clonado a nuevo folio ${result.appointmentNumber}.`);
        return { success: true, message: `Nueva cita asignada con folio ${result.appointmentNumber}`, data: result };
    });
}


// --- Backup & Restore ---
export async function createBackupData() {
    const data = {
        appointments: await getAppointments(),
        labAppointments: await getLabAppointments(),
        xRayAppointments: await getXRayAppointments(),
        ultrasoundAppointments: await getUltrasoundAppointments(),
        vaccineAppointments: await getVaccineAppointments(),
        patients: readData<Patient[]>('patients'),
        clinics: await getClinics(),
    };
    return data;
}
  
export async function restoreBackupData(backup: any) {
    return withFileLock(async () => {
        const stats = { newAppointments: 0, newLabAppointments: 0, newXRayAppointments: 0, newUltrasoundAppointments: 0, newVaccineAppointments: 0, newPatients: 0 };

        const allAppointments = readData<Appointment[]>('appointments');
        const allLabAppointments = readData<LabAppointment[]>('labAppointments');
        const allXRayAppointments = readData<XRayAppointment[]>('xrayAppointments');
        const allUltrasoundAppointments = readData<UltrasoundAppointment[]>('ultrasoundAppointments');
        const allVaccineAppointments = readData<VaccineAppointment[]>('vaccineAppointments');
        const allPatients = readData<Patient[]>('patients');

        const existingPatientCURPs = new Set(allPatients.map(p => p.curp));
        if (backup.patients) {
            for (const patient of backup.patients) {
                if (!existingPatientCURPs.has(patient.curp)) {
                    allPatients.push(patient);
                    stats.newPatients++;
                }
            }
        }

        const restoreApps = (backupApps: any[], existingApps: any[], type: keyof typeof stats) => {
            if (!backupApps) return;
            const existingAppNumbers = new Set(existingApps.map(a => a.appointmentNumber));
            for (const app of backupApps) {
                if (!existingAppNumbers.has(app.appointmentNumber)) {
                    existingApps.push(app);
                    (stats as any)[type]++;
                }
            }
        };

        restoreApps(backup.appointments, allAppointments, 'newAppointments');
        restoreApps(backup.labAppointments, allLabAppointments, 'newLabAppointments');
        restoreApps(backup.xRayAppointments, allXRayAppointments, 'newXRayAppointments');
        restoreApps(backup.ultrasoundAppointments, allUltrasoundAppointments, 'newUltrasoundAppointments');
        restoreApps(backup.vaccineAppointments, allVaccineAppointments, 'newVaccineAppointments');

        await logTransaction('BATCH_UPDATE', 'restore', backup);

        await writeData('patients', allPatients);
        await writeData('appointments', allAppointments);
        await writeData('labAppointments', allLabAppointments);
        await writeData('xRayAppointments', allXRayAppointments);
        await writeData('ultrasoundAppointments', allUltrasoundAppointments);
        await writeData('vaccineAppointments', allVaccineAppointments);
        
        const total = Object.values(stats).reduce((sum, count) => sum + count, 0);
        await logActivity('Restauración de Respaldo', `Se restauraron un total de ${total} registros.`);

        return { success: true, stats };
    });
}

export async function cleanupOldAppointments() {
    return withFileLock(async () => {
        const today = new Date();
        const firstDayOfCurrentMonth = startOfMonth(today);
        let totalDeleted = 0;

        const cleanup = async (type: DataType) => {
            const data = readData<any[]>(type);
            const newData = data.filter(item => new Date(item.date) >= firstDayOfCurrentMonth);
            const deletedCount = data.length - newData.length;
            if (deletedCount > 0) {
                await writeData(type, newData);
                totalDeleted += deletedCount;
            }
        };

        await cleanup('appointments');
        await cleanup('labAppointments');
        await cleanup('xrayAppointments');
        await cleanup('ultrasoundAppointments');
        await cleanup('vaccineAppointments');

        if (totalDeleted > 0) {
            await logActivity('Limpieza de Registros', `Se eliminaron ${totalDeleted} citas antiguas de meses anteriores.`);
        }
        
        return { deletedCount: totalDeleted };
    });
}
