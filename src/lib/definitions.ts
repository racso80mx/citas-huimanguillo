export type Appointment = {
  id: string;
  date: string; // Using ISO string for serializability
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
};

export type DailyAvailability = {
  date: string; // YYYY-MM-DD
  totalSlots: number;
  bookedSlots: number;
  availableSlots: number;
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
  nombre: string;
};
