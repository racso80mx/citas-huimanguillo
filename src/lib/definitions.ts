import { z } from 'zod';

export type ActivityLog = {
  id: string;
  timestamp: string; // ISO string
  action: string;
  details: string;
};

export type User = {
  id: string; // Firebase UID or generated UUID
  email: string;
  name: string;
  role: 'admin' | 'doctor';
  clinicId?: string; // Only for doctors
  password?: string; // Only for creation/update
};

export enum PatientStatus {
  Vigente = 'Vigente',
  Baja = 'Baja', // Represents Baja Temporal
  BajaDefinitiva = 'Baja Definitiva',
}

export type Patient = {
  id: string; // UUID
  expediente?: string;
  curp: string;
  name: string;
  paternalLastName: string;
  maternalLastName: string;
  birthDate?: string;
  sex: 'Hombre' | 'Mujer';
  age: number;
  birthState: string;
  address?: string;
  coloniaName?: string;
  fatherName?: string;
  motherName?: string;
  fatherAge?: number;
  motherAge?: number;
  registrationDate?: string;
  status?: PatientStatus;
  derechoAbiencia?: string;
  phoneNumber: string;
  lastAppointmentDate?: string;
};

export enum PatientType {
    General = 'General',
    Cronico = 'Crónico',
    Embarazada = 'Embarazada',
    TerceraEdad = '3ra Edad',
    RecienNacido = 'Recién Nacido'
}

export type AppointmentStatus = 'Agendada' | 'Atendido' | 'No Atendido' | 'No Asistió';

export type Appointment = {
  id: string; // UUID
  appointmentNumber: string;
  patientId: string;
  clinicId: string;
  coloniaName?: string;
  date: string; // ISO string for serializability
  time: string; // HH:mm format or "Por Ficha" or "Espera X"
  duration?: number; // Duration in minutes at the time of booking
  patientType: PatientType;
  status: AppointmentStatus;
  patient: Patient;
  isNewborn?: boolean;
  createdAt?: string; // ISO date of creation
};

export enum ClinicType {
    ConsultaExterna = 'Consulta Externa',
    Especializada = 'Consulta Externa Especializada',
    Psicologia = 'Psicología',
    Nutricion = 'Nutrición',
    Odontologia = 'Odontología',
}

export enum BookingMode {
    Time = 'time',
    Token = 'token'
}

export const ClinicSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "El nombre es requerido."),
  doctorName: z.string().min(1, "El nombre del doctor es requerido."),
  password: z.string().min(1, "La contraseña es requerida."),
  dailySlots: z.number().min(1, "Debe haber al menos 1 cita."),
  waitlistSlots: z.number().default(0),
  startTime: z.string(),
  endTime: z.string(),
  breakTime: z.string().optional(),
  weekendBookingEnabled: z.boolean(),
  daysOfAction: z.array(z.string()).optional(),
  unavailableDates: z.array(z.string()).optional(),
  clinicType: z.nativeEnum(ClinicType),
  bookingMode: z.nativeEnum(BookingMode),
  consultationDuration: z.number().min(1).optional(),
}).refine(data => {
    if (data.bookingMode === BookingMode.Time && (data.consultationDuration ?? 0) <= 0) {
        return false;
    }
    return true;
}, {
    message: "La duración de la consulta es requerida para el modo de horario.",
    path: ["consultationDuration"],
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
  takenTimesByClinic: { [key: string]: any[] }; // Changed to support time range objects
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

export const LabStudySchema = z.object({
    id: z.string(),
    code: z.string().optional(),
    section: z.string().min(1, 'La sección es requerida.'),
    name: z.string().min(1, 'El nombre es requerido.'),
    sampleType: z.string().min(1, 'El tipo de muestra es requerido.'),
    fastingHours: z.string(),
    available: z.boolean(),
});
export type LabStudy = z.infer<typeof LabStudySchema>;


export type LabAppointment = {
    id: string;
    appointmentNumber: string;
    patientId: string;
    date: string; // ISO string
    time: string; // HH:mm or "Espera X"
    studies: LabStudy[];
    status: AppointmentStatus;
    patient: Patient;
    patientType: PatientType;
    createdAt?: string;
}

export type LabSettings = {
    dailySlots: number;
    waitlistSlots: number;
    weekendBookingEnabled: boolean;
    password?: string;
}

export const XRayStudySchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'El nombre del estudio es requerido.'),
  indications: z.string().min(1, 'Las indicaciones son requeridas.'),
  available: z.boolean(),
});
export type XRayStudy = z.infer<typeof XRayStudySchema>;


