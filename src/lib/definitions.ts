'use client';
import { z } from 'zod';

export type User = {
  id: string; // Firebase UID
  email: string;
  name: string;
  role: 'admin';
};

export type Patient = {
  id: string; // UUID
  curp: string;
  name: string;
  paternalLastName: string;
  maternalLastName: string;
  sex: 'Hombre' | 'Mujer';
  age: number;
  birthState: string;
  phoneNumber: string;
};

export enum PatientType {
    General = 'General',
    Cronico = 'Crónico',
    Embarazada = 'Embarazada',
    TerceraEdad = '3ra Edad'
}

export type Appointment = {
  id: string; // UUID
  appointmentNumber: string;
  patientId: string;
  clinicId: string;
  date: string; // ISO string for serializability
  time: string; // HH:mm format
  patientType: PatientType;
  patient: Omit<Patient, 'id'>; 
};

export const ClinicSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "El nombre es requerido."),
  doctorName: z.string().min(1, "El nombre del doctor es requerido."),
  password: z.string().min(1, "La contraseña es requerida."),
  dailySlots: z.number().min(1, "Debe haber al menos 1 cita."),
  startTime: z.string(),
  endTime: z.string(),
  weekendBookingEnabled: z.boolean(),
});

export type Clinic = z.infer<typeof ClinicSchema>;

export type Colonia = {
  id: string; // UUID
  name: string;
  clinicId: string;
};

export type DailyAvailability = {
  date: string; // YYYY-MM-DD
  availableSlots: number;
  availabilityByClinic: { [key: string]: number };
  takenTimesByClinic: { [key: string]: string[] };
};

export type Report = {
    id: string;
    clinicId: string;
    date: string; // YYYY-MM-DD
    totalAppointments: number;
    attended: number;
    pending: number;
    cancelled: number;
}

export type LabStudy = {
    id: string;
    section: string;
    name: string;
    sampleType: string;
    fastingHours: string;
    available: boolean;
}

export type LabAppointment = {
    id: string;
    appointmentNumber: string;
    patient: Omit<Patient, 'id'>;
    date: string; // ISO string
    time: string; // HH:mm
    studies: LabStudy[];
}

export type LabSettings = {
    dailySlots: number;
    weekendBookingEnabled: boolean;
}

export type XRayStudy = {
    id: string;
    name: string;
    indications: string;
    available: boolean;
}

export type XRayAppointment = {
    id: string;
    appointmentNumber: string;
    patient: Omit<Patient, 'id'>;
    date: string; // ISO string
    time: string; // HH:mm
    studyId: string;
    studyName: string;
}

export type XRaySettings = {
    dailySlots: number;
    startTime: string;
    endTime: string;
    weekendBookingEnabled: boolean;
}
