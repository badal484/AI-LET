# CHARACTER COMMITMENTS

## 1. Definition

A `CharacterCommitment` represents a future conversational or contextual expectation established during a dialogue (e.g., *"Let's review chapter 2 on Friday"* or *"I'll remember you are working on your design portfolio"*).

---

## 2. Invariants & Guardrails

1. **Source Grounding**:
   - Every commitment must have an explicit `sourceMessageId` or `sourceEventId`. Commitments cannot be hallucinated without grounded dialogue evidence.
2. **No Real-World Commitments**:
   - Commitments must NEVER promise real-world actions, financial purchases, legal agreements, or medical diagnoses.
3. **Commitment Lifecycle**:
   ```text
   [ACTIVE] ──> [FULFILLED]
     │
     ├──> [MISSED]
     ├──> [EXPIRED]
     └──> [CANCELLED]
   ```
4. **Verification Pre-Check**:
   - Before referencing a commitment in context, the platform verifies it is still `ACTIVE`, not contradicted by newer user statements, and matches the active user/character scope.
