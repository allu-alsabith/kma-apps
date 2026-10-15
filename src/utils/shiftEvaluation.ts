import { Employee, Shift, PunchType } from '../types';
import { formatTime12H, get12HTimeString } from './formatters';

export interface ShiftEvaluationResult {
  status: string; // 'ON_TIME' | 'LATE (18 mins)' | 'EARLY_LEAVE' | 'OVERTIME' | 'NORMAL'
  scheduledTime?: string; // e.g. "09:00 AM"
  actualTime: string;    // e.g. "09:18 AM"
  delayMins?: number;
  varianceNote?: string;
}

/**
 * Parses any time string ("09:00 AM", "14:30", "6:00", etc.) or Date into minutes since midnight (0-1439).
 */
export function timeStringToMinutes(timeStr?: string | Date | null): number | null {
  if (!timeStr) return null;
  if (timeStr instanceof Date) {
    return timeStr.getHours() * 60 + timeStr.getMinutes();
  }
  const clean = String(timeStr).trim();
  if (!clean) return null;

  // Handle ISO or date string
  if (clean.includes('T')) {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      return d.getHours() * 60 + d.getMinutes();
    }
  }

  // Handle 12H format with AM/PM (e.g. "09:00 AM", "2:30 PM", "9:00:00 AM")
  const match12 = clean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const period = match12[3]?.toUpperCase();

    if (period) {
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
    }
    return hours * 60 + minutes;
  }

  // Handle standard 24H "HH:MM" or "HH:MM:SS"
  const parts = clean.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (!isNaN(hours) && !isNaN(minutes)) {
      return hours * 60 + minutes;
    }
  }

  return null;
}

/**
 * Evaluates an employee punch against retail shift rules:
 * 
 * 1. Clock In:
 *    - Compares punch time against assigned Shift Start Time (profile or shift template)
 *    - Applies a configurable 15-minute grace period buffer
 *    - Within buffer: ON_TIME
 *    - Exceeds buffer: exact delay calculated as "LATE (X mins)"
 * 
 * 2. Clock Out:
 *    - Compares punch out against assigned Shift End Time
 *    - Leaves early (> 5 mins): EARLY_LEAVE
 *    - Leaves after shift (> 15 mins): OVERTIME
 *    - Standard completion: ON_TIME
 */
export function evaluateShiftPunch(
  employee: Employee | undefined,
  punchType: PunchType,
  punchDate: Date = new Date(),
  shiftsList: Shift[] = [],
  customGracePeriod?: number,
  breakDurationMins?: number
): ShiftEvaluationResult {
  const actualTime = get12HTimeString(punchDate, true);
  const actualMinutes = punchDate.getHours() * 60 + punchDate.getMinutes();

  if (!employee) {
    if (punchType === 'BREAK_START') {
      return { status: 'ON_BREAK', actualTime };
    }
    if (punchType === 'BREAK_END') {
      return { status: 'RESUMED_SHIFT', actualTime };
    }
    if (punchType === 'SECURITY_BLOCK') {
      return { status: 'UNRECOGNIZED_FACE', actualTime };
    }
    return {
      status: 'ON_TIME',
      actualTime,
    };
  }

  // Resolve assigned shift
  const assignedShift = shiftsList.find((s) => s.id === employee.shiftId);
  const rawStartTime = employee.shiftStartTime || assignedShift?.startTime;
  const rawEndTime = employee.shiftEndTime || assignedShift?.endTime;
  const gracePeriod = customGracePeriod ?? (assignedShift?.gracePeriodMins ?? 15);

  const scheduledStartMinutes = timeStringToMinutes(rawStartTime);
  const scheduledEndMinutes = timeStringToMinutes(rawEndTime);

  const scheduledStartFormatted = rawStartTime ? formatTime12H(rawStartTime, false) : undefined;
  const scheduledEndFormatted = rawEndTime ? formatTime12H(rawEndTime, false) : undefined;

  if (punchType === 'IN') {
    if (scheduledStartMinutes === null) {
      return {
        status: 'ON_TIME',
        actualTime,
      };
    }

    let diff = actualMinutes - scheduledStartMinutes;
    // Account for midnight wrapping
    if (diff < -720) diff += 1440;
    if (diff > 720) diff -= 1440;

    if (diff <= gracePeriod) {
      return {
        status: 'ON_TIME',
        scheduledTime: scheduledStartFormatted,
        actualTime,
        delayMins: 0,
        varianceNote: diff > 0 ? `Within ${gracePeriod}-min grace period (+${diff}m)` : 'On time',
      };
    } else {
      const delay = Math.round(diff);
      return {
        status: `LATE (${delay} mins)`,
        scheduledTime: scheduledStartFormatted,
        actualTime,
        delayMins: delay,
        varianceNote: `Exceeded ${gracePeriod}-min grace period by ${delay - gracePeriod}m`,
      };
    }
  }

  if (punchType === 'OUT') {
    if (scheduledEndMinutes === null) {
      return {
        status: 'ON_TIME',
        actualTime,
      };
    }

    let diff = actualMinutes - scheduledEndMinutes;
    if (diff < -720) diff += 1440;
    if (diff > 720) diff -= 1440;

    // Left more than 5 minutes before scheduled end time
    if (diff < -5) {
      const earlyMins = Math.abs(Math.round(diff));
      return {
        status: 'EARLY_LEAVE',
        scheduledTime: scheduledEndFormatted,
        actualTime,
        delayMins: -earlyMins,
        varianceNote: `Departed ${earlyMins} mins before scheduled shift end`,
      };
    }

    // Overtime past scheduled shift end (> 15 mins)
    if (diff > 15) {
      const otMins = Math.round(diff);
      return {
        status: 'OVERTIME',
        scheduledTime: scheduledEndFormatted,
        actualTime,
        delayMins: otMins,
        varianceNote: `${otMins} mins overtime past scheduled shift end`,
      };
    }

    return {
      status: 'ON_TIME',
      scheduledTime: scheduledEndFormatted,
      actualTime,
      delayMins: 0,
      varianceNote: 'Shift completed on time',
    };
  }

  // Break punches
  if (punchType === 'BREAK_START') {
    return {
      status: 'ON_BREAK',
      actualTime,
      varianceNote: 'Started break',
    };
  }

  if (punchType === 'BREAK_END') {
    const isOverBreak = breakDurationMins !== undefined && breakDurationMins > 60;
    return {
      status: isOverBreak ? 'OVER_BREAK' : 'RESUMED_SHIFT',
      actualTime,
      delayMins: breakDurationMins,
      varianceNote: isOverBreak
        ? `Exceeded 60-min break limit (${Math.round(breakDurationMins)}m break)`
        : 'Resumed shift from break',
    };
  }

  if (punchType === 'SECURITY_BLOCK') {
    return {
      status: 'UNRECOGNIZED_FACE',
      actualTime,
      varianceNote: 'Biometric security block incident',
    };
  }

  return {
    status: 'ON_TIME',
    actualTime,
  };
}
