'use client';
import type { Appointment, Clinic, LabAppointment, XRayAppointment, XRayStudy, UltrasoundAppointment, UltrasoundStudy, VaccineAppointment, Vaccine, Prescription } from "./definitions";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

type EnrichedAppointment = (Appointment | LabAppointment | XRayAppointment | UltrasoundAppointment | VaccineAppointment) & { clinicName?: string, coloniaName?: string, studyName?: string };

export async function downloadExcel(data: EnrichedAppointment[], filename: string) {
    const xlsx = await import('xlsx');
    const isLab = filename.includes('laboratorio');
    const isXRay = filename.includes('rayos_x');
    const isUltrasound = filename.includes('ultrasonidos');
    const isVaccine = filename.includes('vacunas');
    
    const worksheetData = data.map(
        (item) => {
            const baseData: any = {
                'Folio': item.appointmentNumber,
                'Fecha Cita': format(parseISO(item.date), 'dd/MM/yyyy'),
                'Hora': item.time,
                'Fecha Registro': item.createdAt ? format(parseISO(item.createdAt), 'dd/MM/yyyy HH:mm', { locale: es }) : 'N/A',
                'Estado': item.status,
                'Paciente': item.patient ? `${item.patient.name} ${item.patient.paternalLastName} ${item.patient.maternalLastName}`: 'N/A',
                'CURP': item.patient?.curp || 'N/A',
                'Teléfono': item.patient?.phoneNumber || 'N/A',
            };

            if (isLab) {
                const labItem = item as LabAppointment;
                baseData['Estudios'] = labItem.studies.map(s => `${s.code ? `${s.code} - ` : ''}${s.name}`).join(', ');
            } else if (isXRay) {
                 const xrayItem = item as XRayAppointment;
                 baseData['Estudio'] = xrayItem.studyName;
            } else if (isUltrasound) {
                 const ultrasoundItem = item as UltrasoundAppointment;
                 baseData['Estudio'] = ultrasoundItem.studyName;
            } else if (isVaccine) {
                const vaccineItem = item as VaccineAppointment;
                baseData['Municipio'] = vaccineItem.coloniaName || 'N/A';
                baseData['Vacunas'] = vaccineItem.vaccines.map(v => v.name).join(', ');
                baseData['Recién Nacido'] = vaccineItem.patientType === 'Recién Nacido' ? 'Sí' : 'No';
            } else { // It's a medical appointment
                const regularItem = item as Appointment;
                if (regularItem.time.includes('Ficha')) {
                    baseData['Ficha'] = regularItem.time.split(' ')[1];
                }
                baseData['Núcleo'] = (item as any).clinicName;
                baseData['Municipio'] = regularItem.coloniaName || 'N/A';
                baseData['Tipo Paciente'] = regularItem.patientType;
            }
            return baseData;
        }
    );

  const worksheet = xlsx.utils.json_to_sheet(worksheetData);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Citas');

  if (worksheetData.length > 0) {
    const cols = Object.keys(worksheetData[0]);
    const colWidths = cols.map(col => ({
        wch: Math.max(...worksheetData.map(row => (row[col as keyof typeof row] ?? '').toString().length), col.length) + 1
    }));
    worksheet['!cols'] = colWidths;
  }

  xlsx.writeFile(workbook, `${filename}.xlsx`);
}

