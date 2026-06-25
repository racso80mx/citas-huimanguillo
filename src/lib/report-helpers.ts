
'use client';
import type { Appointment, Clinic, LabAppointment, XRayAppointment, XRayStudy, UltrasoundAppointment, UltrasoundStudy, VaccineAppointment, Vaccine, Prescription } from "./definitions";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { logoBase64 } from './logo-data';

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

    // Logo
    try {
        doc.addImage(logoBase64, 'PNG', 14, 10, 15, 15);
    } catch (e) {}

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(title, 35, 18);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(subtitle, 35, 24);

    const tableBody = appointments.map(app => [
        app.time,
        app.appointmentNumber,
        app.patient ? `${app.patient.paternalLastName} ${app.patient.maternalLastName} ${app.patient.name}` : 'PACIENTE NO DEFINIDO',
        app.patient?.expediente || 'S/E',
        app.patient?.curp || 'S/C',
        app.patientType,
        app.clinicName || 'N/A',
        '' // Column for "Observaciones"
    ]);

    doc.autoTable({
        startY: 32,
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
            7: { cellWidth: 45 }
        }
    });

    const finalY = doc.lastAutoTable.finalY + 25;
    
    if (finalY < 180) {
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

    // Logo
    try {
        doc.addImage(logoBase64, 'PNG', 20, 15, 20, 20);
    } catch (e) {}

    doc.setFont('Helvetica');
    doc.setFontSize(20);
    doc.text('Confirmación de Cita Médica', 105, 25, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Hospital General de Huimanguillo', 105, 31, { align: 'center' });
    
    let currentY = 55;
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
    
    const pName = patient ? `${patient.name} ${patient.paternalLastName} ${patient.maternalLastName}` : 'DATOS NO DISPONIBLES';
    doc.text(`Nombre: ${pName}`, 20, currentY);
    currentY += 10;
    doc.text(`Tipo de Paciente: ${patientType}`, 20, currentY);
    currentY += 10;
    doc.text(`CURP: ${patient?.curp || 'N/A'}`, 20, currentY);
    currentY += 10;
    doc.text(`Teléfono: ${patient?.phoneNumber || 'N/A'}`, 20, currentY);
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

    doc.save(`recibo_cita_${patient?.curp || 'sin_curp'}.pdf`);
}

export async function generatePrescriptionPDF(prescription: Prescription) {
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    const doc = new jsPDF() as any;

    try {
        if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', 15, 12, 22, 22);
        }
    } catch (e) {
        console.warn("Logo loading failed:", e);
    }

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(0, 102, 51);
    doc.text('HOSPITAL GENERAL DE HUIMANGUILLO', 110, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('SECRETARÍA DE SALUD DEL ESTADO DE TABASCO', 110, 26, { align: 'center' });
    
    doc.setDrawColor(0, 102, 51);
    doc.setLineWidth(0.8);
    doc.line(20, 34, 190, 34);

    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(`FOLIO: ${prescription.folio}`, 20, 44);
    doc.text(`FECHA: ${format(parseISO(prescription.date), 'dd/MM/yyyy HH:mm')}`, 190, 44, { align: 'right' });

    doc.setFillColor(245, 245, 245);
    doc.rect(20, 50, 170, 24, 'F');
    
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'bold');
    doc.text('DATOS DEL PACIENTE', 25, 56);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`NOMBRE: ${prescription.patientName.toUpperCase()}`, 25, 64);
    
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'bold');
    doc.text('MÉDICO QUE PRESCRIBE', 115, 56);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`DR(A): ${prescription.doctorName.toUpperCase()}`, 115, 64);
    doc.text(`CED: ${prescription.doctorLicense || 'S/C'}`, 115, 69);

    let currentY = 85;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('DIAGNÓSTICO:', 20, currentY);
    currentY += 6;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    const diagnosisLines = doc.splitTextToSize(prescription.diagnosis?.toUpperCase() || 'NO ESPECIFICADO', 170);
    doc.text(diagnosisLines, 20, currentY);
    currentY += (diagnosisLines.length * 5) + 10;

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
            head: [['Insumo / Medicamento', 'Cant.', 'Frecuencia/Vía', 'Indicaciones']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [0, 102, 51], fontSize: 9 },
            styles: { fontSize: 8 },
            columnStyles: { 
                0: { cellWidth: 85 },
                1: { cellWidth: 15, halign: 'center' },
                2: { cellWidth: 25 },
                3: { cellWidth: 'auto' } 
            }
        });
        currentY = doc.lastAutoTable.finalY + 10;
    }

    if (prescription.otherMedications) {
        doc.setFont('Helvetica', 'bold');
        doc.text('OTROS MEDICAMENTOS (ADQUISICIÓN EXTERNA):', 20, currentY);
        currentY += 6;
        doc.setFont('Helvetica', 'normal');
        const otherMedLines = doc.splitTextToSize(prescription.otherMedications.toUpperCase(), 170);
        doc.text(otherMedLines, 20, currentY);
        currentY += (otherMedLines.length * 5) + 10;
    }

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

    currentY += 25; 
    if (currentY > 250) {
        doc.addPage();
        currentY = 40;
    }
    
    doc.setDrawColor(0, 102, 51);
    doc.setLineWidth(0.5);
    doc.line(70, currentY, 140, currentY);
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text('FIRMA Y SELLO DEL MÉDICO', 105, currentY + 5, { align: 'center' });
    
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Esta receta tiene una vigencia de 24 horas para surtido en farmacia del hospital.', 105, 280, { align: 'center' });
    doc.text('Hospital General Huimanguillo - CitaMedicaFacil', 105, 285, { align: 'center' });

    doc.save(`receta_${prescription.folio}.pdf`);
}
