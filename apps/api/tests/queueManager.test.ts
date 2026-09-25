import { describe, it, expect } from 'vitest';
import { QueueManager } from '../src/infrastructure/queues/QueueManager.js';

describe('QueueManager & DLQ Resilience', () => {
  it('correctly categorizes errors into transient, permanent, authentication, and rate-limited', () => {
    const rateLimitErr = new Error('Rate limit exceeded 429 too many requests');
    expect(QueueManager.categorizeError(rateLimitErr)).toBe('RATE_LIMITED');

    const authErr = new Error('401 Unauthorized API key invalid');
    expect(QueueManager.categorizeError(authErr)).toBe('AUTHENTICATION');

    const schemaErr = new Error('Invalid input validation failed');
    expect(QueueManager.categorizeError(schemaErr)).toBe('PERMANENT');

    const timeoutErr = new Error('Connection timeout 504 Gateway Timeout');
    expect(QueueManager.categorizeError(timeoutErr)).toBe('TRANSIENT');
  });

  it('manages Dead Letter Queue job inspections and clears them properly', async () => {
    // Check initial DLQ list
    const dlqJobs = QueueManager.getDeadLetterJobs();
    expect(Array.isArray(dlqJobs)).toBe(true);

    const cleared = QueueManager.clearDeadLetterJob('nonexistent-job-id');
    expect(cleared).toBe(false);
  });
});
