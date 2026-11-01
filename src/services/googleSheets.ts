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
 * Formats a time string, Date, or timestamp into strictly 12-hour AM/PM time format:
 * e.g., "05:14:41 PM"
 */
export function format12HTime(timeInput?: string | Date | number, includeSeconds = true): string {
  if (!timeInput || timeInput === '-') return '-';
  try {
    const str = String(timeInput).trim();
    if (!str || str === '-') return '-';

    // If it's already a 12-hour time string (e.g. "5:14:41 PM" or "05:14 PM")
    const match12 = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (match12) {
      const hh = parseInt(match12[1], 10);
      const mm = match12[2];
      const ss = match12[3] ? match12[3].padStart(2, '0') : '00';
      const ampm = match12[4].toUpperCase();
      const hhStr = String(hh).padStart(2, '0');
      return includeSeconds ? `${hhStr}:${mm}:${ss} ${ampm}` : `${hhStr}:${mm} ${ampm}`;
    }

    // If it's an ISO timestamp or Date object
    const d = new Date(timeInput);
    if (!isNaN(d.getTime())) {
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const hhStr = String(hours).padStart(2, '0');
      return includeSeconds ? `${hhStr}:${minutes}:${seconds} ${ampm}` : `${hhStr}:${minutes} ${ampm}`;
    }

    // If it's 24H format (e.g. "17:14:41" or "17:14")
    const parts = str.split(':');
    if (parts.length >= 2) {
      const rawHours = parseInt(parts[0], 10);
      const minutes = parts[1].slice(0, 2).padStart(2, '0');
      const rawSeconds = parts[2] ? parts[2].slice(0, 2).padStart(2, '0') : '00';
      if (!isNaN(rawHours)) {
        const ampm = rawHours >= 12 ? 'PM' : 'AM';
        let h12 = rawHours % 12;
        h12 = h12 ? h12 : 12;
        const hhStr = String(h12).padStart(2, '0');
        return includeSeconds ? `${hhStr}:${minutes}:${rawSeconds} ${ampm}` : `${hhStr}:${minutes} ${ampm}`;
      }
    }

    return str;
  } catch {
    return String(timeInput || '-');
  }
}

/**
 * Default Google Apps Script Web App URL from environment configuration if provided
 */
export const DEFAULT_GOOGLE_APPS_SCRIPT_URL: string =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_APPS_SCRIPT_URL) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_SHEET_URL) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_SHEETS_URL) ||
  '';

/**
 * In-memory and localStorage cache key for global Google Apps Script Web App URL
 */
const GLOBAL_SHEET_URL_KEY = 'attendo_google_sheet_url';
let inMemoryGlobalSheetUrl: string = DEFAULT_GOOGLE_APPS_SCRIPT_URL;

/**
 * Persists the global Google Sheet Web App URL in both memory and localStorage
 */
export function setGlobalGoogleSheetUrl(url: string): void {
  const clean = (url || '').trim();
  inMemoryGlobalSheetUrl = clean;
  if (typeof window !== 'undefined') {
    try {
      if (clean) {
        localStorage.setItem(GLOBAL_SHEET_URL_KEY, clean);
        localStorage.setItem('attendo_global_google_sheet_url', clean);
      } else {
        localStorage.removeItem(GLOBAL_SHEET_URL_KEY);
        localStorage.removeItem('attendo_global_google_sheet_url');
      }
    } catch {}
  }
}

/**
 * Resolves the active Google Sheet Web App URL across all available channels:
 * 1. Explicit argument / cached URL passed into the function
 * 2. In-memory global URL
 * 3. Client Environment Variables (VITE_GOOGLE_APPS_SCRIPT_URL, VITE_GOOGLE_SHEET_URL)
 * 4. LocalStorage persistent settings (attendo_google_sheet_url)
 * 5. Company setting in localStorage
 * 6. Firebase Firestore company document (companies/{companyId}/settings/googleSheetUrl)
 */
