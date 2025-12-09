'use server';

import fs from 'fs/promises';
import path from 'path';
import type { Clinic, Colonia } from './definitions';

// =======================
// JSON File Operations
// =======================
const dataFilePath = (filename: string) => path.join(process.cwd(), 'src', 'lib', 'data', filename);

async function readJsonFile<T>(filename: string, defaultValue: T): Promise<T> {
  try {
    const filePath = dataFilePath(filename);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return default value
      return defaultValue;
    }
    console.error(`Failed to read static file ${filename}`, error);
    // In case of other errors, return the default value to avoid crashing
    return defaultValue;
  }
}

async function writeJsonFile(filename: string, data: any): Promise<void> {
    try {
        console.warn(`Writing to static file ${filename}. A server restart is required for changes to take effect in the booking UI.`);
        await fs.writeFile(dataFilePath(filename), JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
        console.error(`Failed to write to static file ${filename}`, e);
        // This is a dev-time convenience, so we don't throw an error in production
    }
}


// ========== Announcements ==========

export const getAnnouncements = async (): Promise<string[]> => {
  const data = await readJsonFile<{ messages: string[] }>('announcements.json', { messages: [] });
  return data.messages;
};

// This function is now a Server Action called from the admin panel.
export const updateAnnouncements = async (
  newAnnouncements: string[]
): Promise<{ success: boolean; message?: string }> => {
  const data = { messages: newAnnouncements.slice(0, 4) };
  await writeJsonFile('announcements.json', data);
  return { success: true };
};

// ========== Clinics Configuration ==========

export async function getClinics(): Promise<Clinic[]> {
  const clinics = await readJsonFile<Clinic[]>('clinics.json', []);
  return clinics;
}

// This function is now a Server Action called from the admin panel.
export async function updateClinics(
  clinics: Clinic[]
): Promise<{ success: boolean; message?: string }> {
  await writeJsonFile('clinics.json', clinics);
  return { success: true };
}

// ========== Colonias Configuration ==========

export async function getColonias(): Promise<Colonia[]> {
  const colonias = await readJsonFile<Colonia[]>('colonias.json', []);
  return colonias;
}

// This function is now a Server Action called from the admin panel.
export async function updateColonias(
  colonias: Colonia[]
): Promise<{ success: boolean; message?: string }> {
    await writeJsonFile('colonias.json', colonias);
    return { success: true };
}

// ========== Reports Auth ==========
export async function verifyClinicPassword(
  clinicId: string,
  passwordAttempt: string
): Promise<{ isValid: boolean; error?: string }> {
  try {
    const clinics = await getClinics(); // Reads from JSON now
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
