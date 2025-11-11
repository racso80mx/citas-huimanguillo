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
};

export type DailyAvailability = {
  date: string; // YYYY-MM-DD
  totalSlots: number;
  bookedSlots: number;
  availableSlots: number;
};
