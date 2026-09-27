# Security Specification: Attendo Hypermarket Attendance System

## 1. Data Invariants
1. **Employee Identity**: Every employee record must have a valid non-empty `id`, `name`, `role`, `department`, and `pin`.
2. **Punch Integrity**: Attendance records must specify `employeeId`, `employeeName`, `type` ('IN' or 'OUT'), and valid `method`.
3. **Leave Request Validation**: Leave applications must have valid dates and a recognized status ('PENDING', 'APPROVED', 'REJECTED').
4. **Terminal & Mobile Authorization**: Attendance events can be logged by the store kiosk or verified staff mobile application.
5. **Admin Access**: Store Admin operations (enrollment, leave approvals, configuration) are restricted to authorized store operators. User email from runtime (`amhereitsmeal@gmail.com`) is designated as primary admin.

## 2. The Dirty Dozen Attack Payloads (Must be Blocked)
1. Write to an unmapped collection: `/secrets/leak` -> PERMISSION_DENIED
2. Malformed employee ID with script injection or path traversal: `../bad` -> PERMISSION_DENIED
3. Employee with oversized payload (>50KB junk string) -> PERMISSION_DENIED
4. Attendance record with invalid punch type `type: "HACK"` -> PERMISSION_DENIED
5. Attendance record with negative confidence `confidence: -1.0` -> PERMISSION_DENIED
6. Leave request with empty employeeId or invalid status -> PERMISSION_DENIED
7. Direct tamper of immutable creation timestamps -> PERMISSION_DENIED
8. Spoofed admin role injection on unauthenticated write -> PERMISSION_DENIED
9. Exceeding field length boundaries for names and text -> PERMISSION_DENIED
10. Unbounded bulk deletion of attendance audit logs -> PERMISSION_DENIED
11. Modifying another employee's PIN from an unprivileged client -> PERMISSION_DENIED
12. Creating orphaned punch record referencing non-existent path -> PERMISSION_DENIED
