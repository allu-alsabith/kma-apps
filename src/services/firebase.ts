import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  initializeAuth, 
  indexedDBLocalPersistence, 
  browserLocalPersistence, 
  inMemoryPersistence 
} from 'firebase/auth';
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
import { Employee, AttendanceRecord, LeaveRequest, StaffNotification, Company, HelpRequest } from '../types';
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

// Initialize Auth without popup redirect resolver to prevent cross-origin iframe creation in sandboxed preview
let authInstance: ReturnType<typeof getAuth>;
try {
  authInstance = initializeAuth(app, {
    persistence: typeof window !== 'undefined'
      ? [indexedDBLocalPersistence, browserLocalPersistence]
      : inMemoryPersistence,
  });
} catch {
  try {
    authInstance = getAuth(app);
  } catch {
    authInstance = { currentUser: null } as unknown as ReturnType<typeof getAuth>;
  }
}
export const auth = authInstance;

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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
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
  const docPath = `${EMPLOYEES_COLLECTION}/${employee.id}`;
  try {
    const docRef = doc(db, EMPLOYEES_COLLECTION, employee.id);
    await setDoc(docRef, employee, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function deleteEmployeeFromFirestore(employeeId: string): Promise<void> {
  const docPath = `${EMPLOYEES_COLLECTION}/${employeeId}`;
  try {
    const docRef = doc(db, EMPLOYEES_COLLECTION, employeeId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function clearAllEmployeesInFirestore(): Promise<void> {
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
  const docPath = `${ATTENDANCE_COLLECTION}/${record.id}`;
  try {
    const docRef = doc(db, ATTENDANCE_COLLECTION, record.id);
    await setDoc(docRef, record, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function syncLeaveRequestToFirestore(leave: LeaveRequest): Promise<void> {
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
  const docPath = `${LEAVES_COLLECTION}/${leaveId}`;
  try {
    const docRef = doc(db, LEAVES_COLLECTION, leaveId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function deleteLeaveRequestsByEmployeeInFirestore(employeeId: string, employeeName?: string): Promise<void> {
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
  const docPath = `${NOTIFICATIONS_COLLECTION}/${notification.id}`;
  try {
    const docRef = doc(db, NOTIFICATIONS_COLLECTION, notification.id);
    await setDoc(docRef, notification, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function updateNotificationReadInFirestore(notificationId: string, read: boolean): Promise<void> {
  const docPath = `${NOTIFICATIONS_COLLECTION}/${notificationId}`;
  try {
    const docRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
    await setDoc(docRef, { read }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function deleteNotificationFromFirestore(notificationId: string): Promise<void> {
  const docPath = `${NOTIFICATIONS_COLLECTION}/${notificationId}`;
  try {
    const docRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function clearAllNotificationsInFirestore(): Promise<void> {
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
  const docPath = `${COMPANIES_COLLECTION}/${company.id}`;
  try {
    const docRef = doc(db, COMPANIES_COLLECTION, company.id);
    await setDoc(docRef, company, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function deleteCompanyFromFirestore(companyId: string): Promise<void> {
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
  const docPath = `${HELP_REQUESTS_COLLECTION}/${request.id}`;
  try {
    const docRef = doc(db, HELP_REQUESTS_COLLECTION, request.id);
    await setDoc(docRef, request, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function updateHelpRequestStatusInFirestore(requestId: string, status: 'PENDING' | 'RESOLVED'): Promise<void> {
  const docPath = `${HELP_REQUESTS_COLLECTION}/${requestId}`;
  try {
    const docRef = doc(db, HELP_REQUESTS_COLLECTION, requestId);
    await setDoc(docRef, { status }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function deleteHelpRequestFromFirestore(requestId: string): Promise<void> {
  const docPath = `${HELP_REQUESTS_COLLECTION}/${requestId}`;
  try {
    const docRef = doc(db, HELP_REQUESTS_COLLECTION, requestId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}


