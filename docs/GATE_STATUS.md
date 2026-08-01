# Health V5 Gate Status

## G0 — Approved & Locked

- [x] Blueprint v1.3.3 is the architecture single source of truth.
- [x] Design System v1.1 is approved and locked.
- [x] Canonical schema remains exactly 20 sheets.
- [x] OTP policy is fixed at 10-minute expiry, 60-second resend delay, and 3 sends per 15 minutes.
- [x] Emergency access from a new device is limited to one student for 5 minutes and is fully audited.
- [x] Security notification emails exclude full NationalID, medication, and health details.
- [x] Concept 07+10 logo is available as SVG and transparent PNG at 512, 192, 96, 48, and 24 px.
- [x] UTF-8 encoding and LF line endings are verified for canonical documents.

**Status:** `APPROVED & LOCKED`

## G1 — Approved & Locked

- [x] Built the canonical 20-sheet schema registry from Blueprint v1.3.3.
- [x] Implemented the idempotent database setup.
- [x] Seeded ConfigDB, RoleDB, and PermissionDB without duplicate keys.
- [x] Applied canonical headers, data formats, validation, Clinical Navy styling, and header protection.
- [x] Implemented and ran the foundation audit.
- [x] User verified: 20 sheets, 402 total columns, Schema v1.3.3.

**Acceptance evidence:** User reported `Audit ผ่าน 20 ชีต 402 คอลัมน์` on 2026-08-01.

**Status:** `APPROVED & LOCKED`

## G2 — Approved & Locked

- [x] Implemented the shared batch repository with document-level LockService.
- [x] Implemented PK, explicit unique-key, FK, type, required-field, and allowed-value validation.
- [x] Implemented soft delete through RecordStatus and optimistic locking through RowVersion.
- [x] Seeded synthetic DEV data for staff, classrooms, students, dorms, duty, assignments, and medication plans.
- [x] Added rejection tests for duplicate keys, invalid FK, and invalid RowVersion.
- [x] Implemented the Data Integrity Report and verified schema structure round-trip.
- [x] Normalized Google Sheets checkbox values without changing their Boolean meaning.

**Acceptance evidence:** User reported `G2 Data Integrity ผ่าน`, 97 records checked, 0 errors, and PK/FK/Soft delete/RowVersion passed on 2026-08-01.

**Status:** `APPROVED & LOCKED`

## G3 — Pending User Acceptance to Start

- [ ] Implement ADMIN/HEALTH credential login and Email OTP.
- [ ] Implement TEACHER/EXECUTIVE first-use verification and trusted-device lifecycle.
- [ ] Implement session, idle timeout, lockout, and device revocation.
- [ ] Implement CLASSROOM, DUTY, and DORM access contexts.
- [ ] Enforce PermissionDB and field masking on every backend request.
- [ ] Implement security-event email metadata contract and G3 tests.

No G3 authentication, trusted-device, session, or permission implementation has started.
