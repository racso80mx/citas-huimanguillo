export type Appointment = {
  id: string;
  date: string; // Using ISO string for serializability
  time: string; // HH:mm format
  consultorio: number;
  curp: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  sexo: 'Hombre' | 'Mujer';
  edad: number;
  estadoNacimiento: string;
  municipio: string;
  colonia: string;
  otraColonia?: string;
  telefono: string;
  appointmentNumber: string;
};

export type DailyAvailability = {
  date: string; // YYYY-MM-DD
  availableSlots: number;
  availabilityByConsultorio: { [key: number]: number };
  takenTimesByConsultorio: { [key: number]: string[] };
};

export type Estado = {
  clave: string;
  nombre: string;
};

export type Municipio = {
  clave: string;
  nombre: string;
};

export type Colonia = {
  id: string;
  nombre: string;
  nucleo: number;
};

export type WeekendBookingConfig = {
    enabled: boolean;
}
