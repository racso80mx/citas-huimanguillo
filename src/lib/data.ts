'use server';

import fs from 'fs/promises';
import path from 'path';
import type { Clinic, Colonia, LabSettings, LabStudy, XRaySettings, XRayStudy, UltrasoundSettings, UltrasoundStudy, Appointment, Patient, LabAppointment, XRayAppointment, UltrasoundAppointment, ModuleSettings, Vaccine, VaccineSettings, VaccineAppointment, AppointmentStatus } from './definitions';
import { v4 as uuidv4 } from 'uuid';

const dataFilePath = (filename: string) => path.join(process.cwd(), 'src', 'lib', 'data', filename);

async function readJsonFile<T>(filename: string, defaultValue: T): Promise<T> {
  try {
    const filePath = dataFilePath(filename);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      await writeJsonFile(filename, defaultValue);
      return defaultValue;
    }
    console.error(`Failed to read static file ${filename}`, error);
    return defaultValue;
  }
}

async function writeJsonFile(filename: string, data: any): Promise<{success: boolean, message?: string}> {
    try {
        await fs.writeFile(dataFilePath(filename), JSON.stringify(data, null, 2), 'utf-8');
        return { success: true };
    } catch (e: any) {
        console.error(`Failed to write to static file ${filename}`, e);
        return { success: false, message: `Failed to write to static file ${filename}: ${e.message}` };
    }
}

// ========== Announcements ==========
export const getAnnouncements = async (): Promise<string[]> => {
  const data = await readJsonFile<{ messages: string[] }>('announcements.json', { messages: [] });
  return data.messages;
};

export const updateAnnouncements = async (newAnnouncements: string[]): Promise<{ success: boolean; message?: string }> => {
  const data = { messages: newAnnouncements.slice(0, 4) };
  return await writeJsonFile('announcements.json', data);
};

// ========== Clinics Configuration ==========
export async function getClinics(): Promise<Clinic[]> {
  return await readJsonFile<Clinic[]>('clinics.json', []);
}

export async function updateClinics(clinics: Clinic[]): Promise<{ success: boolean; message?: string }> {
  return await writeJsonFile('clinics.json', clinics);
}

// ========== Colonias Configuration ==========
export async function getColonias(): Promise<Colonia[]> {
  return await readJsonFile<Colonia[]>('colonias.json', []);
}

export async function updateColonias(colonias: Colonia[]): Promise<{ success: boolean; message?: string }> {
    return await writeJsonFile('colonias.json', colonias);
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
    return await writeJsonFile('lab-settings.json', settings);
}

export async function getLabStudies(): Promise<LabStudy[]> {
    return await readJsonFile<LabStudy[]>('lab-studies.json', []);
}

export async function updateLabStudies(studies: LabStudy[]): Promise<{ success: boolean; message?: string }> {
    return await writeJsonFile('lab-studies.json', studies);
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
    return await writeJsonFile('x-ray-settings.json', settings);
}

export async function getXRayStudies(): Promise<XRayStudy[]> {
    return await readJsonFile<XRayStudy[]>('x-ray-studies.json', []);
}

export async function updateXRayStudies(studies: XRayStudy[]): Promise<{ success: boolean; message?: string }> {
    return await writeJsonFile('x-ray-studies.json', studies);
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
    return await writeJsonFile('ultrasound-settings.json', settings);
}

export async function getUltrasoundStudies(): Promise<UltrasoundStudy[]> {
    return await readJsonFile<UltrasoundStudy[]>('ultrasound-studies.json', []);
}

export async function updateUltrasoundStudies(studies: UltrasoundStudy[]): Promise<{ success: boolean; message?: string }> {
    return await writeJsonFile('ultrasound-studies.json', studies);
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
    return await writeJsonFile('vaccine-settings.json', settings);
}

export async function getVaccines(): Promise<Vaccine[]> {
    return await readJsonFile<Vaccine[]>('vaccines.json', []);
}

export async function updateVaccines(vaccines: Vaccine[]): Promise<{ success: boolean; message?: string }> {
    return await writeJsonFile('vaccines.json', vaccines);
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
    return await writeJsonFile('module-settings.json', settings);
}

