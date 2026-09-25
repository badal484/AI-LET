import { AGENT_CONSTANTS } from '@ai-companion/config';
import { ToolResultSanitizer } from './ToolResultSanitizer.js';
import { logger } from '../../shared/utils/logger.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';
import { simulatedToolsAllowed } from './toolSafety.js';

export interface WebpageFetchResult {
  title: string;
  cleanText: string;
  sourceUrl: string;
  fetchedAt: string;
}

export class SecureBrowserTool {
  private static instance: SecureBrowserTool;
  private readonly sanitizer = ToolResultSanitizer.getInstance();

  private constructor() {}

  public static getInstance(): SecureBrowserTool {
    if (!SecureBrowserTool.instance) {
      SecureBrowserTool.instance = new SecureBrowserTool();
    }
    return SecureBrowserTool.instance;
  }

  /**
   * Validates target URL against SSRF blocklist and protocol restrictions
   */
  public validateUrl(rawUrl: string): { isValid: boolean; reason?: string; parsedUrl?: URL } {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return { isValid: false, reason: 'Malformed URL format.' };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { isValid: false, reason: `Disallowed protocol '${parsed.protocol}'. Only HTTPS/HTTP permitted.` };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check SSRF Blocklist Patterns
    for (const pattern of AGENT_CONSTANTS.SSRF_BLOCKLIST_PATTERNS) {
      if (hostname === pattern || hostname.startsWith(pattern) || hostname.endsWith(`.${pattern}`)) {
        logger.warn(`SSRF Blocked: URL '${rawUrl}' matched blocked pattern '${pattern}'`);
        return { isValid: false, reason: `Access to internal host '${hostname}' is strictly forbidden.` };
      }
    }

    return { isValid: true, parsedUrl: parsed };
  }

  /**
   * Fetches and sanitizes clean text from an external web URL with full SSRF protection
   */
  public async fetchWebpage(rawUrl: string): Promise<WebpageFetchResult> {
    const validation = this.validateUrl(rawUrl);
    if (!validation.isValid) {
      throw new Error(`SSRF_ATTEMPT_DETECTED: ${validation.reason}`);
    }

    // No sandboxed fetcher/renderer is integrated. Outside dev/test simulation, fail honestly rather
    // than hand the model invented "page content" it would present as fact.
    if (!simulatedToolsAllowed()) {
      throw new AppError('Web page reading is not available: no sandboxed browser provider is configured.', 503, ErrorCode.TOOL_PROVIDER_NOT_CONFIGURED);
    }
    logger.info(`SecureBrowserTool [SIMULATED] fetching validated external URL: ${rawUrl}`);

    const title = `[SIMULATED] Information from ${validation.parsedUrl?.hostname}`;
    const rawContent = `[SIMULATED] Placeholder page content for ${rawUrl} (dev/test simulation; no real page was fetched).`;

    const sanitized = this.sanitizer.sanitize(rawContent);

    return {
      title,
      cleanText: typeof sanitized.sanitizedData === 'string' ? sanitized.sanitizedData : JSON.stringify(sanitized.sanitizedData),
      sourceUrl: rawUrl,
      fetchedAt: new Date().toISOString(),
    };
  }
}
