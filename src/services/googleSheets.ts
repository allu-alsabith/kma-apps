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
 * Deduplication cache: Sliding timestamp window (12,000ms) keyed by companyId, employeeId, and punch type.
 * Eliminates duplicate row insertions across dual callers (e.g. KioskFace local handler + App onNewPunch)
 * while smoothly allowing subsequent legitimate punches.
 */
const recentlySyncedPunches = new Map<string, number>();
const DEDUPE_WINDOW_MS = 12000;

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

    // Deduplicate against duplicate dispatches within 12 seconds
    const nowMs = Date.now();
    // For stranger security blocks or test records, allow separate records or distinct interval window
    const isSpecialEvent = record.employeeId === 'STRANGER' || record.employeeId === '999';
    const dedupeKey = isSpecialEvent
      ? `${record.companyId || ''}_${record.employeeId}_${record.type}_${Math.floor(nowMs / 5000)}`
      : `${record.companyId || ''}_${record.employeeId}_${record.type}`;

    const lastSyncTime = recentlySyncedPunches.get(dedupeKey);
    if (lastSyncTime && nowMs - lastSyncTime < DEDUPE_WINDOW_MS) {
      return { success: true, urlUsed: targetUrl };
    }
    recentlySyncedPunches.set(dedupeKey, nowMs);

    // Periodically prune stale keys from cache
    if (recentlySyncedPunches.size > 200) {
      for (const [key, ts] of recentlySyncedPunches.entries()) {
        if (nowMs - ts > DEDUPE_WINDOW_MS) {
          recentlySyncedPunches.delete(key);
        }
      }
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

/**
 * Production-ready Google Apps Script backend template for automated attendance reporting.
 * Handles both GET and POST requests, formats smart headers, normalizes 12-hour AM/PM times,
 * applies color-coded status styling, and auto-resizes all 8 columns.
 */
export const GOOGLE_APPS_SCRIPT_BACKEND_CODE: string = `/**
 * Attendo Kiosk & Admin Suite - Google Sheets Attendance Logging Backend
 * 
 * Deployment Guide:
 * 1. Open your Google Spreadsheet (e.g. Attendo Staff Attendance).
 * 2. In the top menu, click Extensions > Apps Script.
 * 3. Delete any default code in Code.gs, paste this entire script, and click Save.
 * 4. Click Deploy > New deployment.
 * 5. Select type: "Web app" (click the gear icon if needed).
 * 6. Set:
 *    - Description: Attendo Attendance Webhook
 *    - Execute as: Me (your Google account)
 *    - Who has access: Anyone (allows kiosk terminal and admin app to post punches)
 * 7. Click Deploy, authorize permissions, and copy the Web App URL (ends with /exec).
 * 8. Paste into Attendo Admin Portal > Settings > Google Sheet Integration and click Save.
 */

function doGet(e) {
  return handleAttendanceWebhook(e);
}

function doPost(e) {
  return handleAttendanceWebhook(e);
}

function handleAttendanceWebhook(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var headers = [
      "Timestamp",
      "Employee Name",
      "Employee ID",
      "Department",
      "Punch Type",
      "Status",
      "Scheduled Time",
      "Actual Time"
    ];

    // Smart Header Initialization & Sheet Self-Formatting
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      formatHeaderRow(sheet, 1);
    } else {
      var firstCellVal = sheet.getRange(1, 1).getValue();
      if (String(firstCellVal).trim() !== "Timestamp") {
        sheet.insertRowBefore(1);
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        formatHeaderRow(sheet, 1);
      }
    }

    // Seamless payload extraction supporting both JSON postData and URL query parameters
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    // 1. Strict 12-Hour AM/PM normalization for Column A (Timestamp) e.g. "11-Nov-2026, 05:33:46 PM"
    var rawTs = data["Timestamp"] || data.timestamp || data.rawIsoTimestamp || new Date().toISOString();
    var formattedTs = String(rawTs).trim();

    if (formattedTs.indexOf("AM") === -1 && formattedTs.indexOf("PM") === -1) {
      try {
        var dateObj = new Date(rawTs);
        if (!isNaN(dateObj.getTime())) {
          formattedTs = Utilities.formatDate(dateObj, Session.getScriptTimeZone() || "GMT", "dd-MMM-yyyy, hh:mm:ss a");
        }
      } catch (dateErr) {}
    }

    // 2. Strict 12-Hour AM/PM normalization for Column H (Actual Time) e.g. "05:14:41 PM"
    var rawActual = data["Actual Time"] || data.actualTime || data.time || "";
    var formattedActual = String(rawActual).trim();

    if (formattedActual && formattedActual !== "-") {
      if (formattedActual.indexOf("T") !== -1 || formattedActual.indexOf("Z") !== -1) {
        try {
          var actDateObj = new Date(formattedActual);
          if (!isNaN(actDateObj.getTime())) {
            formattedActual = Utilities.formatDate(actDateObj, Session.getScriptTimeZone() || "GMT", "hh:mm:ss a");
          }
        } catch(actErr) {}
      } else {
        // Convert 24-hour "HH:mm:ss" or "HH:mm" to 12-hour "hh:mm:ss a"
        var time24Match = formattedActual.match(/^(\\d{1,2}):(\\d{2})(?::(\\d{2}))?$/);
        if (time24Match) {
          var h = parseInt(time24Match[1], 10);
          var m = time24Match[2];
          var s = time24Match[3] || "00";
          var a = h >= 12 ? "PM" : "AM";
          h = h % 12;
          h = h ? h : 12;
          var hStr = (h < 10 ? "0" : "") + h;
          formattedActual = hStr + ":" + m + ":" + s + " " + a;
        } else {
          // Normalize 12-hour format with single-digit hour e.g. "5:14:41 PM" -> "05:14:41 PM"
          var match12 = formattedActual.match(/^(\\d{1,2}):(\\d{2})(?::(\\d{2}))?\\s*(AM|PM)$/i);
          if (match12) {
            var hh = parseInt(match12[1], 10);
            var mm = match12[2];
            var ss = match12[3] || "00";
            var ampm = match12[4].toUpperCase();
            var hhStr = (hh < 10 ? "0" : "") + hh;
            formattedActual = hhStr + ":" + mm + ":" + ss + " " + ampm;
          }
        }
      }
    } else {
      // If Actual Time is empty or '-', extract the 12-hour time portion from Column A if present
      if (formattedTs && formattedTs.indexOf(",") !== -1) {
        formattedActual = formattedTs.split(",")[1].trim();
      } else {
        formattedActual = "-";
      }
    }

    // 3. Resolve Scheduled Time (Column G)
    var scheduledVal = data["Scheduled Time"] || data.scheduledTime || "-";

    // 4. Resolve Punch Type (Column E) and Status (Column F)
    var punchTypeVal = data["Punch Type"] || data.punchType || data.type || "PUNCH_IN";
    var statusVal = String(data["Status"] || data.status || "ON_TIME").toUpperCase().trim();

    // 5. Append row to spreadsheet
    sheet.appendRow([
      formattedTs,
      data["Employee Name"] || data.employeeName || data.name || "Unknown",
      data["Employee ID"] || data.employeeId || data.id || "",
      data["Department"] || data.department || "",
      punchTypeVal,
      statusVal,
      scheduledVal,
      formattedActual
    ]);

    var newRow = sheet.getLastRow();
    var newRowRange = sheet.getRange(newRow, 1, 1, 8);

    // 6. Format data row cleanly (eliminates dark header color bleeding)
    newRowRange.setBackground("#ffffff");
    newRowRange.setFontColor("#0f172a");
    newRowRange.setFontFamily("Roboto");
    newRowRange.setFontSize(10);
    newRowRange.setFontWeight("normal");
    newRowRange.setVerticalAlignment("middle");

    // Force Plain Text ("@") on Column A (Timestamp), Column G (Scheduled Time), and Column H (Actual Time)
    // so Google Sheets never auto-coerces into 24-hour time or spreadsheet locale defaults
    sheet.getRange(newRow, 1).setNumberFormat("@");
    sheet.getRange(newRow, 7).setNumberFormat("@");
    sheet.getRange(newRow, 8).setNumberFormat("@");

    // Alignments: left for Columns 1, 2, 4; center for Columns 3, 5, 6, 7, 8
    sheet.getRange(newRow, 1).setHorizontalAlignment("left");
    sheet.getRange(newRow, 2).setHorizontalAlignment("left");
    sheet.getRange(newRow, 4).setHorizontalAlignment("left");

    sheet.getRange(newRow, 3).setHorizontalAlignment("center");
    sheet.getRange(newRow, 5).setHorizontalAlignment("center");
    sheet.getRange(newRow, 6).setHorizontalAlignment("center");
    sheet.getRange(newRow, 7).setHorizontalAlignment("center");
    sheet.getRange(newRow, 8).setHorizontalAlignment("center");

    // 7. Color-coded Status cell styling (Column 6):
    var statusCell = sheet.getRange(newRow, 6);
    statusCell.setFontWeight("bold");

    if (statusVal === "TEST_CHECK_IN") {
      // Emerald test confirmation (bg: '#d1fae5', fg: '#065f46')
      statusCell.setBackground("#d1fae5").setFontColor("#065f46");
    } else if (statusVal === "ON_TIME" || statusVal === "RESUMED_SHIFT" || statusVal === "NORMAL") {
      // Green (bg: '#dcfce7', fg: '#166534')
      statusCell.setBackground("#dcfce7").setFontColor("#166534");
    } else if (statusVal === "ON_BREAK") {
      // Blue (bg: '#dbeafe', fg: '#1e40af')
      statusCell.setBackground("#dbeafe").setFontColor("#1e40af");
    } else if (statusVal === "EARLY_LEAVE" || statusVal === "OVERTIME" || statusVal.indexOf("EARLY") !== -1) {
      // Amber (bg: '#fef3c7', fg: '#92400e')
      statusCell.setBackground("#fef3c7").setFontColor("#92400e");
    } else if (
      statusVal.indexOf("LATE") !== -1 ||
      statusVal === "OVER_BREAK" ||
      statusVal === "UNRECOGNIZED_FACE" ||
      statusVal === "SPOOF_ATTEMPT" ||
      statusVal === "CROSS_PUNCH_MISMATCH" ||
      statusVal === "SECURITY_BLOCK" ||
      statusVal.indexOf("BLOCK") !== -1
    ) {
      // Red (bg: '#fee2e2', fg: '#991b1b')
      statusCell.setBackground("#fee2e2").setFontColor("#991b1b");
    } else {
      // Fallback Green
      statusCell.setBackground("#dcfce7").setFontColor("#166534");
    }

    // 8. Auto-resize columns 1 to 8 so text is never clipped
    try {
      if (typeof sheet.autoResizeColumns === "function") {
        sheet.autoResizeColumns(1, 8);
      } else {
        for (var col = 1; col <= 8; col++) {
          sheet.autoResizeColumn(col);
        }
      }
    } catch (resizeErr) {
      for (var c = 1; c <= 8; c++) {
        try { sheet.autoResizeColumn(c); } catch (e) {}
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      result: "success",
      message: "Attendance logged successfully",
      row: newRow
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      result: "error",
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function formatHeaderRow(sheet, rowNum) {
  try {
    var headerRange = sheet.getRange(rowNum, 1, 1, 8);
    headerRange.setBackground("#1e293b"); // Professional dark slate background
    headerRange.setFontColor("#ffffff");  // Bold white text
    headerRange.setFontWeight("bold");
    headerRange.setFontFamily("Roboto");
    headerRange.setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    for (var col = 1; col <= 8; col++) {
      sheet.autoResizeColumn(col);
    }
  } catch (e) {}
}`;
