'use client';
import {
  getAppointments,
  getLabAppointments,
  getXRayAppointments,
  getUltrasoundAppointments,
  getVaccineAppointments,
  deleteAppointment,
  deleteLabAppointment,
  deleteXRayAppointment,
  deleteUltrasoundAppointment,
  deleteVaccineAppointment,
  getAppointmentsForClinic,
  getClinics,
} from './actions';

// This file is intended for client-side components to import server actions,
// ensuring a clear boundary between client and server logic.
// All functions here are re-exports of server actions.

export {
  getAppointments,
  getLabAppointments,
  getXRayAppointments,
  getUltrasoundAppointments,
  getVaccineAppointments,
  deleteAppointment,
  deleteLabAppointment,
  deleteXRayAppointment,
  deleteUltrasoundAppointment,
  deleteVaccineAppointment,
  getAppointmentsForClinic,
  getClinics,
};
