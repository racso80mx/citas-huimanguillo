'use server';

import { revalidatePath } from 'next/cache';
import {
  appointments,
  dailySlotsPerConsultorio,
  addAppointment as saveData,
  getAppointments as getDataAppointments,
  deleteAppointment as deleteDataAppointment,
  getAnnouncements as getDataAnnouncements,
  updateAnnouncements as updateDataAnnouncements,
  getSlotsConfiguration as getDataSlots,
  updateSlotsConfiguration as updateDataSlots,
} from './data';
import type { Appointment, DailyAvailability } from './definitions';
import { getISODay } from 'date-fns';

export async function getAvailability(year: number, month: number) {
  const startDate = new Date(Date.UTC(year, month, 1));
  const endDate = new Date(Date.UTC(year, month + 1, 0));

  const allAppointments = await getDataAppointments();
  const currentSlotsConfig = await getDataSlots();

  const monthAppointments = allAppointments.filter((app) => {
    const appDate = new Date(app.date);
    return appDate >= startDate && appDate <= endDate;
  });

  const availability: DailyAvailability[] = [];

  for (
    let day = new Date(startDate);
    day <= endDate;
    day.setDate(day.getDate() + 1)
  ) {
    const dateString = day.toISOString().split('T')[0];
    const appointmentsOnDate = monthAppointments.filter(
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
  const { date, curp, consultorio } = data;
  const dateString = new Date(date).toISOString().split('T')[0];

  const allAppointments = await getDataAppointments();

  const appointmentsOnDate = allAppointments.filter(
    (app) => app.date.split('T')[0] === dateString
  );

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

  const newAppointment = {
    ...data,
    id: new Date().toISOString() + Math.random(),
  };

  saveData(newAppointment);

  revalidatePath('/');
  revalidatePath('/admin');

  return { success: true, message: 'Cita agendada con éxito.' };
}

export async function getAppointments() {
  return getDataAppointments();
}

export async function deleteAppointment(id: string) {
  deleteDataAppointment(id);
  revalidatePath('/');
  revalidatePath('/admin');
  return { success: true, message: 'Cita eliminada con éxito.' };
}

export async function getAnnouncements() {
  return getDataAnnouncements();
}

export async function updateAnnouncements(newAnnouncements: string[]) {
  updateDataAnnouncements(newAnnouncements);
  revalidatePath('/');
  revalidatePath('/admin');
  return { success: true, message: 'Avisos actualizados con éxito.' };
}

export async function getSlotsConfiguration() {
  return getDataSlots();
}

export async function updateSlotsConfiguration(newConfig: {
  [key: number]: number;
}) {
  const success = updateDataSlots(newConfig);
  if (success) {
    revalidatePath('/admin');
    revalidatePath('/');
    return { success: true, message: 'Configuración de cupos actualizada.' };
  }
  return { success: false, message: 'No se pudo guardar la configuración.' };
}
