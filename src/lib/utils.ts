import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Appointment, Clinic } from "./definitions";
import * as xlsx from 'xlsx';
import { jsPDF } from 'jspdf';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type EnrichedAppointment = Appointment & { clinicName: string, coloniaName: string };

export function downloadExcel(data: EnrichedAppointment[], filename: string) {
  const worksheetData = data.map(
    ({
      appointmentNumber,
      date,
      time,
      patient,
      status,
      patientType,
      clinicName,
    }) => ({
      'Folio': appointmentNumber,
      'Fecha': format(parseISO(date), 'dd/MM/yyyy'),
      'Hora': time,
      'Paciente': patient ? `${patient.name} ${patient.paternalLastName} ${patient.maternalLastName}`: 'N/A',
      'CURP': patient?.curp || 'N/A',
      'Teléfono': patient?.phoneNumber || 'N/A',
      'Núcleo': clinicName,
      'Tipo Paciente': patientType,
      'Estado Cita': status,
    })
  );

  const worksheet = xlsx.utils.json_to_sheet(worksheetData);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Citas');

  // Auto-size columns
  if (worksheetData.length > 0) {
    const cols = Object.keys(worksheetData[0]);
    const colWidths = cols.map(col => ({
        wch: Math.max(...worksheetData.map(row => (row[col as keyof typeof row] ?? '').toString().length), col.length) + 1
    }));
    worksheet['!cols'] = colWidths;
  }

  xlsx.writeFile(workbook, `${filename}.xlsx`);
}


export function generateAppointmentPDF(appointmentData: Appointment, clinicData: Clinic) {
    const doc = new jsPDF();
    const { patient, date, time, appointmentNumber } = appointmentData;

    // Set font
    doc.setFont('Helvetica');

    // Add header
    doc.setFontSize(22);
    doc.text('Confirmación de Cita Médica', 55, 25);
    
    doc.setFontSize(10);
    doc.text('Jurisdicción Sanitaria No. 5 de Huimanguillo', 65, 33)

    doc.setFontSize(14);
    doc.setFont('Helvetica', 'bold');
    doc.text(`Folio de Cita: ${appointmentNumber}`, 20, 50);


    // Add a line separator
    doc.setLineWidth(0.5);
    doc.line(20, 55, 190, 55);

    // Patient Details
    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('Datos del Paciente:', 20, 65);
    
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Nombre: ${patient.name} ${patient.paternalLastName} ${patient.maternalLastName}`, 20, 75);
    doc.text(`CURP: ${patient.curp}`, 20, 85);
    doc.text(`Teléfono: ${patient.phoneNumber}`, 20, 95);


    // Appointment Details
    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('Detalles de la Cita:', 20, 115);

    doc.setFontSize(12);
    doc.setFont('Helvetica', 'normal');
    const formattedDate = format(new Date(date), "eeee, dd 'de' MMMM 'de' yyyy", { locale: es });
    doc.text(`Fecha: ${formattedDate}`, 20, 125);
    doc.text(`Hora: ${time} hrs`, 20, 135);
    doc.text(`Clínica: ${clinicData.name}`, 20, 145);
    doc.text(`Doctor(a): ${clinicData.doctorName}`, 20, 155);
    
    // Add a footer note
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text('Por favor, llegue 15 minutos antes de su cita.', 20, 180);
    doc.text('Presentarse con identificación personal (INE).', 20, 185)
    doc.text('Este es un comprobante de su cita, puede mostrar este PDF desde su teléfono.', 20, 190);

    // Save the PDF
    doc.save(`recibo_cita_${patient.curp}.pdf`);
}
