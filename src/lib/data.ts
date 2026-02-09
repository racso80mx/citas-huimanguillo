'use server';

import fs from 'fs/promises';
import path from 'path';
import type { Clinic, Colonia, LabSettings, LabStudy, XRaySettings, XRayStudy, UltrasoundSettings, UltrasoundStudy, Appointment, Patient, LabAppointment, XRayAppointment, UltrasoundAppointment, ModuleSettings, Vaccine, VaccineSettings, VaccineAppointment, AppointmentStatus, User, ActivityLog } from './definitions';
import { v4 as uuidv4 } from 'uuid';
import { revalidatePath } from 'next/cache';

// --- START: LOCKING MECHANISM ---
// This mechanism prevents race conditions when multiple operations try to write to the same file at once.
// It ensures that data is read and written atomically, preventing data loss.

const LOCK_DIR = path.join(process.cwd(), 'src', 'lib', 'data', '.locks');
const RETRY_DELAY = 100; // Time to wait before retrying to get a lock
const MAX_RETRIES = 20;   // Number of retries before failing

// Helper to create the lock directory on startup.
const initializeLockDirectory = async () => {
  try {
    await fs.mkdir(LOCK_DIR, { recursive: true });
  } catch (error) {
    console.error('CRITICAL: Could not create lock directory.', error);
  }
};
initializeLockDirectory();

/**
 * Acquires a file lock. It will retry several times if the lock is already held.
 * @param filename The name of the file to lock (e.g., 'patients.json')
 */
async function acquireLock(filename: string, retries = MAX_RETRIES): Promise<void> {
    const lockFile = path.join(LOCK_DIR, `${filename}.lock`);
    try {
        // 'wx' flag is atomic: it creates and writes the file, but fails if it already exists.
        await fs.writeFile(lockFile, process.pid.toString(), { flag: 'wx' });
    } catch (error: any) {
        if (error.code === 'EEXIST' && retries > 0) {
            // If lock exists, wait and retry.
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return acquireLock(filename, retries - 1);
        }
        // If out of retries or another error, throw.
        throw new Error(`Could not acquire lock for ${filename} after ${MAX_RETRIES} attempts. The system might be busy.`);
    }
}

/**
 * Releases a file lock.
 * @param filename The name of the file lock to release.
 */
async function releaseLock(filename: string): Promise<void> {
    const lockFile = path.join(LOCK_DIR, `${filename}.lock`);
    try {
        await fs.unlink(lockFile);
    } catch (error: any) {
        // It's not a critical error if the lock file doesn't exist.
        if (error.code !== 'ENOENT') {
            console.error(`[Locking Error] Could not release lock for ${filename}. This may require manual intervention.`, error);
        }
    }
}
// --- END: LOCKING MECHANISM ---


const dataFilePath = (filename: string) => path.join(process.cwd(), 'src', 'lib', 'data', filename);

async function readJsonFile<T>(filename: string, defaultValue: T): Promise<T> {
  try {
    const filePath = dataFilePath(filename);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // If file doesn't exist, create it with the default value.
      // This is a write operation, so it should be locked to be safe.
      const lockFilename = path.basename(filename);
      await acquireLock(lockFilename);
      try {
        await fs.writeFile(dataFilePath(filename), JSON.stringify(defaultValue, null, 2), 'utf-8');
        return defaultValue;
      } finally {
        await releaseLock(lockFilename);
      }
    }
    console.error(`Failed to read static file ${filename}`, error);
    return defaultValue;
  }
}

// Unsafe write function for internal use within a lock.
async function unsafeWriteJsonFile(filename: string, data: any): Promise<void> {
    await fs.writeFile(dataFilePath(filename), JSON.stringify(data, null, 2), 'utf-8');
}


// ========== Activity Log ==========
const LOG_LIMIT = 500;
export async function logActivity(action: string, details: string): Promise<void> {
    // Logging is special: it's fire-and-forget and should not be locked
    // to avoid circular dependencies if a locked operation fails and tries to log.
    try {
        const logs = await readJsonFile<ActivityLog[]>('activity-log.json', []);
        const newLog: ActivityLog = {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            action,
            details,
        };
        const updatedLogs = [newLog, ...logs].slice(0, LOG_LIMIT);
        // Use a direct, non-locking write for the log file.
        await unsafeWriteJsonFile('activity-log.json', updatedLogs);
    } catch (error) {
        console.error('Failed to log activity:', error);
    }
}

// Helper for simple updates on a single file where the whole file is replaced
async function handleSimpleUpdate<T>(filename: string, data: T): Promise<{ success: boolean; message?: string }> {
    await acquireLock(filename);
    try {
        await unsafeWriteJsonFile(filename, data);
        return { success: true };
    } catch (e: any) {
        console.error(`Failed to write to static file ${filename}`, e);
        return { success: false, message: `Failed to write to static file ${filename}: ${e.message}` };
    } finally {
        await releaseLock(filename);
    }
}


