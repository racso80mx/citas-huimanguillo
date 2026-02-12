'use server';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type {
  Clinic,
  Colonia,
  Appointment,
  Patient,
  LabAppointment,
  LabStudy,
  LabSettings,
  XRayAppointment,
  XRayStudy,
  XRaySettings,
  UltrasoundAppointment,
  UltrasoundStudy,
  UltrasoundSettings,
  VaccineAppointment,
  Vaccine,
  VaccineSettings,
  User,
  ActivityLog,
  AppointmentStatus,
  ModuleSettings,
} from './definitions';
import { isSaturday, isSunday, startOfMonth } from 'date-fns';

const dataPath = path.join(process.cwd(), 'src', 'lib', 'data');
const lockPath = path.join(dataPath, 'db.lock');
const transactionLogPath = path.join(dataPath, 'transaction_log.jsonl');

async function withFileLock<T>(fn: () => Promise<T>): Promise<T> {
  const lockAcquired = false;
  while (!lockAcquired) {
    try {
      await fs.open(lockPath, 'wx');
      // If open succeeds, we have the lock
      const result = await fn();
      return result;
    } catch (e: any) {
      if (e.code === 'EEXIST') {
        // Lock file exists, wait and retry
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        // Another error occurred
        throw e;
      }
    } finally {
      try {
        await fs.unlink(lockPath);
      } catch (e) {
        // Ignore errors on unlink (e.g., if lock was lost)
      }
    }
  }
  // This part of the code should be unreachable
  throw new Error('Failed to acquire file lock.');
}

async function logTransaction(
  type: 'CREATE' | 'UPDATE' | 'DELETE' | 'BATCH',
  entity: string,
  data: any
) {
  const logEntry = {
    type,
    entity,
    timestamp: new Date().toISOString(),
    data,
  };
  await fs.appendFile(transactionLogPath, JSON.stringify(logEntry) + '\n');
}

async function readData<T>(filename: string): Promise<T> {
  const filePath = path.join(dataPath, `${filename}.json`);
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If the file doesn't exist, return a default value (e.g., empty array)
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      if (filename.includes('settings')) return {} as T;
      return [] as T;
    }
    throw error;
  }
}

