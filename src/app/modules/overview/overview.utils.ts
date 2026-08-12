export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const getYearRange = (year: number) => ({
  yearStart: new Date(`${year}-01-01T00:00:00.000Z`),
  yearEnd: new Date(`${year + 1}-01-01T00:00:00.000Z`),
});

export const resolveYear = (year?: string) =>
  year ? Number(year) : new Date().getFullYear();
