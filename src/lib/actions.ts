'use server';

import { revalidatePath } from 'next/cache';
import {
  appointments,
  announcements,
  DAILY_SLOTS,
  addAppointment as saveData,
  getAppointments as getDataAppointments,
  deleteAppointment as deleteDataAppointment,
  getAnnouncements as getDataAnnouncements,
  updateAnnouncements as updateDataAnnouncements,
} from './data';
import type { Appointment } from './definitions';

export async function getAvailability(year: number, month: number) {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0);

  const monthAppointments = appointments.filter((app) => {
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
    const bookedSlots = monthAppointments.filter(
      (app) => app.date.split('T')[0] === dateString
    ).length;
    const availableSlots = DAILY_SLOTS - bookedSlots;

    availability.push({
      date: dateString,
      totalSlots: DAILY_SLOTS,
      bookedSlots: bookedSlots,
      availableSlots: availableSlots > 0 ? availableSlots : 0,
    });
  }

  return availability;
}

export async function bookAppointment(data: Omit<Appointment, 'id'>) {
  const { date, curp } = data;
  const dateString = new Date(date).toISOString().split('T')[0];

  const appointmentsOnDate = appointments.filter(
    (app) => app.date.split('T')[0] === dateString
  );

  if (appointmentsOnDate.length >= DAILY_SLOTS) {
    return { success: false, message: 'No hay citas disponibles para este día.' };
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
  return { success: true, message: 'Avisos actualizados con éxito.' };
}
