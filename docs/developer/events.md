# Public Event Catalog

Stable event types emitted by the AI Companion Platform.

---

## Catalog

### 1. `conversation.created`
Fired when a new conversation is initiated between a user and a character.
* **Payload**: `conversation_id`, `character_id`, `title`, `created_at`

### 2. `message.completed`
Fired when the assistant finishes generating a response.
* **Payload**: `message_id`, `conversation_id`, `content`, `tokens`

### 3. `character.published`
Fired when a character passes creator review and becomes publicly discoverable.
* **Payload**: `character_id`, `name`, `published_at`

### 4. `agent.task.created`
Fired when an autonomous agent task is accepted for execution.
* **Payload**: `task_id`, `character_id`, `status`, `created_at`

### 5. `agent.task.awaiting_confirmation`
Fired when an agent task encounters a high-risk tool action requiring user confirmation.
* **Payload**: `task_id`, `action_id`, `tool_name`, `description`

### 6. `agent.task.completed`
Fired when all plan steps for an agent task finish successfully.
* **Payload**: `task_id`, `character_id`, `result`, `duration_ms`

### 7. `agent.task.failed`
Fired when an agent task fails or is cancelled.
* **Payload**: `task_id`, `status`, `reason`

### 8. `usage.limit_reached`
Fired when a developer project reaches 100% of its monthly spend budget.
* **Payload**: `project_id`, `monthly_budget_usd`, `current_spend_usd`

### 9. `user.deleted`
Fired when a platform user exercises GDPR/CCPA erasure rights, allowing third-party apps to prune external references.
* **Payload**: `user_id`, `deleted_at`