// ========== Users ==========
export async function getUsers(): Promise<User[]> {
    return await readJsonFile<User[]>('users.json', []);
}

export async function updateUsers(users: User[]): Promise<{ success: boolean; message?: string }> {
    return handleSimpleUpdate('users.json', users);
}

// ========== Announcements ==========
export const getAnnouncements = async (): Promise<string[]> => {
  const data = await readJsonFile<{ messages: string[] }>('announcements.json', { messages: [] });
  return data.messages;
};

export const updateAnnouncements = async (newAnnouncements: string[]): Promise<{ success: boolean; message?: string }> => {
  const data = { messages: newAnnouncements.slice(0, 4) };
  const res = await handleSimpleUpdate('announcements.json', data);
   if (res.success) {
    revalidatePath('/citas-medicas');
    revalidatePath('/laboratorio');
    revalidatePath('/rayos-x');
    revalidatePath('/ultrasonidos');
    revalidatePath('/vacunas');
    revalidatePath('/admin');
    revalidatePath('/reports');
  }
  return res;
};

// ========== Clinics Configuration ==========
export async function getClinics(): Promise<Clinic[]> {
  return await readJsonFile<Clinic[]>('clinics.json', []);
}

export async function updateClinics(clinics: Clinic[]): Promise<{ success: boolean; message?: string }> {
  const res = await handleSimpleUpdate('clinics.json', clinics);
  if (res.success) {
    revalidatePath('/citas-medicas');
    revalidatePath('/admin');
    revalidatePath('/reports');
  }
  return res;
}

// ========== Colonias Configuration ==========
export async function getColonias(): Promise<Colonia[]> {
  return await readJsonFile<Colonia[]>('colonias.json', []);
}

export async function updateColonias(colonias: Colonia[]): Promise<{ success: boolean; message?: string }> {
    const res = await handleSimpleUpdate('colonias.json', colonias);
    if (res.success) {
      revalidatePath('/citas-medicas');
      revalidatePath('/admin');
      revalidatePath('/reports');
    }
    return res;
}

// ========== Lab Settings & Studies ==========
export async function getLabSettings(): Promise<LabSettings> {
    return await readJsonFile<LabSettings>('lab-settings.json', {
        dailySlots: 20,
        weekendBookingEnabled: false,
        password: "lab"
    });
}

export async function updateLabSettings(settings: LabSettings): Promise<{ success: boolean; message?: string }> {
    const res = await handleSimpleUpdate('lab-settings.json', settings);
    if (res.success) {
      revalidatePath('/laboratorio');
      revalidatePath('/admin');
      revalidatePath('/reports');
    }
    return res;
}

export async function getLabStudies(): Promise<LabStudy[]> {
    return await readJsonFile<LabStudy[]>('lab-studies.json', []);
}

export async function updateLabStudies(studies: LabStudy[]): Promise<{ success: boolean; message?: string }> {
    const res = await handleSimpleUpdate('lab-studies.json', studies);
     if (res.success) {
      revalidatePath('/laboratorio');
      revalidatePath('/admin');
      revalidatePath('/reports');
    }
    return res;
}

// ========== X-Ray Settings & Studies ==========
export async function getXRaySettings(): Promise<XRaySettings> {
    return await readJsonFile<XRaySettings>('x-ray-settings.json', {
        dailySlots: 15,
        startTime: "08:00",
        endTime: "14:00",
        weekendBookingEnabled: false,
        password: "xray"
    });
}

export async function updateXRaySettings(settings: XRaySettings): Promise<{ success: boolean; message?: string }> {
    const res = await handleSimpleUpdate('x-ray-settings.json', settings);
    if (res.success) {
      revalidatePath('/rayos-x');
      revalidatePath('/admin');
      revalidatePath('/reports');
    }
    return res;
}

export async function getXRayStudies(): Promise<XRayStudy[]> {
    return await readJsonFile<XRayStudy[]>('x-ray-studies.json', []);
}

export async function updateXRayStudies(studies: XRayStudy[]): Promise<{ success: boolean; message?: string }> {
    const res = await handleSimpleUpdate('x-ray-studies.json', studies);
    if (res.success) {
      revalidatePath('/rayos-x');
      revalidatePath('/admin');
      revalidatePath('/reports');
    }
    return res;
}

// ========== Ultrasound Settings & Studies ==========
export async function getUltrasoundSettings(): Promise<UltrasoundSettings> {
    return await readJsonFile<UltrasoundSettings>('ultrasound-settings.json', {
        dailySlots: 15,
        startTime: "08:00",
        endTime: "14:00",
        weekendBookingEnabled: false,
        password: "ultrasound"
    });
}