async function writeData(filename: string, data: any): Promise<void> {
  const filePath = path.join(dataPath, `${filename}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}


// --- Specific Data Functions ---

// Settings
export async function getAnnouncements(): Promise<string[]> {
    const data = await readData<{ messages: string[] }>('announcements');
    return data.messages || [];
}
export async function updateAnnouncements(newAnnouncements: string[]) {
    return withFileLock(async () => {
        await logTransaction('UPDATE', 'announcements', { messages: newAnnouncements });
        await writeData('announcements', { messages: newAnnouncements.slice(0, 4) });
        return { success: true };
    });
}

export async function getModuleSettings(): Promise<ModuleSettings> {
    return await readData<ModuleSettings>('module-settings');
}
export async function updateModuleSettings(settings: ModuleSettings) {
    return withFileLock(async () => {
        await logTransaction('UPDATE', 'module-settings', settings);
        await writeData('module-settings', settings);
        return { success: true };
    });
}


export async function getLabSettings(): Promise<LabSettings> { return readData<LabSettings>('lab-settings'); }
export async function updateLabSettings(settings: LabSettings) {
    return withFileLock(async () => {
        await logTransaction('UPDATE', 'lab-settings', settings);
        await writeData('lab-settings', settings);
        return { success: true };
    });
}

export async function getXRaySettings(): Promise<XRaySettings> { return readData<XRaySettings>('x-ray-settings'); }
export async function updateXRaySettings(settings: XRaySettings) {
     return withFileLock(async () => {
        await logTransaction('UPDATE', 'x-ray-settings', settings);
        await writeData('x-ray-settings', settings);
        return { success: true };
    });
}

export async function getUltrasoundSettings(): Promise<UltrasoundSettings> { return readData<UltrasoundSettings>('ultrasound-settings'); }
export async function updateUltrasoundSettings(settings: UltrasoundSettings) {
     return withFileLock(async () => {
        await logTransaction('UPDATE', 'ultrasound-settings', settings);
        await writeData('ultrasound-settings', settings);
        return { success: true };
    });
}

export async function getVaccineSettings(): Promise<VaccineSettings> { return readData<VaccineSettings>('vaccine-settings'); }
export async function updateVaccineSettings(settings: VaccineSettings) {
     return withFileLock(async () => {
        await logTransaction('UPDATE', 'vaccine-settings', settings);
        await writeData('vaccine-settings', settings);
        return { success: true };
    });
}


// Catalogues
export async function getLabStudies(): Promise<LabStudy[]> { return readData<LabStudy[]>('lab-studies'); }
export async function updateLabStudies(studies: LabStudy[]) {
     return withFileLock(async () => {
        await logTransaction('BATCH', 'lab-studies', studies);
        await writeData('lab-studies', studies);
        return { success: true };
    });
}

export async function getXRayStudies(): Promise<XRayStudy[]> { return readData<XRayStudy[]>('x-ray-studies'); }
export async function updateXRayStudies(studies: XRayStudy[]) {
     return withFileLock(async () => {
        await logTransaction('BATCH', 'x-ray-studies', studies);
        await writeData('x-ray-studies', studies);
        return { success: true };
    });
}

export async function getUltrasoundStudies(): Promise<UltrasoundStudy[]> { return readData<UltrasoundStudy[]>('ultrasound-studies'); }
export async function updateUltrasoundStudies(studies: UltrasoundStudy[]) {
     return withFileLock(async () => {
        await logTransaction('BATCH', 'ultrasound-studies', studies);
        await writeData('ultrasound-studies', studies);
        return { success: true };
    });
}

export async function getVaccines(): Promise<Vaccine[]> { return readData<Vaccine[]>('vaccines'); }
export async function updateVaccines(vaccines: Vaccine[]) {
     return withFileLock(async () => {
        await logTransaction('BATCH', 'vaccines', vaccines);
        await writeData('vaccines', vaccines);
        return { success: true };
    });
}


export async function getClinics(): Promise<Clinic[]> {
    return readData<Clinic[]>('clinics');
}

export async function updateClinics(clinics: Clinic[]) {
    return withFileLock(async () => {
        await logTransaction('BATCH', 'clinics', clinics);
        await writeData('clinics', clinics);
        return { success: true };
    });
}

export async function getColonias(): Promise<Colonia[]> {
    return readData<Colonia[]>('colonias');
}

export async function updateColonias(colonias: Colonia[]) {
    return withFileLock(async () => {
        await logTransaction('BATCH', 'colonias', colonias);
        await writeData('colonias', colonias);
        return { success: true };
    });
}

export async function getUsers(): Promise<User[]> {
    return readData<User[]>('users');
}
export async function updateUsers(users: User[]) {
    return withFileLock(async () => {
        await logTransaction('BATCH', 'users', users);
        await writeData('users', users);
        return { success: true };
    });
}

export async function getLogs(): Promise<ActivityLog[]> {
    const logs = await readData<ActivityLog[]>('activity-log');
    return logs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 500);
}

async function logActivity(action: string, details: string) {
    return withFileLock(async () => {
        const logs = await readData<ActivityLog[]>('activity-log');
        const newLog = { id: uuidv4(), timestamp: new Date().toISOString(), action, details };
        logs.unshift(newLog);
        await logTransaction('CREATE', 'activityLog', newLog);
        await writeData('activity-log', logs.slice(0, 500)); // Keep log size manageable
    });
}

export async function getPatientByCURP(curp: string): Promise<Patient | null> {
  const patients = await readData<Patient[]>('patients');
  return patients.find(p => p.curp.toUpperCase() === curp.toUpperCase()) || null;
}

export async function getAppointments(): Promise<Appointment[]> {
    return readData<Appointment[]>('appointments');
}
export async function getLabAppointments(): Promise<LabAppointment[]> {
    return readData<LabAppointment[]>('lab-appointments');
}
export async function getXRayAppointments(): Promise<XRayAppointment[]> {
    return readData<XRayAppointment[]>('x-ray-appointments');
}
export async function getUltrasoundAppointments(): Promise<UltrasoundAppointment[]> {
    return readData<UltrasoundAppointment[]>('ultrasound-appointments');
}
export async function getVaccineAppointments(): Promise<VaccineAppointment[]> {
    return readData<VaccineAppointment[]>('vaccine-appointments');
}


export async function getAppointmentsForClinic(
  clinicId: string
): Promise<Appointment[]> {
  const allAppointments = await getAppointments();
  return allAppointments.filter(app => app.clinicId === clinicId);
}

// --- Data Modification Actions ---

async function saveAppointmentBase<T extends { id: string, date: string, time: string, patient: Patient, appointmentNumber: string, status: AppointmentStatus }>(
    fileName: string,
    appointmentData: Omit<T, 'id' | 'patient'>,
    patientData: Omit<Patient, 'id'>,
    logAction: string,
    validationFn: (allApps: T[], allPatients: Patient[], clinic?: Clinic) => void = () => {}
): Promise<{appointment: T, clinic?: Clinic}> {

    return withFileLock(async () => {
        const allAppointments = await readData<T[]>(fileName);
        const allPatients = await readData<Patient[]>('patients');

        let clinic: Clinic | undefined;
        if ((appointmentData as any).clinicId) {
            const clinics = await getClinics();
            clinic = clinics.find(c => c.id === (appointmentData as any).clinicId);
            if (!clinic) throw new Error("La clínica seleccionada no es válida.");
        }
        
        validationFn(allAppointments, allPatients, clinic);

        let patient = allPatients.find(p => p.curp.toUpperCase() === patientData.curp.toUpperCase());
        if (patient) {
            // Update existing patient data
            Object.assign(patient, patientData);
        } else {
            // Create new patient
            patient = { id: uuidv4(), ...patientData };
            allPatients.push(patient);
        }
        
        const newAppointment = {
            ...appointmentData,
            id: uuidv4(),
            patientId: patient.id,
            status: 'Agendada'
        } as Omit<T, 'patient'>;

        allAppointments.push(newAppointment as T);
        
        await logTransaction('CREATE', fileName, { appointment: newAppointment, patient });
        await writeData(fileName, allAppointments);
        await writeData('patients', allPatients);
        await logActivity(logAction, `Folio ${newAppointment.appointmentNumber} para ${patient.name}.`);

        return { appointment: { ...newAppointment, patient } as T, clinic };
    });
}

export async function saveAppointment(appointmentData: Omit<Appointment, 'id'|'patient'|'patientId'|'status'>, patientData: Omit<Patient, 'id'>): Promise<{appointment: Appointment, clinic: Clinic}> {
    const validationFn = (allApps: Appointment[], allPatients: Patient[], clinic?: Clinic) => {
        if (!clinic) throw new Error("Clínica no proporcionada para validación.");
        const appointmentsOnDateForClinic = allApps.filter(
            app => app.date.split('T')[0] === appointmentData.date.split('T')[0] && app.clinicId === clinic.id
        );

        const date = new Date(appointmentData.date);
        const dayOfWeek = date.getUTCDay();
        const dateString = date.toISOString().split('T')[0];

        const dayOfWeekMap: { [key: string]: number } = { "Domingo": 0, "Lunes": 1, "Martes": 2, "Miércoles": 3, "Jueves": 4, "Viernes": 5, "Sábado": 6 };

        if (clinic.dayOfAction && clinic.dayOfAction !== 'Ninguno' && dayOfWeekMap[clinic.dayOfAction] === dayOfWeek) {
            throw new Error(`El ${clinic.dayOfAction} es día de acción y no se pueden agendar citas.`);
        }

        if (clinic.unavailableDates?.includes(dateString)) {
            throw new Error('La fecha seleccionada no está disponible (día inhábil/vacaciones).');
        }

        const isWeekend = isSaturday(date) || isSunday(date);
        if (isWeekend && !clinic.weekendBookingEnabled) {
            throw new Error('No se permiten citas en fin de semana para este núcleo.');
        }

        if (appointmentsOnDateForClinic.length >= clinic.dailySlots) {
            throw new Error("No hay más cupos disponibles en este núcleo para la fecha seleccionada.");
        }
        if (appointmentsOnDateForClinic.some(app => app.time === appointmentData.time)) {
            throw new Error(`El horario de ${appointmentData.time} ya no está disponible.`);
        }
    };
    return saveAppointmentBase<Appointment>('appointments', appointmentData, patientData, 'Creación Cita Médica', validationFn);
}
export async function saveLabAppointment(appointmentData: any, patientData: any) { return saveAppointmentBase('lab-appointments', appointmentData, patientData, 'Creación Cita Laboratorio'); }
export async function saveXRayAppointment(appointmentData: any, patientData: any) { return saveAppointmentBase('x-ray-appointments', appointmentData, patientData, 'Creación Cita Rayos X'); }
export async function saveUltrasoundAppointment(appointmentData: any, patientData: any) { return saveAppointmentBase('ultrasound-appointments', appointmentData, patientData, 'Creación Cita Ultrasonido'); }
export async function saveVaccineAppointment(appointmentData: any, patientData: any) { return saveAppointmentBase('vaccine-appointments', appointmentData, patientData, 'Creación Cita Vacunación'); }


async function deleteAppointmentBase(fileName: string, id: string, logAction: string) {
    return withFileLock(async () => {
        let allAppointments = await readData<any[]>(fileName);
        const appointmentToDelete = allAppointments.find(app => app.id === id);
        if (appointmentToDelete) {
            await logTransaction('DELETE', fileName, appointmentToDelete);
            allAppointments = allAppointments.filter(app => app.id !== id);
            await writeData(fileName, allAppointments);
            await logActivity(logAction, `Se eliminó el folio: ${appointmentToDelete.appointmentNumber}.`);
        }
    });
}

export async function deleteAppointment(id: string) { await deleteAppointmentBase('appointments', id, 'Eliminación Cita Médica'); }
export async function deleteLabAppointment(id: string) { await deleteAppointmentBase('lab-appointments', id, 'Eliminación Cita Laboratorio'); }
export async function deleteXRayAppointment(id: string) { await deleteAppointmentBase('x-ray-appointments', id, 'Eliminación Cita Rayos X'); }
export async function deleteUltrasoundAppointment(id: string) { await deleteAppointmentBase('ultrasound-appointments', id, 'Eliminación Cita Ultrasonido'); }
export async function deleteVaccineAppointment(id: string) { await deleteAppointmentBase('vaccine-appointments', id, 'Eliminación Cita Vacunación'); }


export async function updatePatient(patientId: string, patientData: Partial<Omit<Patient, 'id'>>) {
    return withFileLock(async () => {
        const allPatients = await readData<Patient[]>('patients');
        const patientIndex = allPatients.findIndex(p => p.id === patientId);
        if (patientIndex > -1) {
            const updatedPatient = { ...allPatients[patientIndex], ...patientData };
            allPatients[patientIndex] = updatedPatient;
            await logTransaction('UPDATE', 'patients', updatedPatient);
            await writeData('patients', allPatients);
            await logActivity('Actualización de Paciente', `Datos del paciente con ID ${patientId} actualizados.`);
            return { success: true };
        }
        return { success: false, message: "Paciente no encontrado." };
    });
}

export async function updateAppointmentStatus(appointmentId: string, status: AppointmentStatus, type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine'): Promise<{ success: boolean; message?: string }> {
    const fileName = type === 'medical' ? 'appointments' : `${type}-appointments`;
    
    return withFileLock(async () => {
        const allAppointments = await readData<any[]>(fileName);
        const appIndex = allAppointments.findIndex(app => app.id === appointmentId);
        if (appIndex > -1) {
            allAppointments[appIndex].status = status;
            await logTransaction('UPDATE', fileName, allAppointments[appIndex]);
            await writeData(fileName, allAppointments);
            await logActivity('Actualización de Estado', `Cita ${allAppointments[appIndex].appointmentNumber} (${type}) actualizada a: ${status}.`);
            return { success: true };
        }
        return { success: false, message: 'Cita no encontrada.' };
    });
}

export async function rescheduleAppointment(appointmentId: string, newDate: string, type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine'): Promise<{ success: boolean; message: string; newTime?: string }> {
    const fileName = type === 'medical' ? 'appointments' : `${type}-appointments`;
     return withFileLock(async () => {
        const allAppointments = await readData<any[]>(fileName);
        const appIndex = allAppointments.findIndex(app => app.id === appointmentId);
        if (appIndex > -1) {
            allAppointments[appIndex].date = newDate;
            allAppointments[appIndex].status = 'Agendada';
            await logTransaction('UPDATE', fileName, allAppointments[appIndex]);
            await writeData(fileName, allAppointments);
            await logActivity('Cambio de Fecha Cita', `Cita ${allAppointments[appIndex].appointmentNumber} (${type}) movida a ${newDate}.`);
            return { success: true, message: 'Fecha de la cita actualizada.' };
        }
        return { success: false, message: 'Cita no encontrada.' };
    });
}

export async function cloneAppointment(originalAppointmentId: string, newDate: string, type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine'): Promise<{ success: boolean; message: string; data?: any }> {
    const fileName = type === 'medical' ? 'appointments' : `${type}-appointments`;
    const allAppointments = await readData<any[]>(fileName);
    const originalAppointment = allAppointments.find(app => app.id === originalAppointmentId);
    if (!originalAppointment) throw new Error('Cita original no encontrada.');

    const patient = await getPatientByCURP(originalAppointment.patient.curp);
    if (!patient) throw new Error('Paciente no encontrado.');
    
    const { id, date, ...payload } = originalAppointment;
    
    const newAppointmentData = { ...payload, date: newDate };
    
    const patientPayload = {
      curp: patient.curp,
      name: patient.name,
      paternalLastName: patient.paternalLastName,
      maternalLastName: patient.maternalLastName,
      sex: patient.sex,
      age: patient.age,
      birthState: patient.birthState,
      phoneNumber: patient.phoneNumber,
    };
    
    let result: any;
    if (type === 'medical') result = await saveAppointment(newAppointmentData, patientPayload);
    else if (type === 'lab') result = await saveLabAppointment(newAppointmentData, patientPayload);
    else if (type === 'xray') result = await saveXRayAppointment(newAppointmentData, patientPayload);
    else if (type === 'ultrasound') result = await saveUltrasoundAppointment(newAppointmentData, patientPayload);
    else if (type === 'vaccine') result = await saveVaccineAppointment(newAppointmentData, patientPayload);
    else throw new Error('Tipo de cita no válido.');

    await logActivity('Clonación de Cita', `Folio original ${originalAppointment.appointmentNumber} clonado a nuevo folio ${result.appointment.appointmentNumber}.`);
    return { success: true, message: `Nueva cita asignada con folio ${result.appointment.appointmentNumber}`, data: result.appointment };
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


// --- Backup & Restore ---
export async function createBackupData() {
    const data = {
        appointments: await getAppointments(),
        labAppointments: await getLabAppointments(),
        xRayAppointments: await getXRayAppointments(),
        ultrasoundAppointments: await getUltrasoundAppointments(),
        vaccineAppointments: await getVaccineAppointments(),
        patients: await readData<Patient[]>('patients'),
        clinics: await getClinics(),
    };
    return data;
}

export async function restoreBackupData(backup: any) {
    return withFileLock(async () => {
      let addedCount = 0;
      const collections = [
        'appointments',
        'lab-appointments',
        'x-ray-appointments',
        'ultrasound-appointments',
        'vaccine-appointments',
        'patients',
        'clinics',
      ];
  
      for (const collectionName of collections) {
        const backupKey = collectionName.replace('-', '');
        const backupItems = backup[backupKey] || [];
        if (backupItems.length === 0) continue;
  
        const currentItems = await readData<any[]>(collectionName);
        const currentIds = new Set(currentItems.map(item => item.id));
  
        const newItems = backupItems.filter((item: any) => !currentIds.has(item.id));
  
        if (newItems.length > 0) {
          const updatedItems = [...currentItems, ...newItems];
          await logTransaction('BATCH', collectionName, newItems);
          await writeData(collectionName, updatedItems);
          addedCount += newItems.length;
        }
      }
      
      await logActivity('Restauración de Respaldo', `Se restauraron un total de ${addedCount} registros.`);
      return { addedCount };
    });
}

export async function cleanupOldRecords() {
    return withFileLock(async () => {
        const today = new Date();
        const firstDayOfCurrentMonth = startOfMonth(today);
        let totalDeleted = 0;

        const collectionsToClean = [
            'appointments',
            'lab-appointments',
            'x-ray-appointments',
            'ultrasound-appointments',
            'vaccine-appointments'
        ];

        for (const fileName of collectionsToClean) {
            let allAppointments = await readData<any[]>(fileName);
            const originalCount = allAppointments.length;
            
            const filteredAppointments = allAppointments.filter(app => {
                const appDate = new Date(app.date);
                return appDate >= firstDayOfCurrentMonth;
            });
            
            if (filteredAppointments.length < originalCount) {
                totalDeleted += originalCount - filteredAppointments.length;
                await logTransaction('DELETE', fileName, { count: originalCount - filteredAppointments.length, reason: "Cleanup old records" });
                await writeData(fileName, filteredAppointments);
            }
        }

        if (totalDeleted > 0) {
            await logActivity('Limpieza de Registros', `Se eliminaron ${totalDeleted} citas antiguas de meses anteriores.`);
        }
        
        return { deletedCount: totalDeleted };
    });
}
