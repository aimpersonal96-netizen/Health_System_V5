# Health V5 — Master Project Checklist

This file is the persistent checklist for the central Codex task: **Health V5 — ศูนย์กลางโครงการ**.

## Central-task rules

- Keep this checklist synchronized with the side-panel plan in the central task.
- Do not replace the central side-panel plan with a module-level implementation plan.
- Run only one implementation module at a time to avoid overlapping file changes.
- A completed module must report tests, acceptance evidence, and a Git commit before being locked here.
- Changes to locked Schema, Auth, Permission, roles, or security workflows require approval and a Change Record.
- DEV uses synthetic data. Personal test emails are allowed only for the approved Email OTP test workflow.

## Master checklist

- [x] G0 — Blueprint v1.3.3 and Design System v1.1 approved and locked.
- [x] G1 — Canonical 20-sheet database created; 402 columns; Foundation Audit passed.
- [x] G2 — Data Integrity passed; 97 DEV records; PK/FK/Soft delete/RowVersion passed.
- [x] G3 — Authentication, Email OTP, Session, Trusted Device, Permission, and field masks passed.
- [ ] UI Foundation — HTML Service shell, Login UI, responsive navigation, and role dashboards.
- [ ] Student/Classroom — ADMIN/HEALTH management and scoped TEACHER read-only views.
- [ ] Medication/Break-glass — active medication field mask, NationalID emergency access, and external request workflow.
- [ ] Health modules — Health, Fitness, Refer, Nurse Visit, and Visit Items.
- [ ] Stock modules — Drug item master, Lot/Ledger, stock transactions, and FEFO.
- [ ] Context modules — Dorm, Student Dorm History, Duty, Assignment, and Disease Events.
- [ ] Reports — role dashboards, decision reports, and scoped exports.
- [ ] G4 — append-only audit hash chain, export trace, PDF documents, FEFO, and transaction compensation.
- [ ] G5 — UAT, security/privacy testing, accessibility, backup/restore, documentation, and Production deployment.

## Current state

- Current locked gate: **G3**
- Next implementation: **UI Foundation — Login and Dashboard shell**
- Latest accepted Git commit: `3f9b906`
- Apps Script DEV email mode: `SEND`
- Business-module UI has not started.

