import { AttendanceRecord } from '../types';
import { getCompanyGoogleSheetUrl } from './firebase';

export interface GoogleSheetSyncResult {
  success: boolean;
  error?: string;
  urlUsed?: string;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats a Date or timestamp string into clean human-readable local date & time:
 * e.g., "15-Oct-2026, 10:33:07 AM" using the device's local timezone.
 */
export function formatLocalDateTime(dateInput?: string | Date | number): string {
  try {
    const d = dateInput ? new Date(dateInput) : new Date();
    if (isNaN(d.getTime())) {
      return String(dateInput || '');
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = MONTH_NAMES[d.getMonth()];
    const year = d.getFullYear();

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const formattedHours = String(hours).padStart(2, '0');

    return `${day}-${month}-${year}, ${formattedHours}:${minutes}:${seconds} ${ampm}`;
  } catch {
    return String(dateInput || '');
  }
}

/**
 * Validates whether a provided URL matches a Google Apps Script Web App endpoint (/exec)
 */
export function isValidGoogleSheetWebAppUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return (
    trimmed.startsWith('https://script.google.com/macros/s/') &&
    trimmed.includes('/exec')
  );
}

/**
 * Fetches the saved Google Sheet Web App URL for a specific company from Firebase Firestore
 */
export async function fetchCompanyGoogleSheetUrl(companyId: string): Promise<string | null> {
  if (!companyId) return null;
  try {
    return await getCompanyGoogleSheetUrl(companyId);
  } catch (err) {
    console.warn('[GoogleSheets] Failed to fetch company sheet URL from Firebase:', err);
    return null;
  }
}

/**
 * Sends attendance punch details in the background directly to the company's Google Sheet Web App
 * Payload contains: Timestamp, Employee Name, Employee ID, Status (as required by user)
 * along with additional helpful metadata (type, department, device, location).
 */
export async function syncAttendanceToGoogleSheet(
  record: AttendanceRecord,
  cachedSheetUrl?: string
): Promise<GoogleSheetSyncResult> {
  try {
    // 1. Resolve the target Google Sheet Web App URL
    let targetUrl = cachedSheetUrl;
    if (!targetUrl && record.companyId) {
      targetUrl = (await fetchCompanyGoogleSheetUrl(record.companyId)) || undefined;
    }

    if (!targetUrl || !isValidGoogleSheetWebAppUrl(targetUrl)) {
      // No URL configured or invalid format - skip quietly
      return {
        success: false,
        error: 'No valid Google Sheet Web App URL configured for this company',
      };
    }

    // 2. Prepare attendance details payload with primary requested fields + flexible mappings
    // Normalize punch type action to standard enterprise format: PUNCH_IN, PUNCH_OUT, BREAK_START, BREAK_END, SECURITY_BLOCK
    let explicitPunchType = 'PUNCH_IN';
    const rawType = String(record.type);
    if (rawType === 'IN' || rawType === 'PUNCH_IN') explicitPunchType = 'PUNCH_IN';
    else if (rawType === 'OUT' || rawType === 'PUNCH_OUT') explicitPunchType = 'PUNCH_OUT';
    else if (rawType === 'BREAK_START') explicitPunchType = 'BREAK_START';
    else if (rawType === 'BREAK_END') explicitPunchType = 'BREAK_END';
    else if (rawType === 'SECURITY_BLOCK') explicitPunchType = 'SECURITY_BLOCK';
    else if (rawType) explicitPunchType = rawType;

    // Resolve Status (Column 6) ensuring it is NEVER empty or blank for any punch type
    const rawStatus = record.status ? String(record.status).trim() : '';
    let statusVal = 'ON_TIME';

    if (explicitPunchType === 'BREAK_START') {
      // If Punch Type is 'BREAK_START', set Status to 'ON_BREAK' (instead of blank or generic 'NORMAL')
      statusVal = 'ON_BREAK';
    } else if (explicitPunchType === 'BREAK_END') {
      // If Punch Type is 'BREAK_END', set Status to 'RESUMED_SHIFT' (or 'OVER_BREAK' if break duration exceeded limit)
      if (rawStatus === 'OVER_BREAK' || (record.delayMins !== undefined && record.delayMins > 60)) {
        statusVal = 'OVER_BREAK';
      } else {
        statusVal = 'RESUMED_SHIFT';
      }
    } else if (explicitPunchType === 'SECURITY_BLOCK') {
      // If Punch Type is 'SECURITY_BLOCK', ensure Status is 'UNRECOGNIZED_FACE', 'SPOOF_ATTEMPT', or 'CROSS_PUNCH_MISMATCH'
      if (
        rawStatus === 'SPOOF_ATTEMPT' ||
        record.notes?.toLowerCase().includes('spoof')
      ) {
        statusVal = 'SPOOF_ATTEMPT';
      } else if (
        rawStatus === 'CROSS_PUNCH_MISMATCH' ||
        record.notes?.toLowerCase().includes('mismatch') ||
        record.notes?.toLowerCase().includes('cross-punch')
      ) {
        statusVal = 'CROSS_PUNCH_MISMATCH';
      } else {
        statusVal = 'UNRECOGNIZED_FACE';
      }
    } else if (explicitPunchType === 'PUNCH_IN' || explicitPunchType === 'PUNCH_OUT') {
      // Keep exact shift evaluation statuses ('ON_TIME', 'LATE (X mins)', 'EARLY_LEAVE', 'OVERTIME', etc.), falling back to 'ON_TIME' if empty
      if (rawStatus && rawStatus !== 'NORMAL' && rawStatus !== 'COMPLETED') {
        statusVal = rawStatus;
      } else {
        statusVal = 'ON_TIME';
      }
    } else {
      statusVal = rawStatus || 'ON_TIME';
    }

    const scheduledTimeVal = record.scheduledTime || '-';
    const actualTimeVal = record.actualTime || record.time || '-';
    const delayVal = record.delayMins !== undefined
      ? (record.delayMins > 0 ? `+${record.delayMins}m` : `${record.delayMins}m`)
      : '-';

    const rawIsoTimestamp = record.timestamp || new Date().toISOString();
    const formattedLocalTimestamp = formatLocalDateTime(rawIsoTimestamp);

    const payload = {
      // Complete set of 8 columns requested for supermarket attendance:
      Timestamp: formattedLocalTimestamp,
      'Employee Name': record.employeeName,
      'Employee ID': record.employeeId,
      Department: record.department || '',
      'Punch Type': explicitPunchType,
      Status: statusVal,
      'Scheduled Time': scheduledTimeVal,
      'Actual Time': actualTimeVal,
      Delay: delayVal,

      // Flexible camelCase and raw property mappings:
      timestamp: formattedLocalTimestamp,
      rawIsoTimestamp: rawIsoTimestamp,
      employeeName: record.employeeName,
      employeeId: record.employeeId,
      department: record.department || '',
      punchType: explicitPunchType,
      type: record.type,
      status: statusVal,
      scheduledTime: scheduledTimeVal,
      actualTime: actualTimeVal,
      delayMins: record.delayMins,

      // Contextual attendance info:
      date: record.date || (record.timestamp ? record.timestamp.slice(0, 10) : ''),
      time: record.time,
      device: record.device || '',
      location: record.kioskLocation || '',
      companyId: record.companyId || '',
      notes: record.notes || '',
    };

    // 3. Send HTTP POST request in the background
    // Note: mode: 'no-cors' with 'text/plain;charset=utf-8' allows browser to post to Google Apps Script
    // without CORS redirect blockage or Content-Type restriction errors in modern browsers
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 15000) : null;

    try {
      await fetch(targetUrl.trim(), {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
        signal: controller?.signal,
      });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    return { success: true, urlUsed: targetUrl };
  } catch (err: any) {
    console.error('[GoogleSheets] Failed to post attendance to Google Sheet:', err);
    return { success: false, error: err?.message || 'Failed to dispatch POST request' };
  }
}

/**
 * Pings Google Sheet Web App with a test payload to verify connectivity
 */
export async function testGoogleSheetConnection(
  url: string,
  companyName?: string
): Promise<{ success: boolean; message: string }> {
  if (!isValidGoogleSheetWebAppUrl(url)) {
    return {
      success: false,
      message:
        'Invalid URL. Must be a Google Apps Script Web App URL starting with https://script.google.com/macros/s/ and ending in /exec',
    };
  }

  const rawIso = new Date().toISOString();
  const localTs = formatLocalDateTime(rawIso);

  const testPayload = {
    Timestamp: localTs,
    rawIsoTimestamp: rawIso,
    'Employee Name': 'Test Connection (Attendo)',
    'Employee ID': 'TEST-000',
    Department: 'Administration',
    'Punch Type': 'PUNCH_IN',
    Status: 'TEST_SUCCESS',
    'Scheduled Time': '-',
    'Actual Time': '-',
    timestamp: localTs,
    employeeName: 'Test Connection (Attendo)',
    employeeId: 'TEST-000',
    status: 'TEST_SUCCESS',
    notes: `Test connection from ${companyName || 'Store Admin'}`,
  };

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 15000) : null;

  try {
    await fetch(url.trim(), {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(testPayload),
      signal: controller?.signal,
    });
    return {
      success: true,
      message:
        'Test ping sent to Google Sheet Web App. Check your sheet to verify the row was added!',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.name === 'AbortError' ? 'Connection timed out while reaching Google Apps Script' : (err?.message || 'Failed to connect to Google Sheet URL'),
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
