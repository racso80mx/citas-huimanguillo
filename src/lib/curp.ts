'use client';
import { differenceInYears } from 'date-fns';
import estados from './data/estados.json';

const estadoMap: { [key: string]: string } = {};
estados.forEach(e => {
  estadoMap[e.clave] = e.nombre;
});


export function parseCURP(curp: string) {
  const curpRegex = /^[A-Z]{4}(\d{2})(\d{2})(\d{2})([HM])([A-Z]{2})[A-Z]{3}[A-Z0-9]\d$/;
  const match = curp.toUpperCase().match(curpRegex);

  if (!match) {
    return null;
  }

  const [, yearStr, monthStr, dayStr, sexChar, estadoClave] = match;
  let year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  
  const currentYear = new Date().getFullYear();
  const currentCentury = Math.floor(currentYear / 100) * 100;
  
  // Heuristic for determining the century
  let potentialYear = currentCentury - 100 + year;
  if(potentialYear > currentYear) {
      year += 1900;
  } else {
      year += 2000;
      // Handle cases for people born in early 2000s when current year is e.g. 2080
      if (new Date(year, month, day) > new Date()) {
          year -= 100;
      }
  }


  const birthDate = new Date(year, month, day);

  // Basic validation to see if the date is valid
  if (
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== month ||
    birthDate.getDate() !== day
  ) {
    return null;
  }

  const sex = sexChar === 'H' ? 'Hombre' : 'Mujer';
  const estadoNacimiento = estadoMap[estadoClave] || null;

  return { birthDate, sex, estadoNacimiento };
}

export function calculateAge(birthDate: Date | undefined): number {
  if (!birthDate || !(birthDate instanceof Date) || isNaN(birthDate.getTime())) {
    return 0; // Return a default value if birthDate is invalid
  }
  return differenceInYears(new Date(), birthDate);
}