export async function updateUltrasoundSettings(settings: UltrasoundSettings): Promise<{ success: boolean; message?: string }> {
    const res = await handleSimpleUpdate('ultrasound-settings.json', settings);
    if (res.success) {
      revalidatePath('/ultrasonidos');
      revalidatePath('/admin');
      revalidatePath('/reports');
    }
    return res;
}

export async function getUltrasoundStudies(): Promise<UltrasoundStudy[]> {
    return await readJsonFile<UltrasoundStudy[]>('ultrasound-studies.json', []);
}

export async function updateUltrasoundStudies(studies: UltrasoundStudy[]): Promise<{ success: boolean; message?: string }> {
    const res = await handleSimpleUpdate('ultrasound-studies.json', studies);
     if (res.success) {
      revalidatePath('/ultrasonidos');
      revalidatePath('/admin');
      revalidatePath('/reports');
    }
    return res;
}

// ========== Vaccine Settings & Vaccines ==========
export async function getVaccineSettings(): Promise<VaccineSettings> {
    return await readJsonFile<VaccineSettings>('vaccine-settings.json', {
        dailySlots: 30,
        startTime: "08:00",
        endTime: "13:00",
        weekendBookingEnabled: false,
        password: "vacunas"
    });
}

export async function updateVaccineSettings(settings: VaccineSettings): Promise<{ success: boolean; message?: string }> {
    const res = await handleSimpleUpdate('vaccine-settings.json', settings);
    if (res.success) {
      revalidatePath('/vacunas');
      revalidatePath('/admin');
      revalidatePath('/reports');
    }
    return res;
}

export async function getVaccines(): Promise<Vaccine[]> {
    return await readJsonFile<Vaccine[]>('vaccines.json', []);
}

export async function updateVaccines(vaccines: Vaccine[]): Promise<{ success: boolean; message?: string }> {
    const res = await handleSimpleUpdate('vaccines.json', vaccines);
    if (res.success) {
      revalidatePath('/vacunas');
      revalidatePath('/admin');
      revalidatePath('/reports');
    }
    return res;
}

// ========== Module Settings ==========
export async function getModuleSettings(): Promise<ModuleSettings> {
    return await readJsonFile<ModuleSettings>('module-settings.json', {
        citasMedicasEnabled: true,
        laboratorioEnabled: true,
        rayosXEnabled: true,
        ultrasoundEnabled: true,
        vacunasEnabled: true,
    });
}

export async function updateModuleSettings(settings: ModuleSettings): Promise<{ success: boolean; message?: string }> {
    const res = await handleSimpleUpdate('module-settings.json', settings);
    if(res.success) {
      revalidatePath('/', 'layout');
    }
    return res;
}

// ========== Patient & Appointment Data (Locked Operations) ==========

export async function getPatientById(id: string): Promise<Patient | null> {
    const patients = await readJsonFile<Patient[]>('patients.json', []);
    return patients.find(p => p.id === id) || null;
}

const enrichAppointmentsWithPatients = async <T extends { patientId: string }>(appointments: T[]): Promise<(T & { patient: Patient })[]> => {
    const patients = await readJsonFile<Patient[]>('patients.json', []);
    const patientMap: Record<string, Patient> = {};
    patients.forEach(p => {
        patientMap[p.id] = p;
    });
    return appointments
      .map((app) => ({
        ...app,
        patient: patients.find(p => p.id === app.patientId)!,
      }))
      .filter((app) => app.patient);
};

export async function getAppointments(): Promise<(Appointment & { patient: Patient })[]> {
    const appointments = await readJsonFile<Appointment[]>('appointments.json', []);
    return await enrichAppointmentsWithPatients(appointments);
}

export async function getAppointmentsByDate(date: Date): Promise<(Appointment & { patient: Patient })[]> {
    const appointments = await getAppointments();
    const dateString = date.toISOString().split('T')[0];
    return appointments.filter(app => app.date.startsWith(dateString));
}

export async function getAppointmentsForClinic(clinicId: string): Promise<(Appointment & { patient: Patient })[]> {
    const appointments = await getAppointments();
    return appointments.filter(app => app.clinicId === clinicId);
}

