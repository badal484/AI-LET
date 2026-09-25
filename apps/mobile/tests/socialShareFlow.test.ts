import { describe, expect, it } from 'vitest';
import { ShareSafetyPipeline } from '../../api/src/modules/social/safety/ShareSafetyPipeline.js';

describe('Mobile Social Share Flow Validation', () => {
  it('requires confirmation token before publishing when PII is detected', () => {
    const input = [
      { ref: 'm1', text: 'Hey, email me at test@example.com!' },
      { ref: 'm2', text: 'Sure, I will write back soon.' },
    ];
    const preview = ShareSafetyPipeline.run(input, { highRiskPiiAction: 'REDACT_AND_CONFIRM' });

    expect(preview.decision.action).toBe('REQUIRE_CONFIRMATION');
    expect(preview.items[0]!.text).not.toContain('test@example.com');
    expect(preview.items[0]!.redacted).toBe(true);
    expect(preview.fingerprint).toBeTruthy();

    const token = ShareSafetyPipeline.issueConfirmationToken('user-1', preview.fingerprint);
    expect(ShareSafetyPipeline.verifyConfirmationToken('user-1', preview.fingerprint, token)).toBe(true);

    // Mismatched user or fingerprint fails
    expect(ShareSafetyPipeline.verifyConfirmationToken('user-2', preview.fingerprint, token)).toBe(false);
    expect(ShareSafetyPipeline.verifyConfirmationToken('user-1', 'tampered-preview', token)).toBe(false);
  });

  it('strictly blocks sharing when credit card details are present under BLOCK policy', () => {
    const input = [
      { ref: 'm1', text: 'My card is 4111 1111 1111 1111' },
    ];
    const preview = ShareSafetyPipeline.run(input, { highRiskPiiAction: 'BLOCK' });

    expect(preview.decision.action).toBe('BLOCK');
    expect(preview.decision.reasons).toContain('HIGH_RISK_PII');
  });

  it('allows manual redactions to hide specific sensitive text before scanning', () => {
    const input = [
      { ref: 'm1', text: 'My secret location is 42 Wallaby Way', manualRedactions: ['42 Wallaby Way'] },
    ];
    const preview = ShareSafetyPipeline.run(input, { highRiskPiiAction: 'REDACT_AND_CONFIRM' });

    expect(preview.items[0]!.text).toContain('[hidden]');
    expect(preview.items[0]!.text).not.toContain('42 Wallaby Way');
  });
});
