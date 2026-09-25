import { describe, it, expect } from 'vitest';
import { MigrationHelper } from '../src/infrastructure/database/MigrationHelper.js';

describe('MigrationHelper & Backfill Safety', () => {
  it('executes chunked backfills with rate-limiting and progress tracking', async () => {
    const mockItems = Array.from({ length: 25 }, (_, i) => ({ id: `item_${i}`, value: i }));

    const processedIds: string[] = [];

    const result = await MigrationHelper.runChunkedBackfill({
      name: 'test_backfill',
      batchSize: 10,
      delayBetweenBatchesMs: 10,
      fetchBatch: async (cursor, limit = 10) => {
        let startIndex = 0;
        if (cursor) {
          startIndex = mockItems.findIndex(i => i.id === cursor) + 1;
        }
        return mockItems.slice(startIndex, startIndex + limit);
      },
      getCursor: (item) => item.id,
      processItem: async (item) => {
        processedIds.push(item.id);
      },
    });

    expect(result.completed).toBe(true);
    expect(result.totalProcessed).toBe(25);
    expect(result.totalErrors).toBe(0);
    expect(processedIds.length).toBe(25);
  });
});
