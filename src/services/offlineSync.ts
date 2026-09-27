import { useState, useEffect } from 'react';
import { 
  syncAttendanceRecordToFirestore,
  syncEmployeeToFirestore,
  deleteEmployeeFromFirestore,
  syncLeaveRequestToFirestore,
  updateLeaveStatusInFirestore,
  deleteLeaveRequestFromFirestore,
  syncCompanyToFirestore,
  deleteCompanyFromFirestore,
  syncHelpRequestToFirestore,
  updateHelpRequestStatusInFirestore,
  deleteHelpRequestFromFirestore,
  syncStaffNotificationToFirestore,
  updateNotificationReadInFirestore,
  syncShiftToFirestore,
  deleteShiftFromFirestore,
} from './firebase';
import { AttendanceRecord, Employee, LeaveRequest, Company, HelpRequest, StaffNotification, Shift } from '../types';

export type OfflineActionType =
  | 'SYNC_PUNCH'
  | 'SYNC_EMPLOYEE'
  | 'SYNC_DELETE_EMPLOYEE'
  | 'SYNC_LEAVE'
  | 'SYNC_LEAVE_STATUS'
  | 'SYNC_DELETE_LEAVE'
  | 'SYNC_COMPANY'
  | 'SYNC_DELETE_COMPANY'
  | 'SYNC_HELP_REQUEST'
  | 'SYNC_HELP_STATUS'
  | 'SYNC_DELETE_HELP_REQUEST'
  | 'SYNC_NOTIFICATION'
  | 'SYNC_NOTIFICATION_READ'
  | 'SYNC_SHIFT'
  | 'SYNC_DELETE_SHIFT';

export interface OfflineQueueItem {
  id: string;
  type: OfflineActionType;
  payload: any;
  createdAt: string;
  retryCount: number;
}

export interface NetworkSyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: string | null;
  lastSyncResult?: 'SUCCESS' | 'ERROR' | null;
}

const STORAGE_KEY = 'attendo_offline_queue';
const LAST_SYNC_KEY = 'attendo_last_sync_time';

