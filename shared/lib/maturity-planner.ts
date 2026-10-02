import { addDays, format, isWeekend, parseISO } from 'date-fns';

export function estimateSettlementDate(instructionDate: string) {
  let date = parseISO(instructionDate);
  do date = addDays(date, 1);
  while (isWeekend(date));
  return format(date, 'yyyy-MM-dd');
}

export function buildMaturityIcs(
  events: Array<{ id: string; date: string; title: string; description: string }>,
) {
  const escape = (value: string) =>
    value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Obligacje Calculator//EN',
    ...events.flatMap((event) => [
      'BEGIN:VEVENT',
      `UID:${escape(event.id)}`,
      `DTSTART;VALUE=DATE:${event.date.replaceAll('-', '')}`,
      `SUMMARY:${escape(event.title)}`,
      `DESCRIPTION:${escape(event.description)}`,
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
