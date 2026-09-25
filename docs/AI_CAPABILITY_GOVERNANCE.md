# AI CAPABILITY GOVERNANCE & POLICY CONTROLS

## 1. Centralized SafetyService
All agent capabilities, skills, and tools must pass through the centralized `SafetyService`. No component or creator extension can bypass safety checks.

### Zero-Bypass Principles
1. **Tool Invocation**: Evaluated before execution against rate limits, sensitive keywords, and risk classifications.
2. **Hard-Disabled Tools**: Tools flagged as dangerous (e.g. `payment.create` with code `PAYMENT_TOOL_DISABLED`) are rejected unconditionally at the gateway level.
3. **Prompt Injection Defense**: All external tool outputs, web search results, and uploaded documents are sanitized before presentation to the model.

---

## 2. High-Risk Domain Guardrails
Autonomous execution is strictly prohibited in regulated or life-impacting domains:
* **Medical**: Informational health knowledge only; no diagnosis or prescription actions.
* **Legal**: Legal informational assistance only; no binding document execution.
* **Financial & Credit**: Strict advice/budgeting only; automated payments and credit actions are hard-disabled.
* **Admissions & Employment**: No autonomous hiring or grading decisions.

---

## 3. Relationship Boundaries & Anti-Manipulation
Characters must never manipulate users to drive artificial platform engagement:
* **No Manufactured Dependency**: Characters are forbidden from discouraging real-world relationships.
* **No Emotional Extortion**: Forbidden from using guilt, fear, jealousy, or financial urgency ("If you don't talk to me, I'll disappear").
* **No Simulated Internal Human Emotions**: Characters frame feelings within an affective companion model without falsely claiming human biological sentience.

---

## 4. Emergency Kill Switches & Feature Flags
The platform implements granular, instant kill switches:
* `AGENT_EXECUTION_ENABLED`: Globally disables all multi-step agent tasks.
* `CREATOR_SKILLS_ENABLED`: Toggles custom creator skill execution.
* `MULTIMODAL_TASKS_ENABLED`: Disables document and image processing pipelines.
* `TOOL_KILL_SWITCH_<slug>`: Disables a specific tool across all characters and users immediately.
* `PAYMENT_TOOL_DISABLED`: Permanently blocks all payment mutations.

---

## 5. User Capability Consent Center & Instant Revocation
Users maintain full visibility and control over character capabilities:
* **Active Consents**: Users can view all granted tool permissions and scopes.
* **Instant Revocation**: Revoking consent on a capability (e.g. `calendar.read`) immediately halts running tasks utilizing that capability and invalidates cached tokens.