export async function generateArchiveListPDF(appointments: any[], title: string, subtitle: string) {
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    const doc = new jsPDF('landscape') as any;

    doc.setFont('Helvetica');
    doc.setFontSize(18);
    doc.text(title, 14, 15);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(subtitle, 14, 22);

    const tableBody = appointments.map(app => [
        app.time,
        app.appointmentNumber,
        `${app.patient.paternalLastName} ${app.patient.maternalLastName} ${app.patient.name}`,
        app.patient.expediente || 'S/E',
        app.patient.curp,
        app.patientType,
        app.clinicName || 'N/A',
        '' // Column for "Observaciones" (Blank space for manual writing)
    ]);

    doc.autoTable({
        startY: 30,
        head: [['Hora', 'Folio', 'Nombre del Paciente', 'Expediente', 'CURP', 'Tipo', 'Consultorio/Núcleo', 'Observaciones']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [0, 102, 51], fontSize: 10 },
        styles: { fontSize: 9 },
        columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 25 },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 25 },
            4: { cellWidth: 40 },
            5: { cellWidth: 25 },
            6: { cellWidth: 40 },
            7: { cellWidth: 45 } // Space for manual notes
        }
    });

    const finalY = doc.lastAutoTable.finalY + 25;
    
    // Signature lines at the end of the document
    if (finalY < 180) { // Check if we have enough space on the same page
        doc.line(100, finalY, 190, finalY);
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.text('Nombre y Firma de Recibido', 145, finalY + 5, { align: 'center' });
    } else {
        doc.addPage();
        const newY = 40;
        doc.line(100, newY, 190, newY);
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.text('Nombre y Firma de Recibido', 145, newY + 5, { align: 'center' });
    }

    const dateStr = format(new Date(), 'dd-MM-yyyy');
    doc.save(`listado_archivo_${dateStr}.pdf`);
}