class OfflineSyncManager {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncing: boolean = false;
  private listeners: Set<(state: NetworkSyncState) => void> = new Set();
  private flushTimer: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);

      // Periodic queue check every 20 seconds to auto-flush when online
      this.flushTimer = setInterval(() => {
        if (this.isOnline && !this.isSyncing && this.getQueue().length > 0) {
          this.flushQueue();
        }
      }, 20000);

      // Run initial check if queue has pending items
      if (this.isOnline && this.getQueue().length > 0) {
        setTimeout(() => this.flushQueue(), 1500);
      }
    }
  }

  private handleOnline = () => {
    this.isOnline = true;
    this.notify();
    // Auto-flush pending operations when back online
    this.flushQueue();
  };

  private handleOffline = () => {
    this.isOnline = false;
    this.notify();
  };

  public getQueue(): OfflineQueueItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private setQueue(queue: OfflineQueueItem[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch {
      // ignore
    }
  }

  public getState(): NetworkSyncState {
    const queue = this.getQueue();
    let lastSync: string | null = null;
    if (typeof window !== 'undefined') {
      lastSync = localStorage.getItem(LAST_SYNC_KEY);
    }
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount: queue.length,
      lastSyncTime: lastSync,
    };
  }

  public subscribe(listener: (state: NetworkSyncState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((l) => {
      try {
        l(state);
      } catch (e) {
        console.error('Error notifying sync listener', e);
      }
    });
  }

  /**
   * Enqueues an action to be synchronized.
   * If online, attempts an immediate background flush.
   */
  public enqueue(type: OfflineActionType, payload: any): void {
    const item: OfflineQueueItem = {
      id: `queue-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      type,
      payload,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    const queue = this.getQueue();
    queue.push(item);
    this.setQueue(queue);
    this.notify();

    // If online, immediately try to flush
    if (this.isOnline && !this.isSyncing) {
      setTimeout(() => this.flushQueue(), 100);
    }
  }

  /**
   * Processes all queued actions and sends them to Firestore
   */
  public async flushQueue(): Promise<{ syncedCount: number; errors: number }> {
    if (this.isSyncing) {
      return { syncedCount: 0, errors: 0 };
    }

    const queue = this.getQueue();
    if (queue.length === 0) {
      return { syncedCount: 0, errors: 0 };
    }

    this.isSyncing = true;
    this.notify();

    let syncedCount = 0;
    let errors = 0;
    const remainingQueue: OfflineQueueItem[] = [];

    for (const item of queue) {
      try {
        let success = true;
        switch (item.type) {
          case 'SYNC_PUNCH':
            await syncAttendanceRecordToFirestore(item.payload as AttendanceRecord);
            break;
          case 'SYNC_EMPLOYEE':
            await syncEmployeeToFirestore(item.payload as Employee);
            break;
          case 'SYNC_DELETE_EMPLOYEE':
            await deleteEmployeeFromFirestore(item.payload as string);
            break;
          case 'SYNC_LEAVE':
            await syncLeaveRequestToFirestore(item.payload as LeaveRequest);
            break;
          case 'SYNC_LEAVE_STATUS':
            await updateLeaveStatusInFirestore(item.payload.id, item.payload.status);
            break;
          case 'SYNC_DELETE_LEAVE':
            await deleteLeaveRequestFromFirestore(item.payload as string);
            break;
          case 'SYNC_COMPANY':
            await syncCompanyToFirestore(item.payload as Company);
            break;
          case 'SYNC_DELETE_COMPANY':
            await deleteCompanyFromFirestore(item.payload as string);
            break;
          case 'SYNC_HELP_REQUEST':
            await syncHelpRequestToFirestore(item.payload as HelpRequest);
            break;
          case 'SYNC_HELP_STATUS':
            await updateHelpRequestStatusInFirestore(item.payload.id, item.payload.status);
            break;
          case 'SYNC_DELETE_HELP_REQUEST':
            await deleteHelpRequestFromFirestore(item.payload as string);
            break;
          case 'SYNC_NOTIFICATION':
            await syncStaffNotificationToFirestore(item.payload as StaffNotification);
            break;
          case 'SYNC_NOTIFICATION_READ':
            await updateNotificationReadInFirestore(item.payload.id, item.payload.read);
            break;
          case 'SYNC_SHIFT':
            await syncShiftToFirestore(item.payload as Shift);
            break;
          case 'SYNC_DELETE_SHIFT':
            await deleteShiftFromFirestore(item.payload as string);
            break;
          default:
            break;
        }

        if (success) {
          syncedCount++;
        }
      } catch (err) {
        console.warn(`[OfflineSync] Failed to process queue item ${item.id}`, err);
        errors++;
        if (item.retryCount < 5) {
          remainingQueue.push({
            ...item,
            retryCount: item.retryCount + 1,
          });
        }
      }
    }

    this.setQueue(remainingQueue);
    this.isSyncing = false;

    if (syncedCount > 0 && typeof window !== 'undefined') {
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      localStorage.setItem(LAST_SYNC_KEY, nowStr);
    }

    this.notify();
    return { syncedCount, errors };
  }
}

export const offlineSyncService = new OfflineSyncManager();

/**
 * React Hook to access network and offline sync status
 */
export function useNetworkSync(): NetworkSyncState & {
  triggerSync: () => Promise<{ syncedCount: number; errors: number }>;
} {
  const [syncState, setSyncState] = useState<NetworkSyncState>(() =>
    offlineSyncService.getState()
  );

  useEffect(() => {
    return offlineSyncService.subscribe((state) => {
      setSyncState(state);
    });
  }, []);

  const triggerSync = () => offlineSyncService.flushQueue();

  return {
    ...syncState,
    triggerSync,
  };
}
