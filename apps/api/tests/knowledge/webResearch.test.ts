import { describe, it, expect, afterAll } from 'vitest';
import { WebResearchService } from '../../src/modules/knowledge/services/WebResearchService.js';
import { SecureBrowserTool } from '../../src/modules/agents/SecureBrowserTool.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';

describe('Phase 26: Web Research Platform & SSRF Defenses', () => {
  const service = WebResearchService.getInstance();
  const browser = SecureBrowserTool.getInstance();
  const testUserId = 'user_research_tester_001';
  let createdTaskId = '';

  afterAll(async () => {
    if (createdTaskId) {
      await prisma.webSourceRecord.deleteMany({ where: { researchTaskId: createdTaskId } });
      await prisma.webResearchTask.deleteMany({ where: { id: createdTaskId } });
    }
  });

  it('decomposes comparison queries into multiple targeted subqueries', () => {
    const subqueries = service.generateSubqueries('Compare PostgreSQL vs MongoDB for high-throughput messaging');
    expect(subqueries.length).toBeGreaterThanOrEqual(2);
    expect(subqueries[0]).toContain('Compare PostgreSQL vs MongoDB');
  });

  it('strictly blocks SSRF loopback, AWS metadata, and private subnet targets', async () => {
    const loopback = browser.validateUrl('http://127.0.0.1:8080/internal/admin');
    expect(loopback.isValid).toBe(false);
    expect(loopback.reason).toContain('internal host');

    const metadata = browser.validateUrl('http://169.254.169.254/latest/meta-data/');
    expect(metadata.isValid).toBe(false);

    const privateSubnet = browser.validateUrl('http://10.0.1.45/internal-api');
    expect(privateSubnet.isValid).toBe(false);

    await expect(browser.fetchWebpage('http://127.0.0.1/admin')).rejects.toThrow(/SSRF_ATTEMPT_DETECTED/);
  });

  it('executes bounded research task and persists verified sources with metadata', async () => {
    const task = await service.executeResearch({
      userId: testUserId,
      query: 'Quantum Computing Fault Tolerance 2026',
      maxSources: 3,
    });

    expect(task.id).toBeDefined();
    expect(task.status).toBe('COMPLETED');
    expect(task.sourceCount).toBeGreaterThan(0);
    expect(task.sources).toBeDefined();
    expect(task.sources?.[0].url).toContain('https://');
    expect(task.sources?.[0].contentHash).toBeDefined();

    createdTaskId = task.id;

    // Verify task retrieval via DB lookup
    const retrieved = await service.getResearchTask(task.id, testUserId);
    expect(retrieved.id).toBe(task.id);
    expect(retrieved.sources?.length).toBe(task.sourceCount);
  });
});