export async function getEffectiveGoogleSheetUrl(
  companyId?: string,
  explicitUrl?: string
): Promise<string | null> {
  // 1. Explicit valid URL provided
  if (explicitUrl && isValidGoogleSheetWebAppUrl(explicitUrl)) {
    return explicitUrl.trim();
  }

  // 2. In-memory global URL
  if (inMemoryGlobalSheetUrl && isValidGoogleSheetWebAppUrl(inMemoryGlobalSheetUrl)) {
    return inMemoryGlobalSheetUrl.trim();
  }

  // 3. Environment variables
  if (DEFAULT_GOOGLE_APPS_SCRIPT_URL && isValidGoogleSheetWebAppUrl(DEFAULT_GOOGLE_APPS_SCRIPT_URL)) {
    return DEFAULT_GOOGLE_APPS_SCRIPT_URL.trim();
  }

  // 4. LocalStorage global settings
  if (typeof window !== 'undefined') {
    try {
      const storedGlobal =
        localStorage.getItem(GLOBAL_SHEET_URL_KEY) ||
        localStorage.getItem('attendo_global_google_sheet_url');
      if (storedGlobal && isValidGoogleSheetWebAppUrl(storedGlobal)) {
        inMemoryGlobalSheetUrl = storedGlobal.trim();
        return storedGlobal.trim();
      }

      if (companyId) {
        const companySpecific = localStorage.getItem(`attendo_sheet_url_${companyId}`);
        if (companySpecific && isValidGoogleSheetWebAppUrl(companySpecific)) {
          return companySpecific.trim();
        }
      }

      // Check stored company objects in localStorage
      const rawCompanies = localStorage.getItem('attendo_companies');
      if (rawCompanies) {
        const parsed = JSON.parse(rawCompanies);
        if (Array.isArray(parsed)) {
          const match = companyId ? parsed.find((c: any) => c.id === companyId) : parsed[0];
          const found = match?.googleSheetUrl || match?.settings?.googleSheetUrl;
          if (found && isValidGoogleSheetWebAppUrl(found)) {
            return found.trim();
          }
        }
      }
    } catch {}
  }

  // 5. Firebase Firestore company document
  if (companyId) {
    try {
      const remoteUrl = await fetchCompanyGoogleSheetUrl(companyId);
      if (remoteUrl && isValidGoogleSheetWebAppUrl(remoteUrl)) {
        return remoteUrl.trim();
      }
    } catch {}
  }

  return null;
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
 * Deduplication cache: Prevents sending identical punches multiple times within 12 seconds
 */
const recentlySyncedPunches = new Set<string>();

/**
 * Sends attendance punch details in the background directly to the Google Sheet Web App backend.
 * Automatically posts staff member details (name, employee ID, timestamp, and status)
 * along with additional helpful columns (type, department, scheduled time, actual time, delay).
 */
export async function syncAttendanceToGoogleSheet(
  record: AttendanceRecord,
  cachedSheetUrl?: string
): Promise<GoogleSheetSyncResult> {
  try {
    // 1. Resolve the target Google Sheet Web App URL across multi-tier sources
    const targetUrl = await getEffectiveGoogleSheetUrl(record.companyId, cachedSheetUrl);

    if (!targetUrl || !isValidGoogleSheetWebAppUrl(targetUrl)) {
      // No URL configured or invalid format - skip quietly
      return {
        success: false,
        error: 'No valid Google Apps Script Web App URL configured',
      };
    }

    // Deduplicate against duplicate dispatches
    const dedupeKey = `${record.id || ''}_${record.employeeId}_${record.type}_${record.timestamp || ''}`;
    if (recentlySyncedPunches.has(dedupeKey)) {
      return { success: true, urlUsed: targetUrl };
    }
    recentlySyncedPunches.add(dedupeKey);
    setTimeout(() => recentlySyncedPunches.delete(dedupeKey), 12000);

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

    const scheduledTimeVal = record.scheduledTime ? format12HTime(record.scheduledTime, false) : '-';
    const rawActual = record.actualTime || record.time || record.timestamp || new Date().toISOString();
    const actualTimeVal = format12HTime(rawActual, true);
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

      // Direct core fields requested (name, employee ID, timestamp, status):
      name: record.employeeName,
      employeeName: record.employeeName,
      employeeId: record.employeeId,
      id: record.employeeId,
      timestamp: formattedLocalTimestamp,
      status: statusVal,

      // Flexible camelCase and raw property mappings:
      rawIsoTimestamp: rawIsoTimestamp,
      department: record.department || '',
      punchType: explicitPunchType,
      type: record.type,
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
    // Construct dispatch URL with both query parameters (for scripts reading e.parameter)
    // and JSON POST body (for scripts reading e.postData.contents)
    let dispatchUrl = targetUrl.trim();
    try {
      const parsedUrl = new URL(dispatchUrl);
      parsedUrl.searchParams.set('name', record.employeeName);
      parsedUrl.searchParams.set('employeeName', record.employeeName);
      parsedUrl.searchParams.set('employeeId', record.employeeId);
      parsedUrl.searchParams.set('timestamp', formattedLocalTimestamp);
      parsedUrl.searchParams.set('status', statusVal);
      parsedUrl.searchParams.set('punchType', explicitPunchType);
      parsedUrl.searchParams.set('actualTime', actualTimeVal);
      dispatchUrl = parsedUrl.toString();
    } catch {
      // Keep original URL string if URL parsing fails
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 15000) : null;

    try {
      await fetch(dispatchUrl, {
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
 * Pings Google Sheet Web App with a test employee log (Name: Test User, ID: 999, Status: TEST_CHECK_IN)
 * to verify connectivity and column alignment instantly.
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
  const localActualTime = format12HTime(rawIso, true);

  // Payload specifically using requested test employee log details:
  // Name: Test User, ID: 999, Status: TEST_CHECK_IN
  const testPayload = {
    Timestamp: localTs,
    rawIsoTimestamp: rawIso,
    'Employee Name': 'Test User',
    name: 'Test User',
    employeeName: 'Test User',
    'Employee ID': '999',
    employeeId: '999',
    id: '999',
    Department: 'Store Operations',
    department: 'Store Operations',
    'Punch Type': 'PUNCH_IN',
    punchType: 'PUNCH_IN',
    Status: 'TEST_CHECK_IN',
    status: 'TEST_CHECK_IN',
    'Scheduled Time': '-',
    scheduledTime: '-',
    'Actual Time': localActualTime,
    actualTime: localActualTime,
    Delay: '-',
    timestamp: localTs,
    device: 'ADMIN_PORTAL_TEST',
    notes: `Test employee log dispatched from Admin Portal (${companyName || 'Store Admin'}) to verify Web App URL integration`,
  };

  // Construct URL with query parameters for scripts reading e.parameter as well as JSON body
  let dispatchUrl = url.trim();
  try {
    const parsedUrl = new URL(dispatchUrl);
    parsedUrl.searchParams.set('name', 'Test User');
    parsedUrl.searchParams.set('employeeName', 'Test User');
    parsedUrl.searchParams.set('employeeId', '999');
    parsedUrl.searchParams.set('id', '999');
    parsedUrl.searchParams.set('timestamp', localTs);
    parsedUrl.searchParams.set('status', 'TEST_CHECK_IN');
    parsedUrl.searchParams.set('punchType', 'PUNCH_IN');
    parsedUrl.searchParams.set('actualTime', localActualTime);
    dispatchUrl = parsedUrl.toString();
  } catch {}

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 15000) : null;

  try {
    await fetch(dispatchUrl, {
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
        'Test employee log (Name: Test User, ID: 999, Status: TEST_CHECK_IN) sent successfully to Google Sheet! Check your spreadsheet to verify the new row.',
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
