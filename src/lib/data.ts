import type { Appointment } from './definitions';
import { subDays, format } from 'date-fns';

export const DAILY_SLOTS = 25; // 5 consultorios

export let appointments: Appointment[] = [
    {
        id: '1',
        date: subDays(new Date(), 2).toISOString(),
        consultorio: 1,
        curp: 'AAAA010101HAAAAA01',
        nombre: 'Juan',
        apellidoPaterno: 'Perez',
        apellidoMaterno: 'Gomez',
        sexo: 'Hombre',
        edad: 23,
        estadoNacimiento: 'TABASCO',
        municipio: 'Centro',
        colonia: 'Centro',
        telefono: '9999999999',
    },
    {
        id: '2',
        date: subDays(new Date(), 1).toISOString(),
        consultorio: 3,
        curp: 'BBBB020202MBBBBB02',
        nombre: 'Maria',
        apellidoPaterno: 'Lopez',
        apellidoMaterno: 'Hernandez',
        sexo: 'Mujer',
        edad: 45,
        estadoNacimiento: 'CHIAPAS',
        municipio: 'N/A',
        colonia: 'N/A',
        telefono: '9999999998',
    }
];

// Fill one day to be fully booked for demonstration
const fullDay = subDays(new Date(), 5);
for (let i = 0; i < DAILY_SLOTS; i++) {
    appointments.push({
        id: `full-day-${i}`,
        date: fullDay.toISOString(),
        consultorio: (i % 5) + 1,
        curp: `XXXX${String(i).padStart(2,'0')}0101HXXXXX0${i%10}`,
        nombre: `Persona`,
        apellidoPaterno: `${i+1}`,
        apellidoMaterno: 'Demo',
        sexo: 'Hombre',
        edad: 30,
        estadoNacimiento: 'TABASCO',
        municipio: 'Huimanguillo',
        colonia: 'Centro',
        telefono: '9999999997',
    });
}


export const addAppointment = (appointment: Appointment) => {
  appointments.push(appointment);
};

export const getAppointments = () => {
    return appointments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
