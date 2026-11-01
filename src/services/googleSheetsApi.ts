import { AttendanceRecord } from '../types';
import { formatLocalDateTime, format12HTime } from './googleSheets';

export interface DriveSpreadsheetItem {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface GoogleSheetsApiResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  needsReauth?: boolean;
}

/**
 * Standard 8+ Enterprise Columns for Attendo attendance logs:
 * Column 1: Timestamp
 * Column 2: Employee Name
 * Column 3: Employee ID
 * Column 4: Department
 * Column 5: Punch Type
 * Column 6: Status
 * Column 7: Scheduled Time
 * Column 8: Actual Time
 * Column 9: Delay
 * Column 10: Device / Notes
 */
export const ATTENDO_SHEET_HEADERS = [
  'Timestamp',
  'Employee Name',
  'Employee ID',
  'Department',
  'Punch Type',
  'Status',
  'Scheduled Time',
  'Actual Time',
  'Delay',
  'Device / Notes',
];

/**
 * Converts an AttendanceRecord into a standardized row array matching the 8 columns
 */
export function formatAttendanceRecordToRow(record: AttendanceRecord): (string | number)[] {
  let explicitPunchType = 'PUNCH_IN';
  const rawType = String(record.type);
  if (rawType === 'IN' || rawType === 'PUNCH_IN') explicitPunchType = 'PUNCH_IN';
  else if (rawType === 'OUT' || rawType === 'PUNCH_OUT') explicitPunchType = 'PUNCH_OUT';
  else if (rawType === 'BREAK_START') explicitPunchType = 'BREAK_START';
  else if (rawType === 'BREAK_END') explicitPunchType = 'BREAK_END';
  else if (rawType === 'SECURITY_BLOCK') explicitPunchType = 'SECURITY_BLOCK';
  else if (rawType) explicitPunchType = rawType;

  // Resolve Status ensuring it is NEVER blank
  const rawStatus = record.status ? String(record.status).trim() : '';
  let statusVal = 'ON_TIME';

  if (explicitPunchType === 'BREAK_START') {
    statusVal = 'ON_BREAK';
  } else if (explicitPunchType === 'BREAK_END') {
    if (rawStatus === 'OVER_BREAK' || (record.delayMins !== undefined && record.delayMins > 60)) {
      statusVal = 'OVER_BREAK';
    } else {
      statusVal = 'RESUMED_SHIFT';
    }
  } else if (explicitPunchType === 'SECURITY_BLOCK') {
    if (rawStatus === 'SPOOF_ATTEMPT' || record.notes?.toLowerCase().includes('spoof')) {
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

  const deviceNotes = [
    record.device || 'KIOSK_FACE',
    record.kioskLocation ? `(${record.kioskLocation})` : '',
    record.notes ? `[${record.notes}]` : ''
  ].filter(Boolean).join(' ');

  return [
    formattedLocalTimestamp,
    record.employeeName,
    record.employeeId,
    record.department || '',
    explicitPunchType,
    statusVal,
    scheduledTimeVal,
    actualTimeVal,
    delayVal,
    deviceNotes || '-'
  ];
}

/**
 * Handle HTTP error responses from Google APIs
 */
function handleGoogleApiError(response: Response, jsonBody?: any): GoogleSheetsApiResult<never> {
  const isAuthError = response.status === 401 || response.status === 403;
  const errorMsg = jsonBody?.error?.message || `Google API error: ${response.status} ${response.statusText}`;
  return {
    success: false,
    error: errorMsg,
    needsReauth: isAuthError,
  };
}

/**
 * List Google Spreadsheets from user's Google Drive
 */
export async function listUserGoogleSpreadsheets(accessToken: string): Promise<GoogleSheetsApiResult<DriveSpreadsheetItem[]>> {
  if (!accessToken) {
    return { success: false, error: 'Google authentication required. Please connect your Google account.', needsReauth: true };
  }

  try {
    const queryParams = new URLSearchParams({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      orderBy: 'modifiedTime desc',
      pageSize: '30',
      fields: 'files(id, name, modifiedTime, webViewLink)',
    });

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${queryParams.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      return handleGoogleApiError(res, errJson);
    }

    const data = await res.json();
    const files: DriveSpreadsheetItem[] = (data.files || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      modifiedTime: f.modifiedTime,
      webViewLink: f.webViewLink || `https://docs.google.com/spreadsheets/d/${f.id}/edit`,
    }));

    return { success: true, data: files };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to list Google Spreadsheets' };
  }
}

/**
 * Creates a brand new Google Spreadsheet with predefined "Attendance Logs" tab,
 * frozen headers, and styled 8-column layout.
 */
