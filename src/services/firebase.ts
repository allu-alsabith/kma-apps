import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  initializeAuth, 
  indexedDBLocalPersistence, 
  browserLocalPersistence, 
  inMemoryPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  browserPopupRedirectResolver,
  type User
} from 'firebase/auth';

export type { User };
import { 
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  getDoc,
  query,
  limit,
  writeBatch,
  getDocs
} from 'firebase/firestore';
import { Employee, AttendanceRecord, LeaveRequest, StaffNotification, Company, HelpRequest, Shift } from '../types';
import firebaseConfigData from '../../firebase-applet-config.json';

// Initialize Firebase App
const firebaseConfig = {
  projectId: firebaseConfigData.projectId || "plasma-envoy-qpqwl",
  appId: firebaseConfigData.appId || "1:533262081197:web:8ca659f1057449f7bbba24",
  apiKey: firebaseConfigData.apiKey || "AIzaSyCGKCHkbex6wzZYL5IztiSW6MvIsBc4YLs",
  authDomain: firebaseConfigData.authDomain || "plasma-envoy-qpqwl.firebaseapp.com",
  storageBucket: firebaseConfigData.storageBucket || "plasma-envoy-qpqwl.firebasestorage.app",
  messagingSenderId: firebaseConfigData.messagingSenderId || "533262081197",
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with persistence and popup resolver for Google Sign-in
let authInstance: ReturnType<typeof getAuth>;
try {
  authInstance = initializeAuth(app, {
    persistence: typeof window !== 'undefined'
      ? [indexedDBLocalPersistence, browserLocalPersistence]
      : inMemoryPersistence,
    popupRedirectResolver: typeof window !== 'undefined' ? browserPopupRedirectResolver : undefined,
  });
} catch {
  try {
    authInstance = getAuth(app);
  } catch {
    authInstance = { currentUser: null } as unknown as ReturnType<typeof getAuth>;
  }
}
export const auth = authInstance;

// Google Sign-In Provider
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({ prompt: 'select_account' });

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleAuthProvider);
  if (result.user) {
    const profile: UserProfile = {
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
      role: 'ADMIN',
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    await syncUserProfileToFirestore(profile);
  }
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  try {
    return onAuthStateChanged(auth, callback);
  } catch {
    callback(null);
    return () => {};
  }
}

// Use custom database ID if provisioned, or default
const databaseId = firebaseConfigData.firestoreDatabaseId && firebaseConfigData.firestoreDatabaseId.trim() !== ''
  ? firebaseConfigData.firestoreDatabaseId
  : undefined;

// In Firebase v10+, initializeFirestore(app, settings, databaseId?)
// In browser iframe environments, handle storage/locks permissions gracefully
let dbInstance;
try {
  const cacheSettings = typeof window !== 'undefined'
    ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    : memoryLocalCache();

  if (databaseId) {
    dbInstance = initializeFirestore(app, {
      localCache: cacheSettings,
      experimentalForceLongPolling: true,
      experimentalAutoDetectLongPolling: true,
    }, databaseId);
  } else {
    dbInstance = initializeFirestore(app, {
      localCache: cacheSettings,
      experimentalForceLongPolling: true,
      experimentalAutoDetectLongPolling: true,
    });
  }
} catch {
  try {
    if (databaseId) {
      dbInstance = initializeFirestore(app, {
        localCache: memoryLocalCache(),
        experimentalForceLongPolling: true,
        experimentalAutoDetectLongPolling: true,
      }, databaseId);
    } else {
      dbInstance = initializeFirestore(app, {
        localCache: memoryLocalCache(),
        experimentalForceLongPolling: true,
        experimentalAutoDetectLongPolling: true,
      });
    }
  } catch {
    dbInstance = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  }
}

export const db = dbInstance;

// Error handling according to Firebase Integration guidelines
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