export type XRayAppointment = {
    id: string;
    appointmentNumber: string;
    patientId: string;
    date: string; // ISO string
    time: string; // HH:mm or "Espera X"
    studyId: string;
    studyName: string;
    status: AppointmentStatus;
    patient: Patient;
    patientType: PatientType;
    createdAt?: string;
}

export type XRaySettings = {
    dailySlots: number;
    waitlistSlots: number;
    startTime: string;
    endTime: string;
    weekendBookingEnabled: boolean;
    password?: string;
}

export const UltrasoundStudySchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'El nombre del estudio es requerido.'),
  indications: z.string().min(1, 'Las indicaciones son requeridas.'),
  available: z.boolean(),
});
export type UltrasoundStudy = z.infer<typeof UltrasoundStudySchema>;

export type UltrasoundAppointment = {
    id: string;
    appointmentNumber: string;
    patientId: string;
    date: string; // ISO string
    time: string; // HH:mm or "Espera X"
    studyId: string;
    studyName: string;
    status: AppointmentStatus;
    patient: Patient;
    patientType: PatientType;
    createdAt?: string;
}

export type UltrasoundSettings = {
    dailySlots: number;
    waitlistSlots: number;
    startTime: string;
    endTime: string;
    weekendBookingEnabled: boolean;
    password?: string;
}

export const VaccineSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "El nombre es requerido"),
  applicationAge: z.string(),
  sex: z.string(),
  description: z.string().min(1, "La descripción es requerida."),
  available: z.boolean(),
});
export type Vaccine = z.infer<typeof VaccineSchema>;


export type VaccineAppointment = {
  id: string;
  appointmentNumber: string;
  patientId: string; // Can be a temporary ID for newborns
  date: string;
  time: string;
  clinicId?: string; // Optional for newborns
  coloniaName?: string;
  vaccines: Vaccine[];
  status: AppointmentStatus;
  patient: Patient; // Patient data might be partial for newborns
  patientType: PatientType;
  createdAt?: string;
};

export type VaccineSettings = {
  dailySlots: number;
  waitlistSlots: number;
  startTime: string;
  endTime: string;
  weekendBookingEnabled: boolean;
  password?: string;
};


export type ModuleSettings = {
  citasMedicasEnabled: boolean;
  laboratorioEnabled: boolean;
  rayosXEnabled: boolean;
  ultrasoundEnabled: boolean;
  vacunasEnabled: boolean;
  archivoEnabled: boolean;
  farmaciaEnabled: boolean;
  archivoConsultaEnabled: boolean;
  citasMedicasPassword?: string;
  archivoConsultaPassword?: string;
};

export type ArchiveSettings = {
    password?: string;
}

export type PharmacySettings = {
    password?: string;
}

export type BISettings = {
    password?: string;
}

export type AdminSettings = {
    password?: string;
}

export type ArchiveCounts = {
  total: number;
  vigente: number;
  bajaTemporal: number;
  bajaDefinitiva: number;
};

export type Medication = {
  id: string;
  claveCuadroBasico: string;
  descripcion: string;
  grupo: string;
  existencia: number;
  precioUnitario: number;
  totalImporte: number;
  lote: string;
  proveedor: string;
  rfcProveedor: string;
  almacen: string;
  fuenteFinanciamiento: string;
  fechaCaducidad: string;
  ordenSuministro: string;
  tipoInsumo: string;
  numeroContrato: string;
  updatedAt?: string;
};

export type Holiday = {
  date: string; // YYYY-MM-DD
  name: string;
};
