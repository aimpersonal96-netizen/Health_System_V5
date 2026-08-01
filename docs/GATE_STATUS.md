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

## G2 — Pending User Acceptance to Start

- [ ] Implement the shared batch repository.
- [ ] Implement PK, unique-key, FK, type, required-field, and allowed-value validation.
- [ ] Implement LockService, soft delete, and RowVersion controls.
- [ ] Seed synthetic DEV data and integrity test cases.
- [ ] Produce the Data Integrity Report and verify structure backup/restore.

No G2 implementation or mock-data seeding has started.