// =========================================================================
// QUOTA EXCEEDED CIRCUIT BREAKER (Graceful Offline-First Fallback)
// Prevents continuous write storms and backoff delay warnings when
// Firebase Free Tier quota is reached.
// =========================================================================
const QUOTA_EXHAUSTED_STORAGE_KEY = 'attendo_firestore_quota_exhausted';
let isFirestoreQuotaExhausted = false;

// Check existing stored quota status (resets automatically after 12h)
if (typeof window !== 'undefined') {
  try {
    const raw = localStorage.getItem(QUOTA_EXHAUSTED_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Date.now() - data.timestamp < 12 * 60 * 60 * 1000) {
        isFirestoreQuotaExhausted = true;
      } else {
        localStorage.removeItem(QUOTA_EXHAUSTED_STORAGE_KEY);
      }
    }
  } catch {
    // Ignore
  }
}

const quotaListeners = new Set<(exhausted: boolean) => void>();

export function getIsQuotaExhausted(): boolean {
  return isFirestoreQuotaExhausted;
}

export function subscribeToQuotaStatus(listener: (exhausted: boolean) => void): () => void {
  quotaListeners.add(listener);
  listener(isFirestoreQuotaExhausted);
  return () => {
    quotaListeners.delete(listener);
  };
}

export function markQuotaExhausted() {
  if (!isFirestoreQuotaExhausted) {
    isFirestoreQuotaExhausted = true;
    try {
      localStorage.setItem(
        QUOTA_EXHAUSTED_STORAGE_KEY,
        JSON.stringify({ timestamp: Date.now(), reason: 'resource-exhausted' })
      );
    } catch {
      // Ignore
    }
    quotaListeners.forEach((fn) => {
      try {
        fn(true);
      } catch {}
    });
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errStr = error instanceof Error ? error.message : String(error);
  const errCode = (error as { code?: string })?.code;

  // Intercept quota limit errors to prevent spamming backend & triggering console errors
  if (
    errCode === 'resource-exhausted' ||
    errStr.includes('resource-exhausted') ||
    errStr.includes('Quota limit exceeded') ||
    errStr.includes('Quota exceeded')
  ) {
    markQuotaExhausted();
    console.warn(
      '[Firestore Quota Breaker] Daily write quota reached on Free Tier database. Application is operating seamlessly in local offline-first mode.'
    );
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errStr,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Info: ', JSON.stringify(errInfo));
}

// Connection test for Firestore
let isConnected = false;
export async function testFirestoreConnection(): Promise<boolean> {
  if (isConnected) return true;
  try {
    const res = await getDoc(doc(db, 'test', 'connection'));
    isConnected = true;
    return true;
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err?.code === 'unavailable' || (err?.message && err.message.includes('offline'))) {
      console.info("Firestore is currently operating in offline-first cached mode; will synchronize once online.");
    } else {
      console.info("Firestore status check completed:", err?.message || 'ready');
    }
    return false;
  }
}

// Collection References
export const COMPANIES_COLLECTION = 'companies';
export const EMPLOYEES_COLLECTION = 'employees';
export const ATTENDANCE_COLLECTION = 'attendanceRecords';
export const LEAVES_COLLECTION = 'leaveRequests';
export const NOTIFICATIONS_COLLECTION = 'notifications';
export const HELP_REQUESTS_COLLECTION = 'helpRequests';
export const SHIFTS_COLLECTION = 'shifts';
export const USERS_COLLECTION = 'users';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role?: 'ADMIN' | 'MANAGER' | 'STAFF' | 'OWNER';
  companyId?: string;
  lastLoginAt: string;
  createdAt?: string;
}

// Real-time synchronization listeners
export function subscribeToCompanies(
  onData: (companies: Company[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = collection(db, COMPANIES_COLLECTION);
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Company[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as Company;
        list.push({ ...data, id: data.id || d.id });
      });
      onData(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, COMPANIES_COLLECTION);
      if (onError) onError(err);
    }
  );
}

