# Developer Quickstart Guide

Build real-time AI companion experiences, automated support bots, embeddable web characters, and agentic workflows in minutes.

---

## 1. Install Official SDK

```bash
# Using npm
npm install @ai-companion/sdk

# Using pnpm
pnpm add @ai-companion/sdk

# Using yarn
yarn add @ai-companion/sdk
```

---

## 2. Initialize Client

Grab your secret API key from the Developer Portal (`sk_live_...` or `sk_test_...`):

```typescript
import { PlatformClient } from '@ai-companion/sdk';

const client = new PlatformClient({
  apiKey: process.env.PLATFORM_API_KEY,
  baseUrl: 'https://api.companion.ai/v1',
});
```

---

## 3. Discover Characters & Start a Conversation

```typescript
async function run() {
  // 1. Fetch available characters
  const characters = await client.characters.list({ limit: 5 });
  const character = characters.data[0];
  console.log(`Chatting with: ${character.name} (${character.tagline})`);

  // 2. Create or resolve an active conversation
  const conversation = await client.conversations.create({
    characterId: character.id,
  });

  // 3. Send a message and await response
  const reply = await client.messages.create(conversation.id, {
    content: "What's the most exciting new astrophysics discovery this month?",
  });

  console.log(`${character.name}: ${reply.content}`);
}

run().catch(console.error);
```

---

## 4. Real-Time Streaming via Server-Sent Events (SSE)

For interactive interfaces, stream tokens in real-time:

```typescript
const stream = await client.messages.stream(conversation.id, {
  content: "Tell me a short science fiction story about Europa's sub-surface ocean.",
});

for await (const chunk of stream) {
  if (chunk.type === 'message.delta') {
    process.stdout.write(chunk.delta);
  } else if (chunk.type === 'message.completed') {
    console.log('\n[Stream Completed]');
  }
}
```

---

## 5. Listen to Asynchronous Webhooks

Register a webhook endpoint in your Developer Dashboard and verify incoming signatures:

```typescript
import express from 'express';
import { WebhookVerifier } from '@ai-companion/sdk';

const app = express();
const verifier = new WebhookVerifier(process.env.WEBHOOK_SIGNING_SECRET!);

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-signature'] as string;
  const timestamp = req.headers['x-timestamp'] as string;

  try {
    const event = verifier.verify(req.body.toString(), signature, timestamp);
    console.log(`Received verified event: ${event.type} [${event.id}]`);

    // Handle event types
    if (event.type === 'message.completed') {
      console.log(`Assistant message: ${event.data.content}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    res.status(401).json({ error: 'Invalid webhook signature' });
  }
});

app.listen(3000);
```