// Generic function to save a new appointment and patient atomically
async function saveNewAppointmentBase<T extends { id: string; patientId: string; patient: Patient; appointmentNumber: string; date: string }>(
  appointmentFilename: string,
  appointmentData: Omit<T, 'id' | 'patientId' | 'patient' | 'status'>,
  patientData: Omit<Patient, 'id'>,
  logAction: string,
  revalidationPaths: string[]
): Promise<T> {
  const filesToLock = [appointmentFilename, 'patients.json'].sort();
  await acquireLock(filesToLock[0]);
  await acquireLock(filesToLock[1]);

  try {
    const appointments = await readJsonFile<T[]>(appointmentFilename, []);
    const patients = await readJsonFile<Patient[]>('patients.json', []);

    // Patient logic
    let patient = patients.find(p => p.curp.toUpperCase() === patientData.curp.toUpperCase());
    if (!patient) {
        patient = { id: uuidv4(), ...patientData };
        await unsafeWriteJsonFile('patients.json', [...patients, patient]);
        await logActivity('Creación de Paciente', `Nuevo paciente ${patient.name} con CURP ${patient.curp}`);
    } else {
        const updatedPatients = patients.map(p => p.id === patient!.id ? { ...patient!, ...patientData } : p);
        await unsafeWriteJsonFile('patients.json', updatedPatients);
        patient = { ...patient, ...patientData };
    }

    // Appointment logic
    const newAppointment = {
        ...appointmentData,
        id: uuidv4(),
        patientId: patient.id,
        patient: patient,
        status: 'Agendada',
    } as T;

    await unsafeWriteJsonFile(appointmentFilename, [...appointments, newAppointment]);
    await logActivity(logAction, `Folio ${newAppointment.appointmentNumber} para ${patient.name} ${patient.paternalLastName}.`);

    revalidationPaths.forEach(p => revalidatePath(p, 'layout'));

    return newAppointment;
  } finally {
    await releaseLock(filesToLock[0]);
    await releaseLock(filesToLock[1]);
  }
}

export async function saveAppointment(
  appointmentData: Omit<Appointment, 'id' | 'patientId' | 'patient' | 'status'>,
  patientData: Omit<Patient, 'id'>,
): Promise<Appointment> {
  // Validation specific to general appointments
  const clinics = await getClinics();
  const clinic = clinics.find(c => c.id === appointmentData.clinicId);
  if (!clinic) throw new Error("La clínica seleccionada no es válida.");

  const allAppointments = await readJsonFile<Appointment[]>('appointments.json', []);
  const allPatients = await readJsonFile<Patient[]>('patients.json', []);
  const appointmentsOnDate = allAppointments
    .map(app => ({...app, patient: allPatients.find(p => p.id === app.patientId)}))
    .filter(app => app.patient && app.date.startsWith(new Date(appointmentData.date).toISOString().split('T')[0]));

  const appointmentsInClinicOnDate = appointmentsOnDate.filter(app => app.clinicId === appointmentData.clinicId);
  if (appointmentsInClinicOnDate.length >= clinic.dailySlots) {
      throw new Error("No hay más cupos disponibles en este núcleo para la fecha seleccionada.");
  }
  if (appointmentsOnDate.some(app => app.clinicId === appointmentData.clinicId && app.time === appointmentData.time)) {
    throw new Error(`El horario de ${appointmentData.time} ya no está disponible. Por favor, selecciona otro.`);
  }
  if (appointmentsOnDate.some(app => app.patient?.curp.toUpperCase() === patientData.curp.toUpperCase())) {
    throw new Error('Ya existe una cita agendada con esta CURP para el día seleccionado.');
  }

  return saveNewAppointmentBase<Appointment>('appointments.json', appointmentData, patientData, 'Creación Cita Médica', ['/citas-medicas', '/admin', '/reports']);
}


// Generic delete function
async function deleteAppointmentBase(filename: string, id: string, logAction: string, revalidationPaths: string[]): Promise<void> {
    await acquireLock(filename);
    try {
        const appointments = await readJsonFile<any[]>(filename, []);
        const appToDelete = appointments.find(app => app.id === id);
        if (appToDelete) {
            const updatedAppointments = appointments.filter(app => app.id !== id);
            await unsafeWriteJsonFile(filename, updatedAppointments);
            await logActivity(logAction, `Folio: ${appToDelete.appointmentNumber}, Paciente ID: ${appToDelete.patientId}`);
            revalidationPaths.forEach(p => revalidatePath(p, 'layout'));
        }
    } finally {
        await releaseLock(filename);
    }
}

export async function deleteAppointment(id: string): Promise<void> {
    await deleteAppointmentBase('appointments.json', id, 'Eliminación Cita Médica', ['/citas-medicas', '/admin', '/reports']);
}

export async function getLabAppointments(): Promise<(LabAppointment & { patient: Patient })[]> {
    const appointments = await readJsonFile<LabAppointment[]>('lab-appointments.json', []);
    return await enrichAppointmentsWithPatients(appointments);
}

export async function getLabAppointmentsByDate(date: Date): Promise<(LabAppointment & { patient: Patient })[]> {
    const appointments = await getLabAppointments();
    return appointments.filter(app => app.date.startsWith(date.toISOString().split('T')[0]));
}

