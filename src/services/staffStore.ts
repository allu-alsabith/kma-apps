import { Employee } from '../types';
import { 
  extractBiometricSignature, 
  CachedBiometricProfile, 
  setCachedBiometricProfile, 
  clearBiometricCache 
} from '../utils/faceRecognition';
import { offlineSyncService } from './offlineSync';
import { autoSyncService } from './autoSync';

export interface BiometricStaffEmbedding {
  employeeId: string;
  avatarRef: string;
  signature: number[];
  signatureFlipped: number[];
  hash: string;
  hashFlipped: string;
  enrolledAt: string;
  updatedAt: string;
  confidenceGrade: 'HIGH' | 'MEDIUM';
}

const STORAGE_KEYS = {
  STAFF_PRIMARY: 'attendo_real_workforce_staff',
  STAFF_ENROLLED: 'attendo_user_enrolled_staff',
  EMBEDDINGS: 'attendo_staff_biometric_embeddings',
};

class StaffStoreService {
  /**
   * Validates if a provided avatar string is a legitimate biometric photo reference
   * (Must not be blank and not a generic text/initials SVG placeholder)
   */
  hasValidFaceBiometrics(avatar?: string | null): boolean {
    if (!avatar || typeof avatar !== 'string') return false;
    const clean = avatar.trim();
    if (clean.length < 10) return false;

    // Reject generic dicebear/initials SVG placeholders that lack real facial biometrics
    if (clean.includes('dicebear.com/7.x/initials') || clean.includes('ui-avatars.com')) {
      return false;
    }

    // Accepts data URL, http/https URL, or valid image path
    return (
      clean.startsWith('data:image/') ||
      clean.startsWith('http://') ||
      clean.startsWith('https://') ||
      clean.startsWith('/')
    );
  }

  /**
   * Loads all persistent staff from LocalStorage with multi-key recovery
   * Inspects both primary and fallback keys, recovering any valid enrolled staff
   */
  loadPersistentStaff(): Employee[] {
    if (typeof window === 'undefined') return [];
    try {
      const primaryRaw = localStorage.getItem(STORAGE_KEYS.STAFF_PRIMARY);
      let primaryList: Employee[] = [];
      if (primaryRaw) {
        try {
          const parsed = JSON.parse(primaryRaw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            primaryList = parsed.filter((emp) => emp && typeof emp === 'object' && emp.id && emp.name);
          }
        } catch {}
      }

      const enrolledRaw = localStorage.getItem(STORAGE_KEYS.STAFF_ENROLLED);
      let enrolledList: Employee[] = [];
      if (enrolledRaw) {
        try {
          const parsed = JSON.parse(enrolledRaw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            enrolledList = parsed.filter((emp) => emp && typeof emp === 'object' && emp.id && emp.name);
          }
        } catch {}
      }

      // Merge by ID to guarantee no enrolled staff are dropped
      const staffMap = new Map<string, Employee>();
      for (const emp of enrolledList) {
        staffMap.set(emp.id, emp);
      }
      for (const emp of primaryList) {
        staffMap.set(emp.id, emp);
      }

      const merged = Array.from(staffMap.values());
      return merged;
    } catch (err) {
      console.warn('[StaffStore] Failed to parse persistent staff from LocalStorage:', err);
      return [];
    }
  }

  /**
   * Writes the staff list to persistent storage across both keys
   */
  savePersistentStaff(staff: Employee[]): void {
    if (typeof window === 'undefined') return;
    try {
      const serialized = JSON.stringify(staff);
      localStorage.setItem(STORAGE_KEYS.STAFF_PRIMARY, serialized);
      localStorage.setItem(STORAGE_KEYS.STAFF_ENROLLED, serialized);
    } catch (err) {
      console.warn('[StaffStore] Quota exceeded or failed to save persistent staff:', err);
    }
  }

