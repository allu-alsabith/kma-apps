export type PayBasis = 'DAILY' | 'WEEKLY' | 'MONTHLY';

/**
 * Converts any time string (e.g. "14:30", "14:30:45", "06:00", "22:00") or Date
 * into standard 12-hour format with AM / PM (e.g. "02:30 PM", "06:00 AM").
 */
export function formatTime12H(timeStr?: string | null, includeSeconds = false): string {
  if (!timeStr) return '';

  const clean = timeStr.trim();
  if (!clean) return '';

  // If already contains AM or PM, return it cleanly
  if (/AM|PM/i.test(clean)) {
    return clean;
  }

  // If it's an ISO timestamp or full date string
  if (clean.includes('T') || clean.includes('-')) {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: includeSeconds ? '2-digit' : undefined,
        hour12: true,
      });
    }
  }

  // Standard "HH:MM" or "HH:MM:SS" time string
  const parts = clean.split(':');
  if (parts.length >= 2) {
    const rawHours = parseInt(parts[0], 10);
    const minutes = parts[1].padStart(2, '0');
    const rawSeconds = parts[2];

    if (!isNaN(rawHours)) {
      const period = rawHours >= 12 ? 'PM' : 'AM';
      const hours12 = rawHours % 12 === 0 ? 12 : rawHours % 12;
      const formattedHours = String(hours12).padStart(2, '0');

      if (includeSeconds && rawSeconds !== undefined) {
        const seconds = rawSeconds.split('.')[0].padStart(2, '0');
        return `${formattedHours}:${minutes}:${seconds} ${period}`;
      }
      return `${formattedHours}:${minutes} ${period}`;
    }
  }

  return clean;
}

/**
 * Returns current or provided date as a 12-hour formatted time string with AM/PM
 * Example: "09:30:15 AM" or "02:45:00 PM"
 */
export function get12HTimeString(date: Date = new Date(), includeSeconds = true): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: true,
  });
}

/**
 * Formats numeric amounts in Indian Rupees (₹) using Indian Numbering System
 * Example: 500 -> "₹500", 18500 -> "₹18,500", 150000 -> "₹1,50,000"
 */
export function formatCurrencyINR(amount: number): string {
  const rounded = Math.round(Number(amount) || 0);
  return `₹${rounded.toLocaleString('en-IN')}`;
}

/**
 * Formats compensation rate according to pay basis (Daily, Weekly, Monthly)
 * Example: "₹650/day", "₹4,200/week", "₹18,000/month"
 */
export function formatSalaryRate(
  payBasis: PayBasis = 'DAILY',
  wageRate?: number,
  fallbackHourly?: number
): string {
  const rate = Number(wageRate) || (Number(fallbackHourly) ? Number(fallbackHourly) * 8 : 600);
  const formattedAmount = formatCurrencyINR(rate);

  switch (payBasis) {
    case 'DAILY':
      return `${formattedAmount}/day`;
    case 'WEEKLY':
      return `${formattedAmount}/week`;
    case 'MONTHLY':
      return `${formattedAmount}/month`;
    default:
      return `${formattedAmount}/day`;
  }
}

/**
 * Formats shift duration range from "HH:MM" start and end to 12-hour AM/PM
 * Example: ("06:00", "15:00") -> "06:00 AM - 03:00 PM"
 */
export function formatShiftBadge(startTime: string, endTime: string): string {
  return `${formatTime12H(startTime, false)} - ${formatTime12H(endTime, false)}`;
}