export async function saveLabAppointment(
  appointmentData: Omit<LabAppointment, 'id' | 'patientId' | 'patient' | 'status'>,
  patientData: Omit<Patient, 'id'>
): Promise<LabAppointment> {
  const settings = await getLabSettings();
  const appointmentsOnDate = await getLabAppointmentsByDate(new Date(appointmentData.date));
  if (appointmentsOnDate.length >= settings.dailySlots) {
    throw new Error('No hay más cupos para este día.');
  }
  if (appointmentsOnDate.some(app => app.patient.curp.toUpperCase() === patientData.curp.toUpperCase())) {
    throw new Error('Ya existe una cita de laboratorio agendada con esta CURP para el día seleccionado.');
  }
  return saveNewAppointmentBase<LabAppointment>('lab-appointments.json', appointmentData, patientData, 'Creación Cita Laboratorio', ['/laboratorio', '/admin', '/reports']);
}

export async function deleteLabAppointment(id: string): Promise<void> {
    await deleteAppointmentBase('lab-appointments.json', id, 'Eliminación Cita Laboratorio', ['/laboratorio', '/admin', '/reports']);
}

export async function getXRayAppointments(): Promise<(XRayAppointment & { patient: Patient })[]> {
    const appointments = await readJsonFile<XRayAppointment[]>('x-ray-appointments.json', []);
    return await enrichAppointmentsWithPatients(appointments);
}

export async function getXRayAppointmentsByDate(date: Date): Promise<(XRayAppointment & { patient: Patient })[]> {
    const appointments = await getXRayAppointments();
    return appointments.filter(app => app.date.startsWith(date.toISOString().split('T')[0]));
}

export async function saveXRayAppointment(
  appointmentData: Omit<XRayAppointment, 'id' | 'patientId' | 'patient' | 'status'>,
  patientData: Omit<Patient, 'id'>
): Promise<XRayAppointment> {
    const settings = await getXRaySettings();
    const appointmentsOnDate = await getXRayAppointmentsByDate(new Date(appointmentData.date));
    if (appointmentsOnDate.length >= settings.dailySlots) throw new Error('No hay más cupos para Rayos X en la fecha seleccionada.');
    if (appointmentsOnDate.some(app => app.time === appointmentData.time)) throw new Error(`El horario de ${appointmentData.time} ya no está disponible.`);
    if (appointmentsOnDate.some(app => app.patient.curp.toUpperCase() === patientData.curp.toUpperCase())) throw new Error('Ya existe una cita de Rayos X con esta CURP para el día seleccionado.');

    return saveNewAppointmentBase<XRayAppointment>('x-ray-appointments.json', appointmentData, patientData, 'Creación Cita Rayos X', ['/rayos-x', '/admin', '/reports']);
}

export async function deleteXRayAppointment(id: string): Promise<void> {
    await deleteAppointmentBase('x-ray-appointments.json', id, 'Eliminación Cita Rayos X', ['/rayos-x', '/admin', '/reports']);
}

export async function getUltrasoundAppointments(): Promise<(UltrasoundAppointment & { patient: Patient })[]> {
    const appointments = await readJsonFile<UltrasoundAppointment[]>('ultrasound-appointments.json', []);
    return await enrichAppointmentsWithPatients(appointments);
}

export async function getUltrasoundAppointmentsByDate(date: Date): Promise<(UltrasoundAppointment & { patient: Patient })[]> {
    const appointments = await getUltrasoundAppointments();
    return appointments.filter(app => app.date.startsWith(date.toISOString().split('T')[0]));
}

export async function saveUltrasoundAppointment(
  appointmentData: Omit<UltrasoundAppointment, 'id' | 'patientId' | 'patient' | 'status'>,
  patientData: Omit<Patient, 'id'>
): Promise<UltrasoundAppointment> {
    const settings = await getUltrasoundSettings();
    const appointmentsOnDate = await getUltrasoundAppointmentsByDate(new Date(appointmentData.date));
    if (appointmentsOnDate.length >= settings.dailySlots) throw new Error('No hay más cupos para Ultrasonidos en la fecha seleccionada.');
    if (appointmentsOnDate.some(app => app.time === appointmentData.time)) throw new Error(`El horario de ${appointmentData.time} ya no está disponible.`);
    if (appointmentsOnDate.some(app => app.patient.curp.toUpperCase() === patientData.curp.toUpperCase())) throw new Error('Ya existe una cita de Ultrasonido con esta CURP para el día seleccionado.');

    return saveNewAppointmentBase<UltrasoundAppointment>('ultrasound-appointments.json', appointmentData, patientData, 'Creación Cita Ultrasonido', ['/ultrasonidos', '/admin', '/reports']);
}

export async function deleteUltrasoundAppointment(id: string): Promise<void> {
    await deleteAppointmentBase('ultrasound-appointments.json', id, 'Eliminación Cita Ultrasonido', ['/ultrasonidos', '/admin', '/reports']);
}