export async function createAttendanceSpreadsheet(
  accessToken: string,
  title: string
): Promise<GoogleSheetsApiResult<{ spreadsheetId: string; spreadsheetUrl: string; title: string }>> {
  if (!accessToken) {
    return { success: false, error: 'Google authentication required. Please sign in with Google.', needsReauth: true };
  }

  try {
    const createBody = {
      properties: {
        title: title || 'Attendo - Hypermarket Attendance Logs',
      },
      sheets: [
        {
          properties: {
            title: 'Attendance Logs',
            gridProperties: {
              frozenRowCount: 1,
            },
            tabColor: {
              red: 0.145,
              green: 0.388,
              blue: 0.922,
            },
          },
          data: [
            {
              startRow: 0,
              startColumn: 0,
              rowData: [
                {
                  values: ATTENDO_SHEET_HEADERS.map((header) => ({
                    userEnteredValue: { stringValue: header },
                    userEnteredFormat: {
                      backgroundColor: { red: 0.93, green: 0.96, blue: 1.0 }, // Light blue header
                      textFormat: { bold: true, fontSize: 10, foregroundColor: { red: 0.08, green: 0.2, blue: 0.45 } },
                      horizontalAlignment: 'LEFT',
                    },
                  })),
                },
              ],
            },
          ],
        },
      ],
    };

    const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createBody),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      return handleGoogleApiError(res, errJson);
    }

    const data = await res.json();
    const spreadsheetId = data.spreadsheetId;
    const spreadsheetUrl = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    return {
      success: true,
      data: {
        spreadsheetId,
        spreadsheetUrl,
        title: data.properties?.title || title,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create Google Spreadsheet' };
  }
}

/**
 * Validates access to an existing spreadsheet and verifies/ensures the sheet tab
 */
export async function verifySpreadsheetAccess(
  accessToken: string,
  spreadsheetId: string
): Promise<GoogleSheetsApiResult<{ title: string; sheetNames: string[]; webViewLink: string }>> {
  if (!accessToken) {
    return { success: false, error: 'Google authentication required.', needsReauth: true };
  }
  if (!spreadsheetId) {
    return { success: false, error: 'Spreadsheet ID is required' };
  }

  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId,properties.title,sheets.properties.title`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      return handleGoogleApiError(res, errJson);
    }

    const data = await res.json();
    const title = data.properties?.title || 'Google Spreadsheet';
    const sheetNames = (data.sheets || []).map((s: any) => s.properties?.title).filter(Boolean);
    const webViewLink = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    return {
      success: true,
      data: {
        title,
        sheetNames,
        webViewLink,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to connect to Google Spreadsheet' };
  }
}

/**
 * Ensures header row exists in the target sheet tab if it's currently empty
 */
export async function ensureSheetHeadersExist(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string = 'Attendance Logs'
): Promise<void> {
  try {
    // Check if row 1 already has values
    const checkRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(sheetTitle)}'!A1:J1`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (checkRes.ok) {
      const data = await checkRes.json();
      if (data.values && data.values.length > 0 && data.values[0].length > 0) {
        // Headers already present
        return;
      }
    }

    // Append headers
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(sheetTitle)}'!A1:J1:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: `'${sheetTitle}'!A1:J1`,
          majorDimension: 'ROWS',
          values: [ATTENDO_SHEET_HEADERS],
        }),
      }
    );
  } catch {
    // Non-fatal, append will still succeed
  }
}

/**
 * Appends a single AttendanceRecord directly to the Google Spreadsheet
 */
export async function appendAttendanceRecordToSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  record: AttendanceRecord,
  preferredSheetTitle?: string
): Promise<GoogleSheetsApiResult<{ updatedRows: number }>> {
  if (!accessToken) {
    return { success: false, error: 'Google authentication required', needsReauth: true };
  }
  if (!spreadsheetId) {
    return { success: false, error: 'No Google Spreadsheet configured' };
  }

  const row = formatAttendanceRecordToRow(record);
  return batchAppendAttendanceRecordsToSpreadsheet(accessToken, spreadsheetId, [record], preferredSheetTitle);
}

/**
 * Appends multiple AttendanceRecords directly to the Google Spreadsheet in a single request
 */
export async function batchAppendAttendanceRecordsToSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  records: AttendanceRecord[],
  preferredSheetTitle: string = 'Attendance Logs'
): Promise<GoogleSheetsApiResult<{ updatedRows: number }>> {
  if (!accessToken) {
    return { success: false, error: 'Google authentication required. Please connect your Google account.', needsReauth: true };
  }
  if (!spreadsheetId) {
    return { success: false, error: 'No Google Spreadsheet configured' };
  }
  if (!records || records.length === 0) {
    return { success: true, data: { updatedRows: 0 } };
  }

  try {
    const rows = records.map((rec) => formatAttendanceRecordToRow(rec));

    // Try first with preferredSheetTitle, fallback to 'Sheet1' or generic append if sheet doesn't exist
    let targetRange = `'${preferredSheetTitle}'!A:J`;
    let appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(targetRange)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    let res = await fetch(appendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: targetRange,
        majorDimension: 'ROWS',
        values: rows,
      }),
    });

    if (!res.ok) {
      // If error might be because tab name "Attendance Logs" does not exist, try with "Sheet1"
      if (res.status === 400 || res.status === 404) {
        targetRange = `'Sheet1'!A:J`;
        appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(targetRange)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
        res = await fetch(appendUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            range: targetRange,
            majorDimension: 'ROWS',
            values: rows,
          }),
        });
      }
    }

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      return handleGoogleApiError(res, errJson);
    }

    const data = await res.json();
    return {
      success: true,
      data: {
        updatedRows: data.updates?.updatedRows || rows.length,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to append attendance logs to Google Sheet' };
  }
}
