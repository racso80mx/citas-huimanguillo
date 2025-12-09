'use server';

import fs from 'fs/promises';
import path from 'path';

// Import static data
import clinicsData from './data/clinics.json';
import coloniasData from './data/colonias.json';
import announcementsData from './data/announcements.json';
import type { Clinic, Colonia } from './definitions';

// =======================
// JSON File Operations
// =======================
const dataFilePath = (filename: string) => path.join(process.cwd(), 'src', 'lib', 'data', filename);

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
  // Read from static JSON file
  return announcementsData.messages;
};

export const updateAnnouncements = async (
  newAnnouncements: string[]
): Promise<{ success: boolean; message?: string }> => {
  const data = { messages: newAnnouncements.slice(0, 4) };
  // Write to static file (for next server start)
  await writeJsonFile('announcements.json', data);
  // Also write to Firestore or other persistent storage if needed, but the primary source for the app is now the JSON
  return { success: true };
};

// ========== Clinics Configuration ==========

export async function getClinics(): Promise<Clinic[]> {
  // Read from static JSON file
  return clinicsData as Clinic[];
}

export async function updateClinics(
  clinics: Clinic[]
): Promise<{ success: boolean; message?: string }> {
  // Write to static file (for next server start)
  await writeJsonFile('clinics.json', clinics);
  return { success: true };
}

// ========== Colonias Configuration ==========

export async function getColonias(): Promise<Colonia[]> {
  // Read from static JSON file
  return coloniasData as Colonia[];
}

export async function updateColonias(
  colonias: Colonia[]
): Promise<{ success: boolean; message?: string }> {
    // Write to static file
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
