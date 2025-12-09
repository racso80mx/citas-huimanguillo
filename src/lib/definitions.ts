export type User = {
  id: string; // Firebase UID
  email: string;
  name: string;
  role: 'admin' | 'doctor';
  clinicId?: string; // For doctor role
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

export type Clinic = {
  id: string; // UUID, e.g. "NB1"
  name: string; // e.g. "Núcleo Básico 1"
  doctorName: string;
  dailySlots: number;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  weekendBookingEnabled: boolean;
};

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