  /**
   * Retrieves all persisted biometric embeddings map
   */
  getAllBiometricEmbeddings(): Record<string, BiometricStaffEmbedding> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.EMBEDDINGS);
      if (!raw) return {};
      return JSON.parse(raw) || {};
    } catch {
      return {};
    }
  }

  /**
   * Rehydrates all persistent biometric embeddings from LocalStorage into in-memory recognition cache.
   * Runs immediately on cold boot/startup so zero delay occurs for face recognition.
   */
  rehydrateBiometrics(): number {
    if (typeof window === 'undefined') return 0;
    try {
      const stored = this.getAllBiometricEmbeddings();
      let count = 0;
      for (const [empId, emb] of Object.entries(stored)) {
        if (emb && Array.isArray(emb.signature) && emb.signature.length >= 64) {
          setCachedBiometricProfile(empId, {
            avatarRef: emb.avatarRef || '',
            signature: emb.signature,
            signatureFlipped: emb.signatureFlipped || emb.signature,
            hash: emb.hash || '',
            hashFlipped: emb.hashFlipped || emb.hash || '',
            timestamp: Date.now(),
          });
          count++;
        }
      }
      return count;
    } catch (err) {
      console.warn('[StaffStore] Error rehydrating biometrics:', err);
      return 0;
    }
  }

  /**
   * Saves or updates a biometric embedding in persistent storage
   * Uses quota-safe compact avatarRef to prevent LocalStorage overflows
   */
  saveBiometricEmbedding(embedding: BiometricStaffEmbedding): void {
    if (typeof window === 'undefined') return;
    try {
      const current = this.getAllBiometricEmbeddings();
      // Compact oversized base64 avatarRef to avoid exceeding 5MB LocalStorage limit
      const storedEmbedding: BiometricStaffEmbedding = {
        ...embedding,
        avatarRef: embedding.avatarRef && embedding.avatarRef.length > 300
          ? `compact:${embedding.avatarRef.length}:${embedding.hash || ''}:${embedding.avatarRef.slice(0, 48)}`
          : embedding.avatarRef,
      };
      current[embedding.employeeId] = storedEmbedding;
      localStorage.setItem(STORAGE_KEYS.EMBEDDINGS, JSON.stringify(current));
    } catch (err) {
      console.warn('[StaffStore] Quota guard during biometric embedding save, pruning large refs:', err);
      try {
        const current = this.getAllBiometricEmbeddings();
        for (const k of Object.keys(current)) {
          if (current[k].avatarRef && current[k].avatarRef.length > 300) {
            current[k].avatarRef = `compact:${current[k].avatarRef.length}:${current[k].hash || ''}:${current[k].avatarRef.slice(0, 48)}`;
          }
        }
        current[embedding.employeeId] = {
          ...embedding,
          avatarRef: `compact:${embedding.avatarRef.length}:${embedding.hash || ''}:${embedding.avatarRef.slice(0, 48)}`,
        };
        localStorage.setItem(STORAGE_KEYS.EMBEDDINGS, JSON.stringify(current));
      } catch (fallbackErr) {
        console.error('[StaffStore] Critical LocalStorage quota error:', fallbackErr);
      }
    }
  }

  /**
   * Removes a biometric embedding from persistent storage
   */
  deleteBiometricEmbedding(employeeId: string): void {
    if (typeof window === 'undefined') return;
    try {
      const current = this.getAllBiometricEmbeddings();
      if (current[employeeId]) {
        delete current[employeeId];
        localStorage.setItem(STORAGE_KEYS.EMBEDDINGS, JSON.stringify(current));
      }
    } catch {
      // ignore
    }
  }

  /**
   * Extracts and permanently persists the 64D biometric spatial embeddings & dHash
   * for a staff member, seeding both local storage and in-memory cache
   */
  async extractAndPersistBiometricEmbedding(employee: Employee): Promise<BiometricStaffEmbedding | null> {
    if (!employee || !employee.avatar || !this.hasValidFaceBiometrics(employee.avatar)) {
      return null;
    }

    try {
      const bioNormal = await extractBiometricSignature(employee.avatar, false);
      const bioFlipped = await extractBiometricSignature(employee.avatar, true);

      const cachedProfile: CachedBiometricProfile = {
        avatarRef: employee.avatar,
        signature: bioNormal.signature,
        signatureFlipped: bioFlipped.signature,
        hash: bioNormal.hash,
        hashFlipped: bioFlipped.hash,
        timestamp: Date.now(),
      };

      // Seed in-memory recognition cache immediately
      setCachedBiometricProfile(employee.id, cachedProfile);

      const embedding: BiometricStaffEmbedding = {
        employeeId: employee.id,
        avatarRef: employee.avatar,
        signature: bioNormal.signature,
        signatureFlipped: bioFlipped.signature,
        hash: bioNormal.hash,
        hashFlipped: bioFlipped.hash,
        enrolledAt: employee.faceRegisteredDate || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        confidenceGrade: bioNormal.isFlat ? 'MEDIUM' : 'HIGH',
      };

      this.saveBiometricEmbedding(embedding);
      return embedding;
    } catch (err) {
      console.warn(`[StaffStore] Failed to extract biometric embedding for ${employee.id}:`, err);
      return null;
    }
  }

  /**
   * Preloads all enrolled staff biometrics into memory cache on Kiosk / Admin startup
   * Immediately rehydrates from persistent LocalStorage cache so verification is instant on cold boot
   */
  async preloadAllStaffBiometrics(staffList: Employee[]): Promise<void> {
    if (!staffList || staffList.length === 0) return;

    // 1. Synchronously rehydrate all existing stored embeddings to memory
    this.rehydrateBiometrics();

    const storedEmbeddings = this.getAllBiometricEmbeddings();

    const tasks = staffList.map(async (emp) => {
      if (!emp || !emp.avatar || !this.hasValidFaceBiometrics(emp.avatar)) {
        return;
      }

      try {
        const stored = storedEmbeddings[emp.id];
        // If stored embedding exists with a valid 64D signature, seed memory cache directly
        if (stored && Array.isArray(stored.signature) && stored.signature.length >= 64) {
          setCachedBiometricProfile(emp.id, {
            avatarRef: emp.avatar,
            signature: stored.signature,
            signatureFlipped: stored.signatureFlipped || stored.signature,
            hash: stored.hash || '',
            hashFlipped: stored.hashFlipped || stored.hash || '',
            timestamp: Date.now(),
          });
          return;
        }

        // If not in stored embeddings or missing 64D signature, extract and persist new embedding
        await this.extractAndPersistBiometricEmbedding(emp);
      } catch (err) {
        console.warn(`[StaffStore] Biometric preloading non-fatal skip for ${emp.id}:`, err);
      }
    });

    await Promise.allSettled(tasks);
  }

  /**
   * Saves a newly enrolled staff member to persistent storage and database sync
   */
  async saveStaffMember(employee: Employee): Promise<Employee> {
    if (!this.hasValidFaceBiometrics(employee.avatar)) {
      throw new Error('Valid face template photo is required for biometric staff enrollment.');
    }

    const currentStaff = this.loadPersistentStaff();
    const updatedStaff = [employee, ...currentStaff.filter((e) => e.id !== employee.id)];

    this.savePersistentStaff(updatedStaff);
    await this.extractAndPersistBiometricEmbedding(employee);

    // Sync to Firestore offline queue & cross-tab bus
    offlineSyncService.enqueue('SYNC_EMPLOYEE', employee);
    autoSyncService.broadcast('EMPLOYEE_ADDED', employee);

    return employee;
  }

  /**
   * Updates an existing staff member in persistent storage
   */
  async updateStaffMember(employee: Employee): Promise<Employee> {
    const currentStaff = this.loadPersistentStaff();
    const updatedStaff = currentStaff.map((e) => (e.id === employee.id ? employee : e));

    this.savePersistentStaff(updatedStaff);
    if (this.hasValidFaceBiometrics(employee.avatar)) {
      await this.extractAndPersistBiometricEmbedding(employee);
    }

    offlineSyncService.enqueue('SYNC_EMPLOYEE', employee);
    autoSyncService.broadcast('EMPLOYEE_UPDATED', employee);

    return employee;
  }

  /**
   * Deletes a staff member from persistent storage
   */
  deleteStaffMember(employeeId: string): void {
    const currentStaff = this.loadPersistentStaff();
    const updatedStaff = currentStaff.filter((e) => e.id !== employeeId);

    this.savePersistentStaff(updatedStaff);
    this.deleteBiometricEmbedding(employeeId);
    clearBiometricCache(employeeId);

    offlineSyncService.enqueue('SYNC_DELETE_EMPLOYEE', { id: employeeId });
    autoSyncService.broadcast('EMPLOYEE_DELETED', employeeId);
  }
}

export const staffStore = new StaffStoreService();

// Auto-rehydrate biometrics immediately on module import so all embeddings are ready on cold boot
if (typeof window !== 'undefined') {
  try {
    staffStore.rehydrateBiometrics();
  } catch {}
}
