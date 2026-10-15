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
   * Loads all persistent staff from LocalStorage with fallback recovery
   */
  loadPersistentStaff(): Employee[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw =
        localStorage.getItem(STORAGE_KEYS.STAFF_PRIMARY) ||
        localStorage.getItem(STORAGE_KEYS.STAFF_ENROLLED);

      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((emp) => emp && typeof emp === 'object' && emp.id && emp.name);
      }
      return [];
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
   * Saves or updates a biometric embedding in persistent storage
   */
  saveBiometricEmbedding(embedding: BiometricStaffEmbedding): void {
    if (typeof window === 'undefined') return;
    try {
      const current = this.getAllBiometricEmbeddings();
      current[embedding.employeeId] = embedding;
      localStorage.setItem(STORAGE_KEYS.EMBEDDINGS, JSON.stringify(current));
    } catch (err) {
      console.warn('[StaffStore] Failed to save biometric embedding:', err);
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
   * Preloads all enrolled staff biometrics into memory cache on Kiosk startup
   * Loads from persistent embedding cache or extracts in parallel without blocking UI
   */
  async preloadAllStaffBiometrics(staffList: Employee[]): Promise<void> {
    if (!staffList || staffList.length === 0) return;

    const storedEmbeddings = this.getAllBiometricEmbeddings();

    const tasks = staffList.map(async (emp) => {
      if (!emp || !emp.avatar || !this.hasValidFaceBiometrics(emp.avatar)) {
        return;
      }

      try {
        const stored = storedEmbeddings[emp.id];
        // If stored embedding exists and matches current avatar, seed memory cache directly
        if (stored && stored.avatarRef === emp.avatar && stored.signature?.length > 0) {
          setCachedBiometricProfile(emp.id, {
            avatarRef: stored.avatarRef,
            signature: stored.signature,
            signatureFlipped: stored.signatureFlipped,
            hash: stored.hash,
            hashFlipped: stored.hashFlipped,
            timestamp: Date.now(),
          });
          return;
        }

        // Otherwise extract and persist new embedding
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
