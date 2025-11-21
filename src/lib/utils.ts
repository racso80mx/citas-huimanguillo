import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Appointment } from "./definitions";
import * as xlsx from 'xlsx';
import { jsPDF } from 'jspdf';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { logoBase64 } from "./logo-data";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export function downloadExcel(data: Appointment[], filename: string) {
  const worksheetData = data.map(
    ({
      appointmentNumber,
      date,
      time,
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      curp,
      sexo,
      edad,
      consultorio,
      telefono,
    }) => ({
      'No. Cita': appointmentNumber,
      'Fecha': format(parseISO(date), 'dd/MM/yyyy'),
      'Hora': time,
      'Paciente': `${nombre} ${apellidoPaterno} ${apellidoMaterno}`,
      'CURP': curp,
      'Sexo': sexo,
      'Edad': edad,
      'Consultorio': `Núcleo Básico ${consultorio}`,
      'Teléfono': telefono,
    })
  );

  const worksheet = xlsx.utils.json_to_sheet(worksheetData);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Citas');

  // Auto-size columns
  const cols = Object.keys(worksheetData[0] || {});
  const colWidths = cols.map(col => ({
      wch: Math.max(...worksheetData.map(row => (row[col as keyof typeof row] ?? '').toString().length), col.length) + 1
  }));
  worksheet['!cols'] = colWidths;


  xlsx.writeFile(workbook, `${filename}.xlsx`);
}


export function generateAppointmentPDF(appointmentData: Appointment) {
    const doc = new jsPDF();
    const { nombre, apellidoPaterno, apellidoMaterno, curp, consultorio, date, time, appointmentNumber } = appointmentData;

    doc.addImage(logoBase64, 'PNG', 15, 15, 30, 30);

    // Set font
    doc.setFont('Helvetica');

    // Add header
    doc.setFontSize(22);
    doc.text('Confirmación de Cita Médica', 55, 25);
    
    doc.setFontSize(10);
    doc.text('Hospital General de Huimanguillo', 55, 33)

    doc.setFontSize(14);
    doc.setFont('Helvetica', 'bold');
    doc.text(`Folio: ${appointmentNumber}`, 20, 50);


    // Add a line separator
    doc.setLineWidth(0.5);
    doc.line(20, 55, 190, 55);

    // Patient Details
    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('Datos del Paciente:', 20, 65);
    
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Nombre: ${nombre} ${apellidoPaterno} ${apellidoMaterno}`, 20, 75);
    doc.text(`CURP: ${curp}`, 20, 85);

    // Appointment Details
    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('Detalles de la Cita:', 20, 105);

    doc.setFontSize(12);
    doc.setFont('Helvetica', 'normal');
    const formattedDate = format(new Date(date), "eeee, dd 'de' MMMM 'de' yyyy", { locale: es });
    doc.text(`Fecha: ${formattedDate}`, 20, 115);
    doc.text(`Hora: ${time} hrs`, 20, 125);
    doc.text(`Clínica: Núcleo Básico ${consultorio}`, 20, 135);
    
    // Add a footer note
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text('Por favor, llegue 15 minutos antes de su cita.', 20, 160);
    doc.text('Este es un comprobante de su cita, no es necesario imprimirlo.', 20, 165);
    doc.text('Puede mostrar este PDF desde su teléfono.', 20, 170);

    // Save the PDF
    doc.save(`recibo_cita_${curp}.pdf`);
}