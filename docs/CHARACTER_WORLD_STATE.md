# PERSISTENT CHARACTER WORLD STATE

## 1. Concept

`CharacterWorldState` models persistent factual entities representing ongoing fictional settings, projects, items, and environment facts.

- **World State vs Knowledge Engine**: Knowledge answers *"What reference lore does the character know?"*. World state answers *"What is currently happening in the ongoing fictional continuity?"*.
- **World State vs Memory Engine**: Memory answers *"What user facts should be remembered across conversations?"*. World state answers *"What active project/setting states exist in the simulation?"*.

---

## 2. Schema & Versioning

```typescript
interface CharacterWorldStateItem {
  id: string;
  characterId: string;
  characterVersionId?: string;
  entityKey: string; // e.g. "current_painting_project"
  entityType: 'LOCATION' | 'PROJECT' | 'ITEM' | 'EVENT' | 'RELATION' | 'CUSTOM';
  value: Record<string, any>;
  version: number;
  scope: 'GLOBAL' | 'USER';
  userId?: string;
}
```

---

## 3. Event Sourcing & Replay

Every mutation creates an immutable event in `CharacterWorldStateEvent`:
```typescript
interface CharacterWorldStateEventItem {
  id: string;
  worldStateId: string;
  eventType: 'CREATED' | 'UPDATED' | 'DELETED' | 'VERSION_MIGRATED';
  previousValue?: Record<string, any>;
  newValue: Record<string, any>;
  source: string;
  sourceEventId?: string;
  createdAt: string;
}
```

This guarantees full state auditability, rollback support, and time-travel replay.