export async function generateAppointmentPDF(appointmentData: Appointment, clinicData: Clinic, announcements: string[]) {
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    const doc = new jsPDF() as any;
    const { patient, date, time, appointmentNumber, patientType } = appointmentData;

    doc.setFont('Helvetica');
    doc.setFontSize(22);
    doc.text('Confirmación de Cita Médica', 105, 25, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Hospital General de Huimanguillo', 105, 31, { align: 'center' });
    
    let currentY = 50;
    doc.setFontSize(14);
    doc.setFont('Helvetica', 'bold');
    doc.text(`Folio de Cita: ${appointmentNumber}`, 20, currentY);
    currentY += 8;

    doc.setLineWidth(0.5);
    doc.line(20, currentY - 4, 190, currentY - 4);

    currentY += 5;

    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('Datos del Paciente:', 20, currentY);
    currentY += 10;
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Nombre: ${patient.name} ${patient.paternalLastName} ${patient.maternalLastName}`, 20, currentY);
    currentY += 10;
    doc.text(`Tipo de Paciente: ${patientType}`, 20, currentY);
    currentY += 10;
    doc.text(`CURP: ${patient.curp}`, 20, currentY);
    currentY += 10;
    doc.text(`Teléfono: ${patient.phoneNumber}`, 20, currentY);
    currentY += 20;

    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('Detalles de la Cita:', 20, currentY);
    currentY += 10;
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'normal');
    const formattedDate = format(new Date(date), "eeee, dd 'de' MMMM 'de' yyyy", { locale: es });
    doc.text(`Fecha: ${formattedDate}`, 20, currentY);
    currentY += 10;
    
    if (time.includes('Ficha')) {
        doc.text(`Ficha de Turno: ${time.split(' ')[1]}`, 20, currentY);
    } else {
        doc.text(`Hora: ${time}`, 20, currentY);
    }
    currentY += 10;

    doc.text(`Clínica: ${clinicData.name}`, 20, currentY);
    currentY += 10;
    doc.text(`Doctor(a): ${clinicData.doctorName}`, 20, currentY);
    currentY += 10;
    
    let finalY = currentY;

    if (announcements && announcements.length > 0) {
        doc.setFontSize(14);
        doc.setFont('Helvetica', 'bold');
        doc.text('Avisos Importantes:', 20, finalY);
        finalY += 7;
        
        doc.autoTable({
            startY: finalY,
            body: announcements.map(a => [a]),
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 1, halign: 'left' },
        });
        finalY = doc.lastAutoTable.finalY + 5;
    }

    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text('Por favor, llegue 15 minutos antes de su cita.', 20, finalY);
    doc.text('Presentarse con identificación personal (INE).', 20, finalY + 5)
    doc.text('Este es un comprobante de su cita, puede mostrar este PDF desde su teléfono.', 20, finalY + 10);

    doc.save(`recibo_cita_${patient.curp}.pdf`);
}

export async function generateLabAppointmentPDF(appointmentData: LabAppointment, announcements: string[]) {
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    const doc = new jsPDF() as any;
    const { patient, date, time, appointmentNumber, studies } = appointmentData;

    doc.setFont('Helvetica');
    doc.setFontSize(22);
    doc.text('Confirmación de Cita de Laboratorio', 105, 25, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Hospital General de Huimanguillo', 105, 31, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont('Helvetica', 'bold');
    doc.text(`Folio de Cita: ${appointmentNumber}`, 20, 50);

    doc.setLineWidth(0.5);
    doc.line(20, 55, 190, 55);

    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('Datos del Paciente:', 20, 65);
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Nombre: ${patient.name} ${patient.paternalLastName} ${patient.maternalLastName}`, 20, 75);
    doc.text(`CURP: ${patient.curp}`, 20, 85);
    doc.text(`Teléfono: ${patient.phoneNumber}`, 20, 95);

    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('Detalles de la Cita:', 20, 115);
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'normal');
    const formattedDate = format(new Date(date), "eeee, dd 'de' MMMM 'de' yyyy", { locale: es });
    doc.text(`Fecha: ${formattedDate}`, 20, 125);
    doc.text(`Hora: ${time}`, 20, 135);

    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('Estudios Solicitados e Indicaciones:', 20, 155);
    
    const tableBody = studies.map(s => [s.name, s.sampleType, s.fastingHours]);
    doc.autoTable({
        startY: 165,
        head: [['Estudio', 'Tipo de Muestra', 'Horas de Ayuno']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [0, 102, 51] }, // Primary color
    });

    let finalY = doc.lastAutoTable.finalY || 200;
    finalY += 10;
    
    if (announcements && announcements.length > 0) {
        doc.setFontSize(14);
        doc.setFont('Helvetica', 'bold');
        doc.text('Avisos Importantes:', 20, finalY);
        finalY += 7;
        doc.autoTable({
            startY: finalY,
            body: announcements.map(a => [a]),
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 1, halign: 'left' },
        });
        finalY = doc.lastAutoTable.finalY + 5;
    }

    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text('Importante: Favor de presentarse a las 06:30 h para su toma de muestras puntual a las 07:00 h.', 20, finalY);
    doc.text('Siga las indicaciones de ayuno y preparación para cada estudio.', 20, finalY + 5);
    doc.text('Este es un comprobante de su cita, puede mostrar este PDF desde su teléfono.', 20, finalY + 10);

    doc.save(`recibo_lab_${patient.curp}.pdf`);
}

