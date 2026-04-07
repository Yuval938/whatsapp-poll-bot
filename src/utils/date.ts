const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const DAY_NAMES_HE = [
  '\u05e8\u05d0\u05e9\u05d5\u05df',
  '\u05e9\u05e0\u05d9',
  '\u05e9\u05dc\u05d9\u05e9\u05d9',
  '\u05e8\u05d1\u05d9\u05e2\u05d9',
  '\u05d7\u05de\u05d9\u05e9\u05d9',
  '\u05e9\u05d9\u05e9\u05d9',
  '\u05e9\u05d1\u05ea',
] as const;

export type DayName = (typeof DAY_NAMES)[number];

export function getDayName(date: Date): DayName {
  return DAY_NAMES[date.getDay()];
}

export function getDayNameHe(day: DayName): string {
  const idx = DAY_NAMES.indexOf(day);
  return idx >= 0 ? DAY_NAMES_HE[idx] : day;
}

export function dayNameToHe(day: string): string {
  const idx = DAY_NAMES.indexOf(day as DayName);
  return idx >= 0 ? DAY_NAMES_HE[idx] : day;
}

export function allDaysToHe(days: string[]): string[] {
  return days.map(dayNameToHe);
}

export function nowInTimezone(timezone: string): Date {
  const str = new Date().toLocaleString('en-US', { timeZone: timezone });
  return new Date(str);
}

export function getDeadline(timezone: string, deadlineCron: string): Date {
  // Parse the deadline cron to determine when the poll expires
  // For "0 20 * * 3" (Wednesday 8 PM), calculate next occurrence
  const now = nowInTimezone(timezone);
  const parts = deadlineCron.split(' ');
  const minute = parseInt(parts[0]);
  const hour = parseInt(parts[1]);
  const dayOfWeek = parseInt(parts[4]);

  const deadline = new Date(now);
  const currentDay = deadline.getDay();
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil <= 0) daysUntil += 7;
  deadline.setDate(deadline.getDate() + daysUntil);
  deadline.setHours(hour, minute, 0, 0);
  return deadline;
}
