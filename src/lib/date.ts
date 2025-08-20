// utils/date.ts

export const convertDate = (dateStr: string): string | null => {
  if (!/^\d{6}$/.test(dateStr)) return null;

  const part1 = parseInt(dateStr.slice(0, 2), 10);
  const part2 = parseInt(dateStr.slice(2, 4), 10);
  const yearShort = parseInt(dateStr.slice(4, 6), 10);
  const year = yearShort >= 90 ? 1900 + yearShort : 2000 + yearShort;

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const isMonth = (m: number) => m >= 1 && m <= 12;
  const isDay = (d: number) => d >= 1 && d <= 31;

  // Try MMDDYY first
  if (isMonth(part1) && isDay(part2)) {
    return `${part2.toString().padStart(2, '0')}-${months[part1 - 1]}-${year}`;
  }

  // Try DDMMYY if MMDDYY fails
  if (isDay(part1) && isMonth(part2)) {
    return `${part1.toString().padStart(2, '0')}-${months[part2 - 1]}-${year}`;
  }

  return null;
};
export const convertDateToISO = (dateStr: string): string | null => {
  const converted = convertDate(dateStr);
  if (!converted) return null;

  const [day, month, year] = converted.split('-');
  return `${year}-${month}-${day}`;
};

export const formatToMMDDYY = (date: Date) => {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  return `${mm}${dd}${yy}`;
};

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const labelKey = (k: string) => {
  const label = convertDate(k);           // e.g. "30-Aug-2023" or null
  if (!label) return -Infinity;           // push bad dates to the end
  const [dd, mon, yyyy] = label.split('-');
  const mi = MONTHS.indexOf(mon);         // 0..11
  if (mi < 0) return -Infinity;
  return Number(yyyy) * 10000 + (mi + 1) * 100 + Number(dd); // sortable number
};