'use server';
import React from 'react';
import { BIDashboard } from '@/components/bi/dashboard';
import { getBIData } from '@/lib/actions';
import type { Appointment, LabAppointment, XRayAppointment, UltrasoundAppointment, VaccineAppointment, Clinic, Colonia } from '@/lib/definitions';

export type BIData = {
  appointments: Appointment[];
  labAppointments: LabAppointment[];
  xRayAppointments: XRayAppointment[];
  ultrasoundAppointments: UltrasoundAppointment[];
  vaccineAppointments: VaccineAppointment[];
  clinics: Clinic[];
  colonias: Colonia[];
};

export default async function BIPage() {
    const biData = await getBIData();
    return <BIDashboard initialData={biData as BIData} />;
}
