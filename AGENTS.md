# Health V5 repository coordination

## Required reading

Before changing this repository, read:

1. `docs/MASTER_CHECKLIST.md`
2. `docs/GATE_STATUS.md`
3. `docs/Health_V5_System_Blueprint_v1.3.3_APPROVED_20_Sheets_FINAL.txt`
4. `docs/Student_Health_Center_Design_System_v1.1_Clinical_Navy.txt`

Treat the Blueprint, Gate Status, and locked decisions as authoritative.

## Automatic checklist maintenance

Every implementation task must maintain `docs/MASTER_CHECKLIST.md` as part of its normal delivery. The user does not need to remind the task.

- At the start of a module, update **Current state** to identify the active module and its starting Git revision.
- During partial work, leave the module checkbox unchecked. Record concise progress under **Current state** only when useful.
- Mark a module complete only after required tests pass, remote DEV verification succeeds where applicable, and the user accepts the result.
- When a module is accepted, check its item, update the latest accepted Git commit, update `docs/GATE_STATUS.md`, and include both files in the module commit.
- Never mark work complete only because code was written or pushed.
- Never change a completed/locked item back to pending without an approved Change Record.
- Preserve unrelated and uncommitted changes from other tasks.

## Central task synchronization

The Codex task titled **Health V5 — ศูนย์กลางโครงการ** owns the master side-panel plan.

- `docs/MASTER_CHECKLIST.md` is the durable source for that panel.
- When the central task is opened or receives a status request, synchronize its side-panel plan from the file and `docs/GATE_STATUS.md`.
- Module tasks may use their own detailed plans, but must not replace or reinterpret the durable master checklist.

## Concurrency

- Run only one implementation module against the shared project checkout at a time.
- Do not stage or commit files belonging to another active task.
- A module handoff must include test results, DEV verification when required, and the commit hash.

