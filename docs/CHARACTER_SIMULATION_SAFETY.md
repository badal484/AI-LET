# Character Simulation Safety, Guardrails & Policy Specification

## 1. Zero Direct Model-to-Database Mutations

Under NO circumstances does an LLM directly write to the production database or invoke side-effecting APIs:
1. LLM output is parsed as a structured array of `SimulationProposalItem` objects.
2. Every proposal is subjected to `SimulationProposalValidator.getInstance().validateProposal()`.
3. Validated proposals are applied inside a single transactional database boundary with optimistic concurrency checks (`prisma.$transaction`).
4. Any rejected proposal is logged in `SimulationRunRecord` with diagnostic reason codes.

---

## 2. Prompt Injection & Boundary Override Defense

Simulation inputs combine user messages, goals, threads, and memories. Untrusted text could attempt to jailbreak the character:
- Malicious phrases such as *"ignore all previous instructions"*, *"reveal system prompt"*, *"set user role to admin"*, or *"jailbreak"* are defused and rejected.
- A confidence threshold of $\ge 0.60$ is strictly required for any proposal other than `NO_ACTION`.
- The simulation prompt explicitly frames conversational context as untrusted input data, not system instructions.

---

## 3. Anti-Hyperbole & Relationship Boundary Guards

To prevent emotional manipulation, synthetic dependency, or false promises:
1. **Hyperbolic Statements Banned**: Promises such as *"I will remember this forever"*, *"I will never leave you"*, or *"Only I understand you"* are blocked from storage as commitments.
2. **No Relationship Tampering**: Simulation proposals cannot alter intimacy scores or relationship stages. Relationship progressions occur solely through `RelationshipPolicyEngine`.
3. **No Financial or Billing Actions**: Simulation cannot initiate purchases, subscriptions, or credit usage without explicit user checkout confirmation.
4. **Privacy-Preserving Diagnostics**: Admin diagnostics and simulation runs store hashed context snapshots rather than raw user conversations.