export async function getVaccineAppointments(): Promise<(VaccineAppointment & { patient: Patient })[]> {
    const appointments = await readJsonFile<VaccineAppointment[]>('vaccine-appointments.json', []);
    return await enrichAppointmentsWithPatients(appointments);
}

export async function getVaccineAppointmentsByDate(date: Date): Promise<(VaccineAppointment & { patient: Patient })[]> {
    const appointments = await getVaccineAppointments();
    return appointments.filter(app => app.date.startsWith(date.toISOString().split('T')[0]));
}

export async function saveVaccineAppointment(
  appointmentData: Omit<VaccineAppointment, 'id' | 'patientId' | 'patient' | 'status'>,
  patientData: Omit<Patient, 'id'>,
): Promise<VaccineAppointment> {
    const settings = await getVaccineSettings();
    const appointmentsOnDate = await getVaccineAppointmentsByDate(new Date(appointmentData.date));
    if (appointmentsOnDate.length >= settings.dailySlots) throw new Error('No hay más cupos para Vacunación en la fecha seleccionada.');
    if (appointmentsOnDate.some(app => app.time === appointmentData.time)) throw new Error(`El horario de ${appointmentData.time} ya no está disponible.`);
    if (!appointmentData.isNewborn && appointmentsOnDate.some(app => app.patient?.curp?.toUpperCase() === patientData.curp.toUpperCase())) throw new Error('Ya existe una cita de Vacunación con esta CURP para el día seleccionado.');

    return saveNewAppointmentBase<VaccineAppointment>('vaccine-appointments.json', appointmentData, patientData, 'Creación Cita Vacunación', ['/vacunas', '/admin', '/reports']);
}

export async function deleteVaccineAppointment(id: string): Promise<void> {
    await deleteAppointmentBase('vaccine-appointments.json', id, 'Eliminación Cita Vacunación', ['/vacunas', '/admin', '/reports']);
}


// ========== Universal Patient Search & Update ==========
export async function getPatientByCURP(curp: string): Promise<Patient | null> {
    const upperCurp = curp.toUpperCase();
    if (!upperCurp) return null;
    const patients = await readJsonFile<Patient[]>('patients.json', []);
    return patients.find(p => p.curp.toUpperCase() === upperCurp) || null;
}

export async function updatePatient(patientId: string, patientData: Partial<Omit<Patient, 'id'>>): Promise<{ success: boolean, data?: Patient, message?: string }> {
    const filename = 'patients.json';
    await acquireLock(filename);
    try {
        const patients = await readJsonFile<Patient[]>(filename, []);
        const patientIndex = patients.findIndex(p => p.id === patientId);

        if (patientIndex === -1) {
            return { success: false, message: 'Patient not found.' };
        }

        const updatedPatient = { ...patients[patientIndex], ...patientData };
        patients[patientIndex] = updatedPatient;

        await unsafeWriteJsonFile(filename, patients);
        await logActivity('Actualización de Paciente', `Datos del paciente ${updatedPatient.name} (CURP: ${updatedPatient.curp}) actualizados.`);

        revalidatePath('/admin', 'layout');
        return { success: true, data: updatedPatient };
    } catch(e: any) {
        return { success: false, message: e.message };
    } finally {
        await releaseLock(filename);
    }
}

export async function updateAppointmentStatus(appointmentId: string, status: AppointmentStatus, type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine'): Promise<{ success: boolean, message?: string }> {
    const filename = `${type === 'medical' ? 'appointments' : type + '-appointments'}.json`;
    await acquireLock(filename);
    try {
        const appointments = await readJsonFile<any[]>(filename, []);
        const appointmentIndex = appointments.findIndex(app => app.id === appointmentId);

        if (appointmentIndex === -1) {
            return { success: false, message: 'Cita no encontrada.' };
        }

        appointments[appointmentIndex].status = status;
        await unsafeWriteJsonFile(filename, appointments);

        const appointment = appointments[appointmentIndex];
        await logActivity('Actualización de Estado', `Folio ${appointment.appointmentNumber} (${type}) actualizado a: ${status}.`);
        revalidatePath('/admin');
        revalidatePath('/reports');
        return { success: true };
    } catch(e: any) {
      return { success: false, message: e.message };
    } finally {
      await releaseLock(filename);
    }
}

