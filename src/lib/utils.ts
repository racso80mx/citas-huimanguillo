import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Appointment } from "./definitions";
import * as xlsx from 'xlsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export function downloadExcel(data: Appointment[], filename: string) {
  const worksheetData = data.map(
    ({
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      curp,
      sexo,
      edad,
      estadoNacimiento,
      municipio,
      colonia,
      consultorio,
      date,
      telefono,
    }) => ({
      'Nombre Completo': `${nombre} ${apellidoPaterno} ${apellidoMaterno}`,
      CURP: curp,
      Sexo: sexo,
      Edad: edad,
      'Estado Nacimiento': estadoNacimiento,
      Municipio: municipio,
      Colonia: colonia,
      Clínica: `Núcleo Básico ${consultorio}`,
      'Fecha de Cita': new Date(date).toLocaleDateString('es-MX'),
      Teléfono: telefono,
    })
  );

  const worksheet = xlsx.utils.json_to_sheet(worksheetData);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Citas');

  // Auto-size columns
  const cols = Object.keys(worksheetData[0] || {});
  const colWidths = cols.map(col => ({
      wch: Math.max(...worksheetData.map(row => (row[col as keyof typeof row] ?? '').toString().length), col.length)
  }));
  worksheet['!cols'] = colWidths;


  xlsx.writeFile(workbook, `${filename}.xlsx`);
}
