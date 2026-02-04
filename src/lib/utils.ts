import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Appointment, Clinic, LabAppointment, XRayAppointment, XRayStudy, UltrasoundAppointment, UltrasoundStudy, VaccineAppointment, Vaccine } from "./definitions";
import * as xlsx from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type EnrichedAppointment = (Appointment | LabAppointment | XRayAppointment | UltrasoundAppointment | VaccineAppointment) & { clinicName?: string, coloniaName?: string, studyName?: string };

export function downloadExcel(data: EnrichedAppointment[], filename: string) {
    const isLab = filename.includes('laboratorio');
    const isXRay = filename.includes('rayos_x');
    const isUltrasound = filename.includes('ultrasonidos');
    const isVaccine = filename.includes('vacunas');
    
    const worksheetData = data.map(
        (item) => {
            const baseData: any = {
                'Folio': item.appointmentNumber,
                'Fecha': format(parseISO(item.date), 'dd/MM/yyyy'),
                'Hora': item.time,
                'Estado': item.status,
                'Paciente': item.patient ? `${item.patient.name} ${item.patient.paternalLastName} ${item.patient.maternalLastName}`: 'N/A',
                'CURP': item.patient?.curp || 'N/A',
                'Teléfono': item.patient?.phoneNumber || 'N/A',
            };

            if (isLab) {
                const labItem = item as LabAppointment;
                baseData['Estudios'] = labItem.studies.map(s => s.name).join(', ');
            } else if (isXRay) {
                 const xrayItem = item as XRayAppointment;
                 baseData['Estudio'] = xrayItem.studyName;
            } else if (isUltrasound) {
                 const ultrasoundItem = item as UltrasoundAppointment;
                 baseData['Estudio'] = ultrasoundItem.studyName;
            } else if (isVaccine) {
                const vaccineItem = item as VaccineAppointment;
                baseData['Vacunas'] = vaccineItem.vaccines.map(v => v.name).join(', ');
                baseData['Recién Nacido'] = vaccineItem.isNewborn ? 'Sí' : 'No';
            } else {
                const regularItem = item as Appointment;
                baseData['Núcleo'] = (item as any).clinicName;
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


export function generateAppointmentPDF(appointmentData: Appointment, clinicData: Clinic) {
    const doc = new jsPDF();
    const { patient, date, time, appointmentNumber, patientType } = appointmentData;

    doc.setFont('Helvetica');
    doc.setFontSize(22);
    doc.text('Confirmación de Cita Médica', 55, 25);
    doc.setFontSize(10);
    doc.text('Jurisdicción Sanitaria No. 5 de Huimanguillo', 65, 33)
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
    doc.text(`Tipo de Paciente: ${patientType}`, 20, 85);
    doc.text(`CURP: ${patient.curp}`, 20, 95);
    doc.text(`Teléfono: ${patient.phoneNumber}`, 20, 105);

    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('Detalles de la Cita:', 20, 125);
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'normal');
    const formattedDate = format(new Date(date), "eeee, dd 'de' MMMM 'de' yyyy", { locale: es });
    doc.text(`Fecha: ${formattedDate}`, 20, 135);
    doc.text(`Hora: ${time} hrs`, 20, 145);
    doc.text(`Clínica: ${clinicData.name}`, 20, 155);
    doc.text(`Doctor(a): ${clinicData.doctorName}`, 20, 165);
    
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text('Por favor, llegue 15 minutos antes de su cita.', 20, 180);
    doc.text('Presentarse con identificación personal (INE).', 20, 185)
    doc.text('Este es un comprobante de su cita, puede mostrar este PDF desde su teléfono.', 20, 190);

    doc.save(`recibo_cita_${patient.curp}.pdf`);
}

export function generateLabAppointmentPDF(appointmentData: LabAppointment) {
    const doc = new jsPDF() as any;
    const { patient, date, time, appointmentNumber, studies } = appointmentData;

    doc.setFont('Helvetica');
    doc.setFontSize(22);
    doc.text('Confirmación de Cita de Laboratorio', 40, 25);
    doc.setFontSize(10);
    doc.text('Jurisdicción Sanitaria No. 5 de Huimanguillo', 65, 33);
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

    const finalY = doc.lastAutoTable.finalY || 200;

    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text('Por favor, llegue 15 minutos antes de su cita.', 20, finalY + 10);
    doc.text('Siga las indicaciones de ayuno y preparación para cada estudio.', 20, finalY + 15);
    doc.text('Este es un comprobante de su cita, puede mostrar este PDF desde su teléfono.', 20, finalY + 20);

    doc.save(`recibo_lab_${patient.curp}.pdf`);
}

export function generateXRayAppointmentPDF(appointmentData: XRayAppointment, study: XRayStudy) {
    const doc = new jsPDF() as any;
    const { patient, date, time, appointmentNumber } = appointmentData;

    doc.setFont('Helvetica');
    doc.setFontSize(22);
    doc.text('Confirmación de Cita de Rayos X', 40, 25);
    doc.setFontSize(10);
    doc.text('Jurisdicción Sanitaria No. 5 de Huimanguillo', 65, 33);
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

    const finalY = doc.lastAutoTable.finalY || 200;

    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text('Por favor, llegue 15 minutos antes de su cita.', 20, finalY + 10);
    doc.text('Siga las indicaciones de preparación para el estudio.', 20, finalY + 15);
    doc.text('Este es un comprobante de su cita, puede mostrar este PDF desde su teléfono.', 20, finalY + 20);

    doc.save(`recibo_rayosx_${patient.curp}.pdf`);
}

export function generateUltrasoundAppointmentPDF(appointmentData: UltrasoundAppointment, study: UltrasoundStudy) {
    const doc = new jsPDF() as any;
    const { patient, date, time, appointmentNumber } = appointmentData;

    doc.setFont('Helvetica');
    doc.setFontSize(22);
    doc.text('Confirmación de Cita de Ultrasonido', 40, 25);
    doc.setFontSize(10);
    doc.text('Jurisdicción Sanitaria No. 5 de Huimanguillo', 65, 33);
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

    const finalY = doc.lastAutoTable.finalY || 200;

    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text('Por favor, llegue 15 minutos antes de su cita.', 20, finalY + 10);
    doc.text('Siga las indicaciones de preparación para el estudio.', 20, finalY + 15);
    doc.text('Este es un comprobante de su cita, puede mostrar este PDF desde su teléfono.', 20, finalY + 20);

    doc.save(`recibo_ultrasonido_${patient.curp}.pdf`);
}


export function generateVaccineAppointmentPDF(appointmentData: VaccineAppointment) {
    const doc = new jsPDF() as any;
    const { patient, date, time, appointmentNumber, isNewborn, vaccines } = appointmentData;

    doc.setFont('Helvetica');
    doc.setFontSize(22);
    doc.text('Confirmación de Cita de Vacunación', 40, 25);
    doc.setFontSize(10);
    doc.text('Jurisdicción Sanitaria No. 5 de Huimanguillo', 65, 33);
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
    if (!isNewborn) {
        doc.text(`CURP: ${patient.curp}`, 20, 85);
        doc.text(`Teléfono: ${patient.phoneNumber}`, 20, 95);
    } else {
        doc.text(`Teléfono del Tutor: ${patient.phoneNumber}`, 20, 85);
    }

    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('Detalles de la Cita:', 20, 115);
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'normal');
    const formattedDate = format(new Date(date), "eeee, dd 'de' MMMM 'de' yyyy", { locale: es });
    doc.text(`Fecha: ${formattedDate}`, 20, 125);
    doc.text(`Hora: ${time} hrs`, 20, 135);
    doc.text('Lugar: Área de Vacunación del Centro de Salud', 20, 145);


    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('Vacunas a Aplicar:', 20, 165);
    
    const tableBody = vaccines.map(v => [v.name, v.description, v.applicationAge]);
    doc.autoTable({
        startY: 175,
        head: [['Vacuna', 'Protege contra', 'Edad recomendada']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [0, 102, 51] }, // Primary color
    });

    const finalY = doc.lastAutoTable.finalY || 210;

    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text('Por favor, llegue 15 minutos antes de su cita.', 20, finalY + 10);
    doc.text('No olvide traer la Cartilla Nacional de Salud.', 20, finalY + 15);
    doc.text('Este es un comprobante de su cita, puede mostrar este PDF desde su teléfono.', 20, finalY + 20);

    doc.save(`recibo_vacuna_${patient.name.split(' ')[0]}_${patient.paternalLastName}.pdf`);
}
