import { differenceInYears } from 'date-fns';

export function parseCURP(curp: string) {
  const curpRegex = /^[A-Z]{4}(\d{2})(\d{2})(\d{2})([HM])[A-Z]{5}[A-Z0-9]\d$/;
  const match = curp.toUpperCase().match(curpRegex);

  if (!match) {
    return null;
  }

  const [, yearStr, monthStr, dayStr, sexChar] = match;
  let year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  
  const currentYear = new Date().getFullYear();
  const currentCentury = Math.floor(currentYear / 100) * 100;
  const lastCentury = currentCentury - 100;

  const potentialYear = lastCentury + year;

  if (potentialYear > currentYear) {
    year = lastCentury + year;
  } else {
    year = currentCentury + year;
  }
  
  // Heuristic for years like '00', '01', etc.
  if (year > currentYear) {
    year -= 100;
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

  return { birthDate, sex };
}

export function calculateAge(birthDate: Date): number {
  return differenceInYears(new Date(), birthDate);
}