export async function rescheduleAppointment(
  appointmentId: string,
  newDate: string, // ISO string for the new date
  type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine'
): Promise<{ success: boolean; message: string; newTime?: string }> {
    const filename = `${type === 'medical' ? 'appointments' : type + '-appointments'}.json`;
    await acquireLock(filename);
    try {
      const appointments = await readJsonFile<any[]>(filename, []);
      const appointmentIndex = appointments.findIndex(app => app.id === appointmentId);
      if (appointmentIndex === -1) return { success: false, message: 'Cita no encontrada.' };

      const appointmentToReschedule = appointments[appointmentIndex];
      const originalTime = appointmentToReschedule.time;
      const newDateObj = new Date(newDate);
      const newDateString = newDateObj.toISOString().split('T')[0];

      appointments[appointmentIndex].date = newDateObj.toISOString();
      appointments[appointmentIndex].status = 'Agendada';

      await unsafeWriteJsonFile(filename, appointments);

      await logActivity(
          'Cambio de Fecha Cita',
          `Folio ${appointmentToReschedule.appointmentNumber} (${type}) movido a ${newDateString} a las ${originalTime}.`
      );

      revalidatePath('/admin', 'layout');

      return { success: true, message: 'La fecha de la cita ha sido actualizada con éxito.', newTime: originalTime };

    } catch (e: any) {
        return { success: false, message: e.message || 'Ocurrió un error inesperado.' };
    } finally {
        await releaseLock(filename);
    }
}

// Passwords can be read without locking.
export async function verifyClinicPassword(clinicId: string, passwordAttempt: string): Promise<{ isValid: boolean; error?: string }> {
  const clinics = await getClinics();
  const clinic = clinics.find((c) => c.id === clinicId);
  if (!clinic) return { isValid: false, error: 'El núcleo básico seleccionado no existe.' };
  return { isValid: clinic.password === passwordAttempt, error: clinic.password !== passwordAttempt ? 'La contraseña es incorrecta.' : undefined };
}
export async function verifyLabPassword(passwordAttempt: string): Promise<{ isValid: boolean; error?: string }> {
    const settings = await getLabSettings();
    return { isValid: settings.password === passwordAttempt, error: settings.password !== passwordAttempt ? 'La contraseña es incorrecta.' : undefined };
}
export async function verifyXRayPassword(passwordAttempt: string): Promise<{ isValid: boolean; error?: string }> {
    const settings = await getXRaySettings();
    return { isValid: settings.password === passwordAttempt, error: settings.password !== passwordAttempt ? 'La contraseña es incorrecta.' : undefined };
}
export async function verifyUltrasoundPassword(passwordAttempt: string): Promise<{ isValid: boolean; error?: string }> {
    const settings = await getUltrasoundSettings();
    return { isValid: settings.password === passwordAttempt, error: settings.password !== passwordAttempt ? 'La contraseña es incorrecta.' : undefined };
}
export async function verifyVaccinePassword(passwordAttempt: string): Promise<{ isValid: boolean; error?: string }> {
    const settings = await getVaccineSettings();
    return { isValid: settings.password === passwordAttempt, error: settings.password !== passwordAttempt ? 'La contraseña es incorrecta.' : undefined };
}


// ========== Backup & Restore Data ==========
export async function createBackupData(): Promise<any> {
    // This is a read-only operation, no lock needed.
    return {
      appointments: await readJsonFile<Appointment[]>('appointments.json', []),
      labAppointments: await readJsonFile<LabAppointment[]>('lab-appointments.json', []),
      xRayAppointments: await readJsonFile<XRayAppointment[]>('x-ray-appointments.json', []),
      ultrasoundAppointments: await readJsonFile<UltrasoundAppointment[]>('ultrasound-appointments.json', []),
      vaccineAppointments: await readJsonFile<VaccineAppointment[]>('vaccine-appointments.json', []),
      patients: await readJsonFile<Patient[]>('patients.json', []),
    };
}

export async function restoreBackupData(backupData: any): Promise<{success: boolean, message?: string, stats?: any}> {
    const filesToLock = ['patients.json', 'appointments.json', 'lab-appointments.json', 'x-ray-appointments.json', 'ultrasound-appointments.json', 'vaccine-appointments.json'].sort();

    for(const file of filesToLock) {
        await acquireLock(file);
    }
    try {
      if (!backupData.patients || !backupData.appointments) {
        throw new Error('El archivo de respaldo tiene un formato incorrecto.');
      }

      await unsafeWriteJsonFile('patients.json', backupData.patients || []);
      await unsafeWriteJsonFile('appointments.json', backupData.appointments || []);
      await unsafeWriteJsonFile('lab-appointments.json', backupData.labAppointments || []);
      await unsafeWriteJsonFile('x-ray-appointments.json', backupData.xRayAppointments || []);
      await unsafeWriteJsonFile('ultrasound-appointments.json', backupData.ultrasoundAppointments || []);
      await unsafeWriteJsonFile('vaccine-appointments.json', backupData.vaccineAppointments || []);

      const stats = { restored: {
          patients: (backupData.patients || []).length,
          appointments: (backupData.appointments || []).length,
          labAppointments: (backupData.labAppointments || []).length,
          xRayAppointments: (backupData.xRayAppointments || []).length,
          ultrasoundAppointments: (backupData.ultrasoundAppointments || []).length,
          vaccineAppointments: (backupData.vaccineAppointments || []).length,
      }};
      const totalRestored = Object.values(stats.restored).reduce((a, b) => a + b, 0);
      await logActivity('Restauración de Respaldo', `Se restauraron un total de ${totalRestored} registros.`);

      revalidatePath('/admin', 'layout');
      return { success: true, stats };
    } catch (e: any) {
      console.error('Failed to restore backup', e);
      return { success: false, message: e.message || 'Error al restaurar el respaldo.'};
    } finally {
        for(const file of filesToLock) {
            await releaseLock(file);
        }
    }
}

