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
  status: 'Pendiente' | 'Atendida' | 'Cancelada';
  patient: Omit<Patient, 'id'>; // Denormalized for easy display
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
