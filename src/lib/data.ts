import type { Appointment } from './definitions';
import { subDays, startOfDay } from 'date-fns';

export let dailySlotsPerConsultorio: { [key: number]: number } = {
    1: 5,
    2: 5,
    3: 5,
    4: 5,
    5: 5,
    6: 5,
};


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
const fullDay = startOfDay(subDays(new Date(), 5));
const fullDayString = fullDay.toISOString().split('T')[0];

const consultorios = Object.keys(dailySlotsPerConsultorio).map(Number);
for(const consultorio of consultorios) {
    for(let i=0; i<dailySlotsPerConsultorio[consultorio]; i++) {
        appointments.push({
             id: `full-day-${consultorio}-${i}`,
            date: fullDay.toISOString(),
            consultorio: consultorio,
            curp: `XXXX${String(i).padStart(2,'0')}${consultorio}01HXXXXX${i%10}`,
            nombre: `Persona`,
            apellidoPaterno: `${i+1}`,
            apellidoMaterno: `DemoC${consultorio}`,
            sexo: 'Hombre',
            edad: 30,
            estadoNacimiento: 'TABASCO',
            municipio: 'Huimanguillo',
            colonia: 'Centro',
            telefono: '9999999997',
        })
    }
}


export let announcements: string[] = [
    "Recuerda traer tu cartilla de vacunación.",
    "El uso de cubrebocas es opcional en las instalaciones.",
];


export const addAppointment = (appointment: Appointment) => {
  appointments.push(appointment);
};

export const getAppointments = () => {
    return appointments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export const deleteAppointment = (id: string) => {
    appointments = appointments.filter(app => app.id !== id);
}

export const getAnnouncements = () => {
    return announcements;
}

export const updateAnnouncements = (newAnnouncements: string[]) => {
    announcements = newAnnouncements.slice(0, 4); // Max 4 announcements
    return true;
}

export const getSlotsConfiguration = () => {
    return dailySlotsPerConsultorio;
}

export const updateSlotsConfiguration = (newConfig: { [key: number]: number }) => {
    dailySlotsPerConsultorio = newConfig;
    return true;
}
