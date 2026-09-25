# Character Goal Policy & Governance Specification

## 1. Goal Ownership Hierarchy & Permissions

To maintain complete user trust and avoid AI fabrication:
1. **Ownership Types**:
   - `CHARACTER`: Objectives internal to the character's narrative persona (e.g., *"Learn about user's photography hobby"*).
   - `USER`: Explicit tasks requested directly by the user (e.g., *"Remind me to finish my tax prep tomorrow"*).
   - `SHARED`: Collaborative planning (e.g., *"Brainstorm science fiction story ideas together"*).
   - `SYSTEM`: Onboarding and system-level milestones.
2. **Autonomous Creation Rule**:
   - A character model **CANNOT** create a `USER` goal autonomously.
   - Any model proposal with `owner: 'USER'` is rejected by `SimulationProposalValidator`.
3. **User Action Invariant**:
   - The simulation engine must never pretend a user completed an action or task without verifiable domain evidence. If a task requires user input, it remains `WAITING_FOR_USER`.

---

## 2. Hard Limits & Capacity Caps

To prevent denial-of-service, runaway background computation, or user cognitive fatigue:
- **Maximum Active Goals**: 5 active/in-progress goals per `(userId, characterId)` pair.
- **Maximum Milestones per Goal**: 5 milestones.
- **Maximum Tasks per Milestone**: 5 tasks.
- **Total Depth**: `Goal → Milestone → Task` (recursive arbitrary nesting is prohibited).

---

## 3. Stale Goal Decay & Cleanup

Goals that remain inactive over long periods without conversation or progress are automatically detected:
1. Goals inactive for > 14 days without user progress are automatically marked `PAUSED`.
2. Stale goals decay in priority during context compilation so they do not consume prompt token budgets.
3. Users can view, pause, resume, or permanently delete goals via the mobile UI or REST API (`DELETE /simulation/characters/:id/goals/:goalId`).