// ========== Appointments ==========

const getPatientsFromAppointments = async <T extends { patientId: string }>(appointments: T[]): Promise<Record<string, Patient>> => {
    const patients = await readJsonFile<Patient[]>('patients.json', []);
    const patientMap: Record<string, Patient> = {};
    patients.forEach(p => {
        patientMap[p.id] = p;
    });
    return patientMap;
}

const enrichAppointmentsWithPatients = async <T extends { patientId: string }>(appointments: T[]): Promise<(T & { patient: Patient })[]> => {
    const patients = await getPatientsFromAppointments(appointments);
    return appointments
      .map((app) => ({
        ...app,
        patient: patients[app.patientId],
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

export async function saveAppointment(
  appointmentData: Omit<Appointment, 'id' | 'patientId' | 'patient' | 'status'>,
  patientData: Omit<Patient, 'id'>,
): Promise<Appointment> {
  const patients = await readJsonFile<Patient[]>('patients.json', []);
  const appointments = await readJsonFile<Appointment[]>('appointments.json', []);

  // Check if patient already exists
  let patient = patients.find(p => p.curp.toUpperCase() === patientData.curp.toUpperCase());
  if (!patient) {
      patient = { id: uuidv4(), ...patientData };
      await writeJsonFile('patients.json', [...patients, patient]);
  } else { // If patient exists, update their info
      const updatedPatients = patients.map(p => p.id === patient!.id ? { ...patient!, ...patientData } : p);
      await writeJsonFile('patients.json', updatedPatients);
      patient = { ...patient, ...patientData };
  }

  const newAppointment: Appointment = {
      ...appointmentData,
      id: uuidv4(),
      patientId: patient.id,
      patient: patient,
      status: 'Agendada',
  };
  
  await writeJsonFile('appointments.json', [...appointments, newAppointment]);

  return newAppointment;
}

export async function deleteAppointment(id: string): Promise<void> {
    const appointments = await readJsonFile<Appointment[]>('appointments.json', []);
    const updatedAppointments = appointments.filter(app => app.id !== id);
    await writeJsonFile('appointments.json', updatedAppointments);
}


// ========== Lab Appointments ==========
export async function getLabAppointments(): Promise<(LabAppointment & { patient: Patient })[]> {
    const appointments = await readJsonFile<LabAppointment[]>('lab-appointments.json', []);
    return await enrichAppointmentsWithPatients(appointments);
}

export async function getLabAppointmentsByDate(date: Date): Promise<(LabAppointment & { patient: Patient })[]> {
    const appointments = await getLabAppointments();
    const dateString = date.toISOString().split('T')[0];
    return appointments.filter(app => app.date.startsWith(dateString));
}

export async function saveLabAppointment(
  appointmentData: Omit<LabAppointment, 'id' | 'patientId' | 'patient' | 'status'>,
  patientData: Omit<Patient, 'id'>,
): Promise<LabAppointment> {
  const patients = await readJsonFile<Patient[]>('patients.json', []);
  const appointments = await readJsonFile<LabAppointment[]>('lab-appointments.json', []);

  let patient = patients.find(p => p.curp.toUpperCase() === patientData.curp.toUpperCase());
  if (!patient) {
      patient = { id: uuidv4(), ...patientData };
      await writeJsonFile('patients.json', [...patients, patient]);
  } else {
      const updatedPatients = patients.map(p => p.id === patient!.id ? { ...patient!, ...patientData } : p);
      await writeJsonFile('patients.json', updatedPatients);
      patient = { ...patient, ...patientData };
  }
  
  const newAppointment: LabAppointment = {
      ...appointmentData,
      id: uuidv4(),
      patientId: patient.id,
      patient: patient,
      status: 'Agendada',
  };
  
  await writeJsonFile('lab-appointments.json', [...appointments, newAppointment]);

  return newAppointment;
}

export async function deleteLabAppointment(id: string): Promise<void> {
    const appointments = await readJsonFile<LabAppointment[]>('lab-appointments.json', []);
    const updatedAppointments = appointments.filter(app => app.id !== id);
    await writeJsonFile('lab-appointments.json', updatedAppointments);
}


// ========== X-Ray Appointments ==========
export async function getXRayAppointments(): Promise<(XRayAppointment & { patient: Patient })[]> {
    const appointments = await readJsonFile<XRayAppointment[]>('x-ray-appointments.json', []);
    return await enrichAppointmentsWithPatients(appointments);
}

export async function getXRayAppointmentsByDate(date: Date): Promise<(XRayAppointment & { patient: Patient })[]> {
    const appointments = await getXRayAppointments();
    const dateString = date.toISOString().split('T')[0];
    return appointments.filter(app => app.date.startsWith(dateString));
}

export async function saveXRayAppointment(
  appointmentData: Omit<XRayAppointment, 'id' | 'patientId' | 'patient' | 'status'>,
  patientData: Omit<Patient, 'id'>,
): Promise<XRayAppointment> {
  const patients = await readJsonFile<Patient[]>('patients.json', []);
  const appointments = await readJsonFile<XRayAppointment[]>('x-ray-appointments.json', []);

  let patient = patients.find(p => p.curp.toUpperCase() === patientData.curp.toUpperCase());
  if (!patient) {
      patient = { id: uuidv4(), ...patientData };
      await writeJsonFile('patients.json', [...patients, patient]);
  } else {
      const updatedPatients = patients.map(p => p.id === patient!.id ? { ...patient!, ...patientData } : p);
      await writeJsonFile('patients.json', updatedPatients);
      patient = { ...patient, ...patientData };
  }

  const newAppointment: XRayAppointment = {
      ...appointmentData,
      id: uuidv4(),
      patientId: patient.id,
      patient: patient,
      status: 'Agendada',
  };
  
  await writeJsonFile('x-ray-appointments.json', [...appointments, newAppointment]);

  return newAppointment;
}

export async function deleteXRayAppointment(id: string): Promise<void> {
    const appointments = await readJsonFile<XRayAppointment[]>('x-ray-appointments.json', []);
    const updatedAppointments = appointments.filter(app => app.id !== id);
    await writeJsonFile('x-ray-appointments.json', updatedAppointments);
}


// ========== Ultrasound Appointments ==========
export async function getUltrasoundAppointments(): Promise<(UltrasoundAppointment & { patient: Patient })[]> {
    const appointments = await readJsonFile<UltrasoundAppointment[]>('ultrasound-appointments.json', []);
    return await enrichAppointmentsWithPatients(appointments);
}

export async function getUltrasoundAppointmentsByDate(date: Date): Promise<(UltrasoundAppointment & { patient: Patient })[]> {
    const appointments = await getUltrasoundAppointments();
    const dateString = date.toISOString().split('T')[0];
    return appointments.filter(app => app.date.startsWith(dateString));
}

export async function saveUltrasoundAppointment(
  appointmentData: Omit<UltrasoundAppointment, 'id' | 'patientId' | 'patient' | 'status'>,
  patientData: Omit<Patient, 'id'>,
): Promise<UltrasoundAppointment> {
  const patients = await readJsonFile<Patient[]>('patients.json', []);
  const appointments = await readJsonFile<UltrasoundAppointment[]>('ultrasound-appointments.json', []);

  let patient = patients.find(p => p.curp.toUpperCase() === patientData.curp.toUpperCase());
  if (!patient) {
      patient = { id: uuidv4(), ...patientData };
      await writeJsonFile('patients.json', [...patients, patient]);
  } else {
      const updatedPatients = patients.map(p => p.id === patient!.id ? { ...patient!, ...patientData } : p);
      await writeJsonFile('patients.json', updatedPatients);
      patient = { ...patient, ...patientData };
  }

  const newAppointment: UltrasoundAppointment = {
      ...appointmentData,
      id: uuidv4(),
      patientId: patient.id,
      patient: patient,
      status: 'Agendada',
  };
  
  await writeJsonFile('ultrasound-appointments.json', [...appointments, newAppointment]);

  return newAppointment;
}

export async function deleteUltrasoundAppointment(id: string): Promise<void> {
    const appointments = await readJsonFile<UltrasoundAppointment[]>('ultrasound-appointments.json', []);
    const updatedAppointments = appointments.filter(app => app.id !== id);
    await writeJsonFile('ultrasound-appointments.json', updatedAppointments);
}

// ========== Vaccine Appointments ==========
export async function getVaccineAppointments(): Promise<(VaccineAppointment & { patient: Patient })[]> {
    const appointments = await readJsonFile<VaccineAppointment[]>('vaccine-appointments.json', []);
    return await enrichAppointmentsWithPatients(appointments);
}

export async function getVaccineAppointmentsByDate(date: Date): Promise<(VaccineAppointment & { patient: Patient })[]> {
    const appointments = await getVaccineAppointments();
    const dateString = date.toISOString().split('T')[0];
    return appointments.filter(app => app.date.startsWith(dateString));
}

export async function saveVaccineAppointment(
  appointmentData: Omit<VaccineAppointment, 'id' | 'patientId' | 'patient' | 'status'>,
  patientData: Omit<Patient, 'id'>,
): Promise<VaccineAppointment> {
  const patients = await readJsonFile<Patient[]>('patients.json', []);
  const appointments = await readJsonFile<VaccineAppointment[]>('vaccine-appointments.json', []);

  let patient: Patient | undefined;
  if (!appointmentData.isNewborn) {
      patient = patients.find(p => p.curp.toUpperCase() === patientData.curp.toUpperCase());
  }

  if (!patient) {
      patient = { id: uuidv4(), ...patientData };
      await writeJsonFile('patients.json', [...patients, patient]);
  } else if (!appointmentData.isNewborn) { // If patient exists and not newborn, update their info
      const updatedPatients = patients.map(p => p.id === patient!.id ? { ...patient!, ...patientData } : p);
      await writeJsonFile('patients.json', updatedPatients);
      patient = { ...patient, ...patientData };
  }

  const newAppointment: VaccineAppointment = {
      ...appointmentData,
      id: uuidv4(),
      patientId: patient.id,
      patient: patient,
      status: 'Agendada',
  };
  
  await writeJsonFile('vaccine-appointments.json', [...appointments, newAppointment]);

  return newAppointment;
}

export async function deleteVaccineAppointment(id: string): Promise<void> {
    const appointments = await readJsonFile<VaccineAppointment[]>('vaccine-appointments.json', []);
    const updatedAppointments = appointments.filter(app => app.id !== id);
    await writeJsonFile('vaccine-appointments.json', updatedAppointments);
}

// ========== Universal Patient Search ==========
export async function getPatientByCURP(curp: string): Promise<Patient | null> {
    const upperCurp = curp.toUpperCase();
    const patients = await readJsonFile<Patient[]>('patients.json', []);
    return patients.find(p => p.curp.toUpperCase() === upperCurp) || null;
}

export async function updatePatient(patientId: string, patientData: Partial<Omit<Patient, 'id'>>): Promise<{ success: boolean, data?: Patient, message?: string }> {
    const patients = await readJsonFile<Patient[]>('patients.json', []);
    const patientIndex = patients.findIndex(p => p.id === patientId);

    if (patientIndex === -1) {
        return { success: false, message: 'Patient not found.' };
    }

    // Preserve existing fields not included in patientData
    const updatedPatient = { ...patients[patientIndex], ...patientData };
    patients[patientIndex] = updatedPatient;

    const result = await writeJsonFile('patients.json', patients);
    if (result.success) {
        return { success: true, data: updatedPatient };
    } else {
        return { success: false, message: result.message };
    }
}

export async function updateAppointmentStatus(appointmentId: string, status: AppointmentStatus, type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine'): Promise<{ success: boolean, message?: string }> {
    let filename;
    switch(type) {
        case 'medical': filename = 'appointments.json'; break;
        case 'lab': filename = 'lab-appointments.json'; break;
        case 'xray': filename = 'x-ray-appointments.json'; break;
        case 'ultrasound': filename = 'ultrasound-appointments.json'; break;
        case 'vaccine': filename = 'vaccine-appointments.json'; break;
    }

    const appointments = await readJsonFile<any[]>(filename, []);
    const appointmentIndex = appointments.findIndex(app => app.id === appointmentId);

    if (appointmentIndex === -1) {
        return { success: false, message: 'Cita no encontrada.' };
    }
    
    appointments[appointmentIndex].status = status;

    const result = await writeJsonFile(filename, appointments);
    return result;
}

export async function rescheduleAppointment(
  appointmentId: string,
  newDate: string, // ISO string for the new date
  type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine'
): Promise<{ success: boolean; message: string; newTime?: string }> {
    const filename = `${type === 'medical' ? 'appointments' : type + '-appointments'}.json`;
    const appointments = await readJsonFile<any[]>(filename, []);
    const appointmentIndex = appointments.findIndex(app => app.id === appointmentId);

    if (appointmentIndex === -1) {
        return { success: false, message: 'Cita no encontrada.' };
    }

    const appointmentToReschedule = appointments[appointmentIndex];
    const originalTime = appointmentToReschedule.time;
    const newDateObj = new Date(newDate);
    const newDateString = newDateObj.toISOString().split('T')[0];
    const newDayOfWeek = newDateObj.getDay();
    const isWeekend = newDayOfWeek === 6 || newDayOfWeek === 0; // 6: Sat, 0: Sun
    const dayOfWeekMap: { [key: string]: number } = { "Domingo": 0, "Lunes": 1, "Martes": 2, "Miércoles": 3, "Jueves": 4, "Viernes": 5, "Sábado": 6 };

    // --- Validation Section ---
    if (type === 'medical') {
        const clinics = await getClinics();
        const clinicSettings = clinics.find(c => c.id === appointmentToReschedule.clinicId);
        if (!clinicSettings) return { success: false, message: 'No se encontró la configuración de la clínica.' };

        if (isWeekend && !clinicSettings.weekendBookingEnabled) return { success: false, message: 'No se puede agendar en fin de semana para este núcleo.' };
        if (clinicSettings.unavailableDates?.includes(newDateString)) return { success: false, message: 'La fecha seleccionada no está disponible (periodo vacacional).' };
        if (clinicSettings.dayOfAction && dayOfWeekMap[clinicSettings.dayOfAction] === newDayOfWeek) return { success: false, message: `No se puede agendar en ${clinicSettings.dayOfAction}, es día de acción para este núcleo.` };
    } else {
        let generalSettings: { weekendBookingEnabled: boolean };
        if (type === 'lab') generalSettings = await getLabSettings();
        else if (type === 'xray') generalSettings = await getXRaySettings();
        else if (type === 'ultrasound') generalSettings = await getUltrasoundSettings();
        else if (type === 'vaccine') generalSettings = await getVaccineSettings();
        else return { success: false, message: 'Tipo de cita no válido.' };

        if (isWeekend && !generalSettings.weekendBookingEnabled) return { success: false, message: 'Las citas en fin de semana no están habilitadas para este servicio.' };
    }
    // --- End Validation Section ---

    const appointmentsOnNewDate = appointments.filter(app => app.date.startsWith(newDateString));

    // Special handling for Lab
    if (type === 'lab') {
        const labSettings = await getLabSettings();
        if (appointmentsOnNewDate.length >= labSettings.dailySlots) {
            return { success: false, message: 'No hay cupos disponibles en la nueva fecha para laboratorio.' };
        }
        appointments[appointmentIndex].date = newDateObj.toISOString();
        appointments[appointmentIndex].status = 'Agendada'; // Reset status
        const result = await writeJsonFile(filename, appointments);
        return { success: result.success, message: result.success ? 'Cita reagendada con éxito.' : result.message || 'Error al guardar.' };
    }

    // --- Time Slot Logic for other types ---
    let finalTime = originalTime;
    let bookedTimesOnNewDate: string[];
    let settings: any;
    let interval = 30;

    if (type === 'medical') {
        const clinics = await getClinics();
        settings = clinics.find(c => c.id === appointmentToReschedule.clinicId);
        bookedTimesOnNewDate = appointmentsOnNewDate.filter(app => app.clinicId === settings.id).map(app => app.time);
    } else {
        if (type === 'xray') settings = await getXRaySettings();
        else if (type === 'ultrasound') settings = await getUltrasoundSettings();
        else if (type === 'vaccine') { settings = await getVaccineSettings(); interval = 10; }
        bookedTimesOnNewDate = appointmentsOnNewDate.map(app => app.time);
    }

    if (!settings) {
        return { success: false, message: 'No se encontró la configuración para este servicio.' };
    }

    const isOriginalTimeTaken = bookedTimesOnNewDate.includes(originalTime);

    if (isOriginalTimeTaken) {
        // Find next available slot
        const allPossibleSlots = [];
        const [startHour, startMinute] = settings.startTime.split(':').map(Number);
        const [endHour, endMinute] = settings.endTime.split(':').map(Number);
        let currentHour = startHour;
        let currentMinute = startMinute;

        while (currentHour < endHour || (currentHour === endHour && currentMinute < endMinute)) {
            allPossibleSlots.push(`${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`);
            currentMinute += interval;
            if (currentMinute >= 60) { currentHour++; currentMinute -= 60; }
        }
        
        const limitedSlots = allPossibleSlots.slice(0, settings.dailySlots);
        const availableSlots = limitedSlots.filter(slot => !bookedTimesOnNewDate.includes(slot));
        
        const originalTimeIndex = limitedSlots.indexOf(originalTime);

        if (availableSlots.length === 0) {
            return { success: false, message: 'No hay horarios disponibles en la nueva fecha seleccionada.' };
        }
        
        // Find the first available slot after the original time
        let nextAvailableSlot = availableSlots.find(slot => limitedSlots.indexOf(slot) > originalTimeIndex);
        
        // If no slot is found after, take the first available one
        if (!nextAvailableSlot) {
            nextAvailableSlot = availableSlots[0];
        }
        finalTime = nextAvailableSlot;
    }
    
    // Update appointment
    appointments[appointmentIndex].date = newDateObj.toISOString();
    appointments[appointmentIndex].time = finalTime;
    appointments[appointmentIndex].status = 'Agendada';

    const result = await writeJsonFile(filename, appointments);
    if(result.success) {
        let message = 'La cita ha sido reagendada con éxito.';
        if (finalTime !== originalTime) {
            message = `Horario original ocupado. La cita se reagendó a las ${finalTime}.`;
        }
        return { success: true, message, newTime: finalTime };
    }
    return { success: false, message: result.message || 'No se pudo guardar la cita.' };
}


// ========== Reports Auth ==========
export async function verifyClinicPassword(
  clinicId: string,
  passwordAttempt: string
): Promise<{ isValid: boolean; error?: string }> {
  try {
    const clinics = await getClinics();
    const clinic = clinics.find((c) => c.id === clinicId);

    if (!clinic) {
      return { isValid: false, error: 'El núcleo básico seleccionado no existe.' };
    }

    if (clinic.password === passwordAttempt) {
      return { isValid: true };
    }
    return { isValid: false, error: 'La contraseña es incorrecta.' };
  } catch (error) {
    console.error('Error verifying clinic password', error);
    return {
      isValid: false,
      error: 'Ocurrió un error al verificar la contraseña.',
    };
  }
}

export async function verifyLabPassword(passwordAttempt: string): Promise<{ isValid: boolean; error?: string }> {
    try {
        const settings = await getLabSettings();
        if (settings.password === passwordAttempt) {
            return { isValid: true };
        }
        return { isValid: false, error: 'La contraseña es incorrecta.' };
    } catch (error) {
        console.error('Error verifying Lab password', error);
        return { isValid: false, error: 'Ocurrió un error al verificar la contraseña.' };
    }
}

export async function verifyXRayPassword(passwordAttempt: string): Promise<{ isValid: boolean; error?: string }> {
    try {
        const settings = await getXRaySettings();
        if (settings.password === passwordAttempt) {
            return { isValid: true };
        }
        return { isValid: false, error: 'La contraseña es incorrecta.' };
    } catch (error) {
        console.error('Error verifying X-Ray password', error);
        return { isValid: false, error: 'Ocurrió un error al verificar la contraseña.' };
    }
}

export async function verifyUltrasoundPassword(passwordAttempt: string): Promise<{ isValid: boolean; error?: string }> {
    try {
        const settings = await getUltrasoundSettings();
        if (settings.password === passwordAttempt) {
            return { isValid: true };
        }
        return { isValid: false, error: 'La contraseña es incorrecta.' };
    } catch (error) {
        console.error('Error verifying Ultrasound password', error);
        return { isValid: false, error: 'Ocurrió un error al verificar la contraseña.' };
    }
}

export async function verifyVaccinePassword(passwordAttempt: string): Promise<{ isValid: boolean; error?: string }> {
    try {
        const settings = await getVaccineSettings();
        if (settings.password === passwordAttempt) {
            return { isValid: true };
        }
        return { isValid: false, error: 'La contraseña es incorrecta.' };
    } catch (error) {
        console.error('Error verifying Vaccine password', error);
        return { isValid: false, error: 'Ocurrió un error al verificar la contraseña.' };
    }
}


// ========== Backup & Restore Data ==========
export async function createBackupData(): Promise<any> {
  const allAppointments = await readJsonFile<Appointment[]>('appointments.json', []);
  const allLabAppointments = await readJsonFile<LabAppointment[]>('lab-appointments.json', []);
  const allXRayAppointments = await readJsonFile<XRayAppointment[]>('x-ray-appointments.json', []);
  const allUltrasoundAppointments = await readJsonFile<UltrasoundAppointment[]>('ultrasound-appointments.json', []);
  const allVaccineAppointments = await readJsonFile<VaccineAppointment[]>('vaccine-appointments.json', []);
  const allPatients = await readJsonFile<Patient[]>('patients.json', []);

  return {
    appointments: allAppointments,
    labAppointments: allLabAppointments,
    xRayAppointments: allXRayAppointments,
    ultrasoundAppointments: allUltrasoundAppointments,
    vaccineAppointments: allVaccineAppointments,
    patients: allPatients,
  };
}


export async function restoreBackupData(backupData: any): Promise<{success: boolean, message?: string, stats?: any}> {
  try {
    // Basic validation of backup data structure
    if (!backupData.patients || !backupData.appointments || !backupData.labAppointments || !backupData.xRayAppointments || !backupData.ultrasoundAppointments || !backupData.vaccineAppointments) {
      throw new Error('El archivo de respaldo tiene un formato incorrecto.');
    }
    
    // Simple overwrite
    await writeJsonFile('patients.json', backupData.patients || []);
    await writeJsonFile('appointments.json', backupData.appointments || []);
    await writeJsonFile('lab-appointments.json', backupData.labAppointments || []);
    await writeJsonFile('x-ray-appointments.json', backupData.xRayAppointments || []);
    await writeJsonFile('ultrasound-appointments.json', backupData.ultrasoundAppointments || []);
    await writeJsonFile('vaccine-appointments.json', backupData.vaccineAppointments || []);
    
    const stats = {
        restored: {
            patients: (backupData.patients || []).length,
            appointments: (backupData.appointments || []).length,
            labAppointments: (backupData.labAppointments || []).length,
            xRayAppointments: (backupData.xRayAppointments || []).length,
            ultrasoundAppointments: (backupData.ultrasoundAppointments || []).length,
            vaccineAppointments: (backupData.vaccineAppointments || []).length,
        }
    };

    return { success: true, stats };
  } catch (e: any) {
    console.error('Failed to restore backup', e);
    return { success: false, message: e.message || 'Error al restaurar el respaldo.'};
  }
}

export async function cleanupOldAppointments(): Promise<{deletedCount: number}> {
    const today = new Date();
    const firstDayOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const appointmentFiles = [
        'appointments.json',
        'lab-appointments.json',
        'x-ray-appointments.json',
        'ultrasound-appointments.json',
        'vaccine-appointments.json'
    ];

    let totalDeleted = 0;

    for (const filename of appointmentFiles) {
        const appointments = await readJsonFile<any[]>(filename, []);
        const originalCount = appointments.length;
        const recentAppointments = appointments.filter(app => new Date(app.date) >= firstDayOfCurrentMonth);
        await writeJsonFile(filename, recentAppointments);
        totalDeleted += originalCount - recentAppointments.length;
    }
    
    return { deletedCount: totalDeleted };
}