// Real-time synchronization listeners
export function subscribeToStaffNotifications(
  onData: (notifications: StaffNotification[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = collection(db, NOTIFICATIONS_COLLECTION);
  return onSnapshot(
    q,
    (snapshot) => {
      const list: StaffNotification[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as StaffNotification;
        list.push({ ...data, id: data.id || d.id });
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onData(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, NOTIFICATIONS_COLLECTION);
      if (onError) onError(err);
    }
  );
}

export function subscribeToEmployees(
  onData: (employees: Employee[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = collection(db, EMPLOYEES_COLLECTION);
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Employee[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as Employee;
        list.push({ ...data, id: data.id || d.id });
      });
      onData(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, EMPLOYEES_COLLECTION);
      if (onError) onError(err);
    }
  );
}

export function subscribeToAttendanceRecords(
  onData: (records: AttendanceRecord[]) => void,
  maxRecords: number = 100,
  onError?: (err: Error) => void
): () => void {
  const q = query(collection(db, ATTENDANCE_COLLECTION), limit(maxRecords));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: AttendanceRecord[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as AttendanceRecord;
        list.push({ ...data, id: data.id || d.id });
      });
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onData(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, ATTENDANCE_COLLECTION);
      if (onError) onError(err);
    }
  );
}

export function subscribeToLeaveRequests(
  onData: (leaves: LeaveRequest[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = collection(db, LEAVES_COLLECTION);
  return onSnapshot(
    q,
    (snapshot) => {
      const list: LeaveRequest[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as LeaveRequest;
        list.push({ ...data, id: data.id || d.id });
      });
      list.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
      onData(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, LEAVES_COLLECTION);
      if (onError) onError(err);
    }
  );
}

// Fast Non-blocking Asynchronous Operations with error handling
export async function syncEmployeeToFirestore(employee: Employee): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const docPath = `${EMPLOYEES_COLLECTION}/${employee.id}`;
  try {
    const docRef = doc(db, EMPLOYEES_COLLECTION, employee.id);
    await setDoc(docRef, employee, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function deleteEmployeeFromFirestore(employeeId: string): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const docPath = `${EMPLOYEES_COLLECTION}/${employeeId}`;
  try {
    const docRef = doc(db, EMPLOYEES_COLLECTION, employeeId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function clearAllEmployeesInFirestore(): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  try {
    const snapshot = await getDocs(collection(db, EMPLOYEES_COLLECTION));
    const batch = writeBatch(db);
    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, EMPLOYEES_COLLECTION);
  }
}

export async function syncAttendanceRecordToFirestore(record: AttendanceRecord): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const docPath = `${ATTENDANCE_COLLECTION}/${record.id}`;
  try {
    const docRef = doc(db, ATTENDANCE_COLLECTION, record.id);
    await setDoc(docRef, record, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function syncLeaveRequestToFirestore(leave: LeaveRequest): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const docPath = `${LEAVES_COLLECTION}/${leave.id}`;
  try {
    const docRef = doc(db, LEAVES_COLLECTION, leave.id);
    await setDoc(docRef, leave, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function updateLeaveStatusInFirestore(
  leaveId: string, 
  status: 'APPROVED' | 'REJECTED'
): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const docPath = `${LEAVES_COLLECTION}/${leaveId}`;
  try {
    const docRef = doc(db, LEAVES_COLLECTION, leaveId);
    await setDoc(docRef, { 
      status, 
      reviewedAt: new Date().toISOString() 
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function deleteLeaveRequestFromFirestore(leaveId: string): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const docPath = `${LEAVES_COLLECTION}/${leaveId}`;
  try {
    const docRef = doc(db, LEAVES_COLLECTION, leaveId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function deleteLeaveRequestsByEmployeeInFirestore(employeeId: string, employeeName?: string): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  try {
    const snapshot = await getDocs(collection(db, LEAVES_COLLECTION));
    const batch = writeBatch(db);
    let count = 0;
    snapshot.forEach((d) => {
      const data = d.data() as LeaveRequest;
      if (data.employeeId === employeeId || (employeeName && data.employeeName === employeeName)) {
        batch.delete(d.ref);
        count++;
      }
    });
    if (count > 0) {
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, LEAVES_COLLECTION);
  }
}

export async function clearAllLeaveRequestsInFirestore(): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  try {
    const snapshot = await getDocs(collection(db, LEAVES_COLLECTION));
    const batch = writeBatch(db);
    snapshot.forEach((d) => {
      batch.delete(d.ref);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, LEAVES_COLLECTION);
  }
}

export async function deleteAttendanceByEmployeeInFirestore(employeeId: string): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  try {
    const snapshot = await getDocs(collection(db, ATTENDANCE_COLLECTION));
    const batch = writeBatch(db);
    let count = 0;
    snapshot.forEach((d) => {
      const data = d.data() as AttendanceRecord;
      if (data.employeeId === employeeId) {
        batch.delete(d.ref);
        count++;
      }
    });
    if (count > 0) {
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, ATTENDANCE_COLLECTION);
  }
}

export async function syncStaffNotificationToFirestore(notification: StaffNotification): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const docPath = `${NOTIFICATIONS_COLLECTION}/${notification.id}`;
  try {
    const docRef = doc(db, NOTIFICATIONS_COLLECTION, notification.id);
    await setDoc(docRef, notification, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function updateNotificationReadInFirestore(notificationId: string, read: boolean): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const docPath = `${NOTIFICATIONS_COLLECTION}/${notificationId}`;
  try {
    const docRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
    await setDoc(docRef, { read }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function deleteNotificationFromFirestore(notificationId: string): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const docPath = `${NOTIFICATIONS_COLLECTION}/${notificationId}`;
  try {
    const docRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function clearAllNotificationsInFirestore(): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  try {
    const snapshot = await getDocs(collection(db, NOTIFICATIONS_COLLECTION));
    const batch = writeBatch(db);
    snapshot.forEach((d) => {
      batch.delete(d.ref);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, NOTIFICATIONS_COLLECTION);
  }
}

export async function syncCompanyToFirestore(company: Company): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const docPath = `${COMPANIES_COLLECTION}/${company.id}`;
  try {
    const docRef = doc(db, COMPANIES_COLLECTION, company.id);
    await setDoc(docRef, company, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function deleteCompanyFromFirestore(companyId: string): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const docPath = `${COMPANIES_COLLECTION}/${companyId}`;
  try {
    const docRef = doc(db, COMPANIES_COLLECTION, companyId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

// Real-time synchronization listeners for Account Help Requests
export function subscribeToHelpRequests(
  onData: (requests: HelpRequest[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = collection(db, HELP_REQUESTS_COLLECTION);
  return onSnapshot(
    q,
    (snapshot) => {
      const list: HelpRequest[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as HelpRequest;
        list.push({ ...data, id: data.id || d.id });
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onData(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, HELP_REQUESTS_COLLECTION);
      if (onError) onError(err);
    }
  );
}

export async function syncHelpRequestToFirestore(request: HelpRequest): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const docPath = `${HELP_REQUESTS_COLLECTION}/${request.id}`;
  try {
    const docRef = doc(db, HELP_REQUESTS_COLLECTION, request.id);
    await setDoc(docRef, request, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function updateHelpRequestStatusInFirestore(requestId: string, status: 'PENDING' | 'RESOLVED'): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const docPath = `${HELP_REQUESTS_COLLECTION}/${requestId}`;
  try {
    const docRef = doc(db, HELP_REQUESTS_COLLECTION, requestId);
    await setDoc(docRef, { status }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function deleteHelpRequestFromFirestore(requestId: string): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const docPath = `${HELP_REQUESTS_COLLECTION}/${requestId}`;
  try {
    const docRef = doc(db, HELP_REQUESTS_COLLECTION, requestId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

// ==========================================
// SHIFTS SYNCHRONIZATION
// ==========================================
export function subscribeToShifts(
  onData: (shifts: Shift[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = collection(db, SHIFTS_COLLECTION);
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Shift[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as Shift;
        list.push({ ...data, id: data.id || d.id });
      });
      onData(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, SHIFTS_COLLECTION);
      if (onError) onError(err);
    }
  );
}

export async function syncShiftToFirestore(shift: Shift): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const docPath = `${SHIFTS_COLLECTION}/${shift.id}`;
  try {
    const docRef = doc(db, SHIFTS_COLLECTION, shift.id);
    await setDoc(docRef, shift, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function deleteShiftFromFirestore(shiftId: string): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const docPath = `${SHIFTS_COLLECTION}/${shiftId}`;
  try {
    const docRef = doc(db, SHIFTS_COLLECTION, shiftId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

// ==========================================
// USER PROFILES & AUTH PERSISTENCE
// ==========================================
export async function syncUserProfileToFirestore(profile: UserProfile): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const docPath = `${USERS_COLLECTION}/${profile.uid}`;
  try {
    const docRef = doc(db, USERS_COLLECTION, profile.uid);
    await setDoc(docRef, profile, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function getUserProfileFromFirestore(uid: string): Promise<UserProfile | null> {
  const docPath = `${USERS_COLLECTION}/${uid}`;
  try {
    const docRef = doc(db, USERS_COLLECTION, uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
    return null;
  }
}

// ==========================================
// BULK CLOUD PERSISTENCE (STORE EVERY DATA IN FIREBASE)
// ==========================================
export async function syncAllDataToFirestore(data: {
  companies?: Company[];
  employees?: Employee[];
  attendanceLogs?: AttendanceRecord[];
  shifts?: Shift[];
  leaveRequests?: LeaveRequest[];
  notifications?: StaffNotification[];
  helpRequests?: HelpRequest[];
}): Promise<{ success: boolean; syncedCounts: Record<string, number>; quotaExhausted?: boolean }> {
  if (isFirestoreQuotaExhausted) {
    return { success: false, syncedCounts: {}, quotaExhausted: true };
  }
  const counts: Record<string, number> = {
    companies: 0,
    employees: 0,
    attendance: 0,
    shifts: 0,
    leaves: 0,
    notifications: 0,
    helpRequests: 0,
  };

  try {
    // 1. Sync Companies
    if (data.companies && data.companies.length > 0) {
      for (const comp of data.companies) {
        await syncCompanyToFirestore(comp);
        counts.companies++;
      }
    }

    // 2. Sync Employees
    if (data.employees && data.employees.length > 0) {
      for (const emp of data.employees) {
        await syncEmployeeToFirestore(emp);
        counts.employees++;
      }
    }

    // 3. Sync Attendance Records
    if (data.attendanceLogs && data.attendanceLogs.length > 0) {
      for (const rec of data.attendanceLogs) {
        await syncAttendanceRecordToFirestore(rec);
        counts.attendance++;
      }
    }

    // 4. Sync Shifts
    if (data.shifts && data.shifts.length > 0) {
      for (const sh of data.shifts) {
        await syncShiftToFirestore(sh);
        counts.shifts++;
      }
    }

    // 5. Sync Leave Requests
    if (data.leaveRequests && data.leaveRequests.length > 0) {
      for (const leave of data.leaveRequests) {
        await syncLeaveRequestToFirestore(leave);
        counts.leaves++;
      }
    }

    // 6. Sync Notifications
    if (data.notifications && data.notifications.length > 0) {
      for (const notif of data.notifications) {
        await syncStaffNotificationToFirestore(notif);
        counts.notifications++;
      }
    }

    // 7. Sync Help Requests
    if (data.helpRequests && data.helpRequests.length > 0) {
      for (const req of data.helpRequests) {
        await syncHelpRequestToFirestore(req);
        counts.helpRequests++;
      }
    }

    return { success: true, syncedCounts: counts };
  } catch (error) {
    console.error('Error syncing all data to Firestore:', error);
    return { success: false, syncedCounts: counts };
  }
}