export async function cleanupOldAppointments(): Promise<{deletedCount: number}> {
    const appointmentFiles = ['appointments.json', 'lab-appointments.json', 'x-ray-appointments.json', 'ultrasound-appointments.json', 'vaccine-appointments.json'];
    let totalDeleted = 0;

    const today = new Date();
    const firstDayOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    for (const filename of appointmentFiles) {
        await acquireLock(filename);
        try {
            const appointments = await readJsonFile<any[]>(filename, []);
            const originalCount = appointments.length;
            const recentAppointments = appointments.filter(app => new Date(app.date) >= firstDayOfCurrentMonth);
            if (originalCount > recentAppointments.length) {
                await unsafeWriteJsonFile(filename, recentAppointments);
                totalDeleted += originalCount - recentAppointments.length;
            }
        } finally {
            await releaseLock(filename);
        }
    }

    if (totalDeleted > 0) {
        await logActivity('Limpieza de Registros', `Se eliminaron ${totalDeleted} citas antiguas de meses anteriores.`);
    }
    revalidatePath('/admin', 'layout');
    return { deletedCount: totalDeleted };
}

export async function getAppointmentById(
  id: string,
  type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine'
): Promise<any | null> {
    const filename = `${type === 'medical' ? 'appointments' : type + '-appointments'}.json`;
    const appointments = await readJsonFile<any[]>(filename, []);
    const appointment = appointments.find(app => app.id === id);

    if (!appointment) return null;

    const patient = await getPatientById(appointment.patientId);
    return patient ? { ...appointment, patient: { ...patient } } : appointment;
}


export async function cloneAppointment(
  originalAppointmentId: string,
  newDate: string,
  type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine'
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const originalAppointment = await getAppointmentById(originalAppointmentId, type);
    if (!originalAppointment) {
        throw new Error('Cita original no encontrada.');
    }

    const patientData = originalAppointment.patient;
    if (!patientData) {
        throw new Error('Paciente no encontrado.');
    }

    const newAppointmentBase = { ...originalAppointment, date: newDate };
    let result: { success: boolean; data?: any; error?: string };

    if (type === 'medical') {
        const { id, patientId, patient, status, ...payload } = newAppointmentBase;
        payload.appointmentNumber = ''; // Will be regenerated
        const newApp = await saveAppointment(payload, patientData)
        result = { success: true, data: {appointment: newApp, clinic: await getClinics().then(c => c.find(cl => cl.id === newApp.clinicId)!)}}
    } else if (type === 'lab') {
        const { id, patientId, patient, status, ...payload } = newAppointmentBase;
        payload.appointmentNumber = '';
        const newApp = await saveLabAppointment(payload, patientData);
        result = { success: true, data: newApp };
    } else if (type === 'xray') {
        const { id, patientId, patient, status, ...payload } = newAppointmentBase;
        payload.appointmentNumber = '';
        const newApp = await saveXRayAppointment(payload, patientData);
        result = { success: true, data: newApp };
    } else if (type === 'ultrasound') {
        const { id, patientId, patient, status, ...payload } = newAppointmentBase;
        payload.appointmentNumber = '';
        const newApp = await saveUltrasoundAppointment(payload, patientData);
        result = { success: true, data: newApp };
    } else if (type === 'vaccine') {
        const { id, patientId, patient, status, ...payload } = newAppointmentBase;
        payload.appointmentNumber = '';
        const newApp = await saveVaccineAppointment(payload, patientData);
        result = { success: true, data: newApp };
    } else {
        throw new Error('Tipo de cita no válido para clonación.');
    }

    if (!result.success) {
        throw new Error(result.error || 'No se pudo crear la nueva cita clonada.');
    }

    revalidatePath('/admin', 'layout');

    const newAppointmentNumber = result.data?.appointment?.appointmentNumber || result.data?.appointmentNumber;
    return { success: true, message: `Nueva cita asignada con folio ${newAppointmentNumber}`, data: result.data };

  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export const getLogs = async (): Promise<ActivityLog[]> => {
    return readJsonFile<ActivityLog[]>('activity-log.json', []);
};
