'use server';

import fs from 'fs/promises';
import path from 'path';
import type { Clinic, Colonia, LabSettings, LabStudy, XRaySettings, XRayStudy, UltrasoundSettings, UltrasoundStudy, Appointment } from './definitions';
// We import from data-server because this file contains server-side logic (reading files) that could be used by server actions.
import { getAppointmentsByDate, getLabAppointmentsByDate, getXRayAppointmentsByDate, getUltrasoundAppointmentsByDate } from './data-server';

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
        console.warn(`Writing to static file ${filename}. A server restart is required for changes to take effect in the UI.`);
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

// Re-export server-side date filtering functions
export { getAppointmentsByDate, getLabAppointmentsByDate, getXRayAppointmentsByDate, getUltrasoundAppointmentsByDate };