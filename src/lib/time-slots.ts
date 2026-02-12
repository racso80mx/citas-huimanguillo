export const timeSlots30Min = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2);
  const minutes = (i % 2) * 30;
  const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  return { value: time, label: time };
});

export const timeSlots10Min = Array.from({ length: 144 }, (_, i) => {
  const hours = Math.floor(i / 6);
  const minutes = (i % 6) * 10;
  const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  return { value: time, label: time };
});
