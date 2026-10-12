import { AttendanceRecord } from '../types';
import { getCompanyGoogleSheetUrl } from './firebase';

export interface GoogleSheetSyncResult {
  success: boolean;
  error?: string;
  urlUsed?: string;
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
    const statusVal = record.status || (record.type === 'IN' ? 'ON_TIME' : 'COMPLETED');
    const scheduledTimeVal = record.scheduledTime || '-';
    const actualTimeVal = record.actualTime || record.time || '-';
    const delayVal = record.delayMins !== undefined
      ? (record.delayMins > 0 ? `+${record.delayMins}m` : `${record.delayMins}m`)
      : '-';

    const payload = {
      // Primary fields explicitly specified by user and Google Apps Script headers:
      Timestamp: record.timestamp,
      'Employee Name': record.employeeName,
      'Employee ID': record.employeeId,
      Status: statusVal,
      'Punch Type': record.type,
      'Scheduled Time': scheduledTimeVal,
      'Actual Time': actualTimeVal,
      Department: record.department || '',
      Delay: delayVal,

      // Normalized lowerCamelCase variants for script flexibility:
      timestamp: record.timestamp,
      employeeName: record.employeeName,
      employeeId: record.employeeId,
      status: statusVal,
      punchType: record.type,
      scheduledTime: scheduledTimeVal,
      actualTime: actualTimeVal,
      delayMins: record.delayMins,

      // Contextual attendance info:
      date: record.date || record.timestamp.slice(0, 10),
      time: record.time,
      type: record.type,
      department: record.department || '',
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

  const testPayload = {
    Timestamp: new Date().toISOString(),
    'Employee Name': 'Test Connection (Attendo)',
    'Employee ID': 'TEST-000',
    Status: 'TEST_SUCCESS',
    timestamp: new Date().toISOString(),
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
