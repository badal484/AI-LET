import { env } from '../../config/env.js';

/**
 * Tools that are disabled in EVERY environment until a real provider integration exists.
 * They cannot be re-enabled through the registry, capabilities, consent, planner, scheduler
 * or admin API: the gateway rejects them before any other check.
 */
export const HARD_DISABLED_TOOLS: ReadonlyMap<string, { code: string; message: string }> = new Map([
  [
    'payment.create',
    {
      code: 'PAYMENT_TOOL_DISABLED',
      message: 'Payments are disabled: no payment provider is integrated. No payment was made or authorized.',
    },
  ],
]);

/**
 * Tools whose adapters return simulated data (no provider integration yet). They only run when
 * AGENT_SIMULATED_TOOLS=true outside production/staging, and their output is always labelled.
 */
export const SIMULATED_TOOLS: ReadonlySet<string> = new Set(['calendar.read', 'calendar.create_event', 'email.send', 'document.analyze', 'browser.read']);

export function isHardDisabledTool(slug: string): boolean {
  return HARD_DISABLED_TOOLS.has(slug);
}

export function simulatedToolsAllowed(): boolean {
  return env.AGENT_SIMULATED_TOOLS && !['production', 'staging'].includes(env.NODE_ENV);
}