export async function generateXRayAppointmentPDF(appointmentData: XRayAppointment, study: XRayStudy, announcements: string[]) {
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    const doc = new jsPDF() as any;
    const { patient, date, time, appointmentNumber } = appointmentData;

    doc.setFont('Helvetica');
    doc.setFontSize(22);
    doc.text('Confirmación de Cita de Rayos X', 105, 25, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Hospital General de Huimanguillo', 105, 31, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont('Helvetica', 'bold');
    doc.text(`Folio de Cita: ${appointmentNumber}`, 20, 50);

    doc.setLineWidth(0.5);
    doc.line(20, 55, 190, 55);

    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('Datos del Paciente:', 20, 65);
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Nombre: ${patient.name} ${patient.paternalLastName} ${patient.maternalLastName}`, 20, 75);
    doc.text(`CURP: ${patient.curp}`, 20, 85);
    doc.text(`Teléfono: ${patient.phoneNumber}`, 20, 95);

    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('Detalles de la Cita:', 20, 115);
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'normal');
    const formattedDate = format(new Date(date), "eeee, dd 'de' MMMM 'de' yyyy", { locale: es });
    doc.text(`Fecha: ${formattedDate}`, 20, 125);
    doc.text(`Hora: ${time} hrs`, 20, 135);

    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('Estudio Solicitado e Indicaciones:', 20, 155);
    
    doc.autoTable({
        startY: 165,
        head: [['Estudio', 'Indicaciones']],
        body: [[study.name, study.indications]],
        theme: 'grid',
        headStyles: { fillColor: [0, 102, 51] }, // Primary color
    });

    let finalY = doc.lastAutoTable.finalY || 200;
    finalY += 10;
    
    if (announcements && announcements.length > 0) {
        doc.setFontSize(14);
        doc.setFont('Helvetica', 'bold');
        doc.text('Avisos Importantes:', 20, finalY);
        finalY += 7;
        doc.autoTable({
            startY: finalY,
            body: announcements.map(a => [a]),
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 1, halign: 'left' },
        });
        finalY = doc.lastAutoTable.finalY + 5;
    }

    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text('Por favor, llegue 15 minutos antes de su cita.', 20, finalY);
    doc.text('Siga las indicaciones de preparación para el estudio.', 20, finalY + 5);
    doc.text('Este es un comprobante de su cita, puede mostrar este PDF desde su teléfono.', 20, finalY + 10);

    doc.save(`recibo_rayosx_${patient.curp}.pdf`);
}

export async function generateUltrasoundAppointmentPDF(appointmentData: UltrasoundAppointment, study: UltrasoundStudy, announcements: string[]) {
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    const doc = new jsPDF() as any;
    const { patient, date, time, appointmentNumber } = appointmentData;

    doc.setFont('Helvetica');
    doc.setFontSize(22);
    doc.text('Confirmación de Cita de Ultrasonido', 105, 25, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Hospital General de Huimanguillo', 105, 31, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont('Helvetica', 'bold');
    doc.text(`Folio de Cita: ${appointmentNumber}`, 20, 50);

    doc.setLineWidth(0.5);
    doc.line(20, 55, 190, 55);

    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('Datos del Paciente:', 20, 65);
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Nombre: ${patient.name} ${patient.paternalLastName} ${patient.maternalLastName}`, 20, 75);
    doc.text(`CURP: ${patient.curp}`, 20, 85);
    doc.text(`Teléfono: ${patient.phoneNumber}`, 20, 95);

    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('Detalles de la Cita:', 20, 115);
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'normal');
    const formattedDate = format(new Date(date), "eeee, dd 'de' MMMM 'de' yyyy", { locale: es });
    doc.text(`Fecha: ${formattedDate}`, 20, 125);
    doc.text(`Hora: ${time} hrs`, 20, 135);

    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('Estudio Solicitado e Indicaciones:', 20, 155);
    
    doc.autoTable({
        startY: 165,
        head: [['Estudio', 'Indicaciones']],
        body: [[study.name, study.indications]],
        theme: 'grid',
        headStyles: { fillColor: [0, 102, 51] }, // Primary color
    });

    let finalY = doc.lastAutoTable.finalY || 200;
    finalY += 10;
    
    if (announcements && announcements.length > 0) {
        doc.setFontSize(14);
        doc.setFont('Helvetica', 'bold');
        doc.text('Avisos Importantes:', 20, finalY);
        finalY += 7;
        doc.autoTable({
            startY: finalY,
            body: announcements.map(a => [a]),
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 1, halign: 'left' },
        });
        finalY = doc.lastAutoTable.finalY + 5;
    }

    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text('Por favor, llegue 15 minutos antes de su cita.', 20, finalY);
    doc.text('Siga las indicaciones de preparación para el estudio.', 20, finalY + 5);
    doc.text('Este es un comprobante de su cita, puede mostrar este PDF desde su teléfono.', 20, finalY + 10);

    doc.save(`recibo_ultrasonido_${patient.curp}.pdf`);
}


