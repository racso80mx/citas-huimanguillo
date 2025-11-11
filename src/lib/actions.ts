'use server';

import { revalidatePath } from 'next/cache';
import {
  appointments,
  dailySlotsPerConsultorio,
  getTotalDailySlots,
  addAppointment as saveData,
  getAppointments as getDataAppointments,
  deleteAppointment as deleteDataAppointment,
  getAnnouncements as getDataAnnouncements,
  updateAnnouncements as updateDataAnnouncements,
  getSlotsConfiguration as getDataSlots,
  updateSlotsConfiguration as updateDataSlots,
} from './data';
import type { Appointment } from './definitions';

export async function getAvailability(year: number, month: number) {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0);
  
  const allAppointments = await getDataAppointments();

  const monthAppointments = allAppointments.filter((app) => {
    const appDate = new Date(app.date);
    return appDate >= startDate && appDate <= endDate;
  });

  const availability = [];
  
  for (
    let day = new Date(startDate);
    day <= endDate;
    day.setDate(day.getDate() + 1)
  ) {
    const dateString = day.toISOString().split('T')[0];
    const TOTAL_DAILY_SLOTS = getTotalDailySlots();
    const bookedSlots = monthAppointments.filter(
      (app) => app.date.split('T')[0] === dateString
    ).length;
    const availableSlots = TOTAL_DAILY_SLOTS - bookedSlots;

    availability.push({
      date: dateString,
      totalSlots: TOTAL_DAILY_SLOTS,
      bookedSlots: bookedSlots,
      availableSlots: availableSlots > 0 ? availableSlots : 0,
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
  
  // This should fetch the current config
  const currentSlotsConfig = await getDataSlots();
  const slotsForConsultorio = currentSlotsConfig[consultorio] || 0;
  
  const appointmentsInConsultorio = appointmentsOnDate.filter(app => app.consultorio === consultorio);

  if (appointmentsInConsultorio.length >= slotsForConsultorio) {
    return { success: false, message: `No hay citas disponibles para el consultorio ${consultorio} en este día.` };
  }
  
  const curpExistsOnDate = appointmentsOnDate.some(
    (app) => app.curp.toUpperCase() === curp.toUpperCase()
  );

  if (curpExistsOnDate) {
     return { success: false, message: 'Ya existe una cita agendada con esta CURP para el día seleccionado.' };
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

export async function updateSlotsConfiguration(newConfig: { [key: number]: number }) {
    const success = updateDataSlots(newConfig);
    if (success) {
      revalidatePath('/admin');
      revalidatePath('/');
      return { success: true, message: 'Configuración de cupos actualizada.' };
    }
     return { success: false, message: 'No se pudo guardar la configuración.' };
}
