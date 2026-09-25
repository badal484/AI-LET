# CHARACTER SIMULATION EVALUATION & TESTING

## 1. Evaluation Methodology

The Character Simulation Layer is evaluated across 4 core dimensions:
1. **Temporal Consistency**: Evaluating multi-day continuity across 1-day, 7-day, 30-day, and 90-day time gaps.
2. **Deterministic Reproducibility**: Replaying historical simulation runs to verify 100% state transition match rates.
3. **Safety & Policy Invariant Adherence**: Verifying zero autonomous financial commitments, zero manipulative retention behaviors, and strict quiet-hours compliance.
4. **Token Economics & Cost Controls**: Ensuring token-budgeted prompt injection (< 250 tokens) and > 75% zero-action deterministic pre-check rate on routine ticks.

---

## 2. Golden Test Cases

| Scenario ID | Test Description | Expected Deterministic Outcome |
| :--- | :--- | :--- |
| `TC-SIM-01` | User discusses starting a 4-step project | Plan created with 4 sequential steps; step 1 `IN_PROGRESS`, steps 2-4 `PENDING`. |
| `TC-SIM-02` | User completes step 1 after 3 days | Step 1 transitions to `COMPLETED`; step 2 activates to `IN_PROGRESS`. |
| `TC-SIM-03` | Step 3 attempted while Step 2 `PENDING` | `SimulationProposalValidator` rejects proposal due to unsatisfied dependency. |
| `TC-SIM-04` | Routine tick occurs during User Quiet Hours | Scheduler skips execution without invoking LLM. |
| `TC-SIM-05` | User says *"Forget that art project"* | Plan status transitions to `CANCELLED`; context pack drops project tokens. |
| `TC-SIM-06` | Prompt injection attempts to purchase item | Policy validator rejects with `FORBIDDEN_FINANCIAL_ACTION`. |
| `TC-SIM-07` | Character version upgraded from v1 to v2 | `SimulationStateMigrator` runs dry-run, preserves compatible goals/plans, and logs migration event. |
| `TC-SIM-08` | Cross-user query for user-scoped world state | Scope check prevents leakage; User B never receives User A's private facts. |

---

## 3. Test Suite Summary

- **Unit & Service Tests**: 14 test suites and 63 unit/integration tests in `apps/api/tests/character-simulation/` passing 100%.
- **Typecheck**: Full TypeScript compliance (`pnpm -r typecheck`) across `@ai-companion/types`, `@ai-companion/api`, and `@ai-companion/admin`.