export async function generateVaccineAppointmentPDF(appointmentData: VaccineAppointment, announcements: string[]) {
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    const doc = new jsPDF() as any;
    const { patient, date, time, appointmentNumber, patientType, vaccines, coloniaName } = appointmentData;
    const isNewborn = patientType === 'Recién Nacido';
    let detailsY = 85;

    doc.setFont('Helvetica');
    doc.setFontSize(22);
    doc.text('Confirmación de Cita de Vacunación', 105, 25, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Hospital General de Huimanguillo', 105, 31, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont('Helvetica', 'bold');
    doc.text(`Folio de Cita: ${appointmentNumber}`, 20, 50);

    doc.setLineWidth(0.5);
    doc.line(20, 55, 190, 55);

    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('Datos del Paciente:', 20, 65);
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Nombre: ${patient.name} ${patient.paternalLastName} ${patient.maternalLastName}`, 20, 75);
    doc.text(`Teléfono del Tutor: ${patient.phoneNumber}`, 20, detailsY);
    detailsY += 10;
    
    if (!isNewborn) {
        doc.text(`CURP: ${patient.curp}`, 20, detailsY);
        detailsY += 10;
        if (coloniaName) {
            doc.text(`Municipio: ${coloniaName}`, 20, detailsY);
            detailsY += 10;
        }
    }
    detailsY += 10; // Extra space

    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('Detalles de la Cita:', 20, detailsY);
    detailsY += 10;
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'normal');
    const formattedDate = format(new Date(date), "eeee, dd 'de' MMMM 'de' yyyy", { locale: es });
    doc.text(`Fecha: ${formattedDate}`, 20, detailsY);
    detailsY += 10;
    doc.text(`Hora: ${time} hrs`, 20, detailsY);
    detailsY += 10;
    doc.text('Lugar: Área de Vacunación del Centro de Salud', 20, detailsY);
    detailsY += 20;

    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('Vacunas a Aplicar:', 20, detailsY);
    detailsY += 10;
    
    const tableBody = vaccines.map(v => [v.name, v.description, v.applicationAge]);
    doc.autoTable({
        startY: detailsY,
        head: [['Vacuna', 'Protege contra', 'Edad recomendada']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [0, 102, 51] }, // Primary color
    });

    let finalY = doc.lastAutoTable.finalY || detailsY + 30;
    finalY += 10;

    if (announcements && announcements.length > 0) {
        doc.setFontSize(14);
        doc.setFont('Helvetica', 'bold');
        doc.text('Avisos Importantes:', 20, finalY);
        finalY += 7;
        doc.autoTable({
            startY: finalY,
            body: announcements.map(a => [a]),
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 1, halign: 'left' },
        });
        finalY = doc.lastAutoTable.finalY + 5;
    }

    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text('Por favor, llegue 15 minutos antes de su cita.', 20, finalY);
    doc.text('No olvide traer la Cartilla Nacional de Salud.', 20, finalY + 5);
    doc.text('Este es un comprobante de su cita, puede mostrar este PDF desde su teléfono.', 20, finalY + 10);

    doc.save(`recibo_vacuna_${patient.name.split(' ')[0]}_${patient.paternalLastName}.pdf`);
}

export async function generatePrescriptionPDF(prescription: Prescription) {
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    const doc = new jsPDF() as any;

    // Header
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(0, 102, 51); // Primary green
    doc.text('HOSPITAL GENERAL DE HUIMANGUILLO', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('SECRETARÍA DE SALUD DEL ESTADO DE TABASCO', 105, 26, { align: 'center' });
    
    doc.setDrawColor(0, 102, 51);
    doc.setLineWidth(1);
    doc.line(20, 32, 190, 32);

    // Folio and Date
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(`FOLIO: ${prescription.folio}`, 20, 42);
    doc.text(`FECHA: ${format(parseISO(prescription.date), 'dd/MM/yyyy HH:mm')}`, 190, 42, { align: 'right' });

    // Patient Info
    doc.setFillColor(240, 240, 240);
    doc.rect(20, 48, 170, 22, 'F');
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'bold');
    doc.text('DATOS DEL PACIENTE', 25, 54);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`NOMBRE: ${prescription.patientName.toUpperCase()}`, 25, 62);
    
    // Doctor Info
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'bold');
    doc.text('MÉDICO QUE PRESCRIBE', 110, 54);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`DR(A): ${prescription.doctorName.toUpperCase()}`, 110, 62);
    doc.text(`CED: ${prescription.doctorLicense || 'S/C'}`, 110, 67);

    // Diagnosis
    let currentY = 80;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('DIAGNÓSTICO:', 20, currentY);
    currentY += 6;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    const diagnosisLines = doc.splitTextToSize(prescription.diagnosis?.toUpperCase() || 'NO ESPECIFICADO', 170);
    doc.text(diagnosisLines, 20, currentY);
    currentY += (diagnosisLines.length * 5) + 10;

    // Medications Table
    if (prescription.items.length > 0) {
        doc.setFont('Helvetica', 'bold');
        doc.text('MEDICAMENTOS (SURTIDO EN FARMACIA):', 20, currentY);
        currentY += 4;
        
        const tableBody = prescription.items.map(i => [
            `${i.name.toUpperCase()}\nLote: ${i.lote || 'N/A'}`,
            i.quantity,
            i.frequency || '',
            i.indications || ''
        ]);

        doc.autoTable({
            startY: currentY,
            head: [['Insumo', 'Cant.', 'Frecuencia/Vía', 'Indicaciones']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [0, 102, 51], fontSize: 9 },
            styles: { fontSize: 8 },
            columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 15, halign: 'center' } }
        });
        currentY = doc.lastAutoTable.finalY + 10;
    }

    // Other medications
    if (prescription.otherMedications) {
        doc.setFont('Helvetica', 'bold');
        doc.text('OTROS MEDICAMENTOS (ADQUISICIÓN EXTERNA):', 20, currentY);
        currentY += 6;
        doc.setFont('Helvetica', 'normal');
        const otherMedLines = doc.splitTextToSize(prescription.otherMedications.toUpperCase(), 170);
        doc.text(otherMedLines, 20, currentY);
        currentY += (otherMedLines.length * 5) + 10;
    }

    // Studies
    if (prescription.labStudies?.length || prescription.otherStudies) {
        doc.setFont('Helvetica', 'bold');
        doc.text('SOLICITUD DE ESTUDIOS:', 20, currentY);
        currentY += 6;
        doc.setFont('Helvetica', 'normal');
        
        let studiesText = '';
        if (prescription.labStudies?.length) {
            studiesText += `LABORATORIO: ${prescription.labStudies.join(', ').toUpperCase()}\n`;
        }
        if (prescription.otherStudies) {
            studiesText += `OTROS: ${prescription.otherStudies.toUpperCase()}`;
        }
        
        const studiesLines = doc.splitTextToSize(studiesText, 170);
        doc.text(studiesLines, 20, currentY);
        currentY += (studiesLines.length * 5) + 15;
    }

    // Footer / Signature
    if (currentY > 250) {
        doc.addPage();
        currentY = 40;
    }
    
    doc.line(70, currentY, 140, currentY);
    doc.setFontSize(10);
    doc.text('FIRMA Y SELLO DEL MÉDICO', 105, currentY + 5, { align: 'center' });
    
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Esta receta tiene una vigencia de 24 horas para surtido en farmacia del hospital.', 105, 280, { align: 'center' });
    doc.text('Hospital General Huimanguillo - CitaMedicaFacil', 105, 285, { align: 'center' });

    doc.save(`receta_${prescription.folio}.pdf`);
}
