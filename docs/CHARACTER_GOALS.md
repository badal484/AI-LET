# CHARACTER GOALS & MULTI-STEP PLANS

## 1. CharacterGoal Model & Lifecycle

A `CharacterGoal` represents a long-horizon objective tracked across weeks or months.

### 1.1 Goal Types
- `PERSONAL_DEVELOPMENT`: Internal character skill, habit, or mindset growth.
- `CREATIVE`: Fictional creative endeavors (e.g., painting series, novel writing).
- `KNOWLEDGE`: Exploration of a specific domain or intellectual subject.
- `PROJECT`: Bounded multi-stage project with deliverables.
- `CONVERSATIONAL`: Guiding a nuanced ongoing thematic discussion.
- `RELATIONSHIP_CONTEXT`: Milestone within the relationship lifecycle.

### 1.2 Status Transitions
```text
[DRAFT] ──> [ACTIVE] ──> [COMPLETED]
              │    │
              │    ├──> [PAUSED] ──> [ACTIVE]
              │    │
              │    └──> [EXPIRED]
              │
              └──> [CANCELLED] / [FAILED]
```

---

## 2. CharacterPlan & Step Dependency Graph

A `CharacterPlan` decomposes a goal into discrete, verifiable steps.

### 2.1 Step Graph Schema
```typescript
interface CharacterPlanStepItem {
  id: string;
  planId: string;
  sequence: number;
  title: string;
  description?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'BLOCKED';
  dependencies: string[]; // List of step IDs that must be COMPLETED before activation
  completionCriteria?: string;
  estimatedEffort?: string;
}
```

### 2.2 Server-Side Execution Rules
1. A step cannot transition to `IN_PROGRESS` or `COMPLETED` unless all prerequisite step IDs listed in `dependencies` are `COMPLETED`.
2. Plans never execute external actions silently; external tasks are routed to the Agent Runtime with user authorization.
3. If a user explicitly dismisses a plan (*"Let's not do that watercolor project anymore"*), the platform marks the plan as `CANCELLED` and emits a plan cancellation event.
