'use server';

import { revalidatePath } from 'next/cache';
import {
  addAppointment as saveData,
  getAppointments as getDataAppointments,
  getAppointmentsByDate,
  deleteAppointment as deleteDataAppointment,
  updateAnnouncements as updateDataAnnouncements,
  updateSlotsConfiguration as updateDataSlots,
  updateWeekendBookingConfig as updateDataWeekendBooking,
  updateColonias as updateDataColonias,
} from './data';
import type { Appointment, WeekendBookingConfig, Colonia } from './definitions';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

export async function bookAppointment(data: Omit<Appointment, 'id' | 'appointmentNumber'>) {
  const { date, time, curp, consultorio } = data;
  
  const appointmentsOnDate = await getAppointmentsByDate(new Date(date));

  // Check if the specific time slot is already taken
  const isTimeSlotTaken = appointmentsOnDate.some(
    app => app.consultorio === consultorio && app.time === time
  );

  if (isTimeSlotTaken) {
    return {
      success: false,
      message: `El horario de ${time} ya no está disponible. Por favor, selecciona otro.`,
    };
  }

  // This check is now mostly redundant because UI should prevent this, but it's good server-side validation
  // const currentSlotsConfig = await getDataSlots();
  // const slotsForConsultorio = currentSlotsConfig[consultorio] || 0;
  // const appointmentsInConsultorio = appointmentsOnDate.filter(
  //   (app) => app.consultorio === consultorio
  // );
  // if (appointmentsInConsultorio.length >= slotsForConsultorio) {
  //   return {
  //     success: false,
  //     message: `No hay citas disponibles para el consultorio ${consultorio} en este día.`,
  //   };
  // }


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
  
  const newAppointmentId = uuidv4();
  // Folio generation needs to be robust. Let's get the count for the specific clinic on that day.
  const appointmentsInConsultorio = appointmentsOnDate.filter(
    (app) => app.consultorio === consultorio
  );
  const consecutive = appointmentsInConsultorio.length + 1;
  const appointmentNumber = `${format(new Date(date), 'ddMMyy')}-${consultorio}-${consecutive}`;
  
  const newAppointment: Appointment = {
      ...data,
      id: newAppointmentId,
      appointmentNumber,
  }

  const docId = await saveData(newAppointment);

  if (!docId) {
     return { success: false, message: 'No se pudo guardar la cita en la base de datos.' };
  }

  revalidatePath('/');
  revalidatePath('/admin');

  return { success: true, message: 'Cita agendada con éxito.', appointmentId: docId, appointmentNumber };
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

export async function updateAnnouncements(newAnnouncements: string[]) {
  await updateDataAnnouncements(newAnnouncements);
  revalidatePath('/');
  revalidatePath('/admin');
  return { success: true, message: 'Avisos actualizados con éxito.' };
}

export async function updateSlotsConfiguration(newConfig: {
  [key: number]: number;
}) {
  // Ensure no value is greater than 15
  for(const key in newConfig) {
      if(newConfig[key] > 15) {
          return { success: false, message: 'El número máximo de cupos por consultorio no puede ser mayor a 15.' };
      }
  }

  const success = await updateDataSlots(newConfig);
  if (success) {
    revalidatePath('/admin');
    revalidatePath('/');
    return { success: true, message: 'Configuración de cupos actualizada.' };
  }
  return { success: false, message: 'No se pudo guardar la configuración.' };
}

export async function updateWeekendBooking(config: WeekendBookingConfig) {
    const success = await updateDataWeekendBooking(config);
    if(success) {
        revalidatePath('/admin');
        revalidatePath('/');
        return { success: true, message: "Configuración de fin de semana actualizada."}
    }
    return { success: false, message: "No se pudo guardar la configuración."}
}

export async function updateColonias(colonias: Colonia[]) {
    const success = await updateDataColonias(colonias);
    if(success) {
        revalidatePath('/admin');
        revalidatePath('/');
        return { success: true, message: "Colonias actualizadas con éxito." }
    }
    return { success: false, message: "No se pudo guardar la configuración de colonias." }
}
