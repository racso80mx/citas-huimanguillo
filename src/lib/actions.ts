'use server';

import { revalidatePath } from 'next/cache';
import {
  addAppointment as saveData,
  getAppointments as getDataAppointments,
  getAppointmentsByDate,
  deleteAppointment as deleteDataAppointment,
  getAnnouncements as getDataAnnouncements,
  updateAnnouncements as updateDataAnnouncements,
  getSlotsConfiguration as getDataSlots,
  updateSlotsConfiguration as updateDataSlots,
} from './data';
import type { Appointment, DailyAvailability } from './definitions';
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';


export async function getAvailability(year: number, month: number) {
  const startDate = startOfMonth(new Date(year, month));
  const endDate = endOfMonth(new Date(year, month));

  const allAppointments = await getDataAppointments();
  const currentSlotsConfig = await getDataSlots();

  const availability: DailyAvailability[] = [];

  const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });

  for (const day of daysInMonth) {
    const dateString = day.toISOString().split('T')[0];
    const appointmentsOnDate = allAppointments.filter(
      (app) => app.date.split('T')[0] === dateString
    );

    let totalAvailableSlots = 0;
    const availabilityByConsultorio: { [key: number]: number } = {};

    for (const consultorioId in currentSlotsConfig) {
      const id = parseInt(consultorioId);
      const maxSlots = currentSlotsConfig[id] || 0;
      const bookedSlots = appointmentsOnDate.filter(
        (app) => app.consultorio === id
      ).length;
      const available = Math.max(0, maxSlots - bookedSlots);
      availabilityByConsultorio[id] = available;
      totalAvailableSlots += available;
    }

    availability.push({
      date: dateString,
      availableSlots: totalAvailableSlots,
      availabilityByConsultorio: availabilityByConsultorio,
    });
  }

  return availability;
}

export async function bookAppointment(data: Omit<Appointment, 'id'>) {
  const { date, curp, consultorio, estadoNacimiento } = data;
  
  const appointmentsOnDate = await getAppointmentsByDate(new Date(date));

  const currentSlotsConfig = await getDataSlots();
  const slotsForConsultorio = currentSlotsConfig[consultorio] || 0;

  const appointmentsInConsultorio = appointmentsOnDate.filter(
    (app) => app.consultorio === consultorio
  );

  if (appointmentsInConsultorio.length >= slotsForConsultorio) {
    return {
      success: false,
      message: `No hay citas disponibles para el consultorio ${consultorio} en este día.`,
    };
  }

  const curpExistsOnDate = appointmentsOnDate.some(
    (app) => app.curp.toUpperCase() === curp.toUpperCase()
  );

  if (curpExistsOnDate) {
    return {
      success: false,
      message:
        'Ya existe una cita agendada con esta CURP para el día seleccionado.',
    };
  }

  const newAppointment: Appointment = {
      ...data,
      id: uuidv4(),
      municipio: estadoNacimiento === 'TABASCO' ? data.municipio : data.municipio || 'NA',
      colonia: (estadoNacimiento === 'TABASCO' && data.municipio === 'Huimanguillo') ? data.colonia || 'No especificada' : data.colonia || 'NA'
  }

  const docId = await saveData(newAppointment);

  if (!docId) {
     return { success: false, message: 'No se pudo guardar la cita en la base de datos.' };
  }

  revalidatePath('/');
  revalidatePath('/admin');

  return { success: true, message: 'Cita agendada con éxito.' };
}

export async function getAppointments() {
  return await getDataAppointments();
}

export async function deleteAppointment(id: string) {
  await deleteDataAppointment(id);
  revalidatePath('/');
  revalidatePath('/admin');
  return { success: true, message: 'Cita eliminada con éxito.' };
}

export async function getAnnouncements() {
  return await getDataAnnouncements();
}

export async function updateAnnouncements(newAnnouncements: string[]) {
  await updateDataAnnouncements(newAnnouncements);
  revalidatePath('/');
  revalidatePath('/admin');
  return { success: true, message: 'Avisos actualizados con éxito.' };
}

export async function getSlotsConfiguration() {
  return await getDataSlots();
}

export async function updateSlotsConfiguration(newConfig: {
  [key: number]: number;
}) {
  const success = await updateDataSlots(newConfig);
  if (success) {
    revalidatePath('/admin');
    revalidatePath('/');
    return { success: true, message: 'Configuración de cupos actualizada.' };
  }
  return { success: false, message: 'No se pudo guardar la configuración.' };
}
