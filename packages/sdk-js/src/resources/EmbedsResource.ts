export class EmbedsResource {
  constructor(private readonly requester: (path: string, options?: RequestInit) => Promise<any>) {}

  /**
   * Generates a short-lived ephemeral token for browser iframe/widget embedding.
   */
  public async createSessionToken(characterId: string, origin?: string): Promise<{
    sessionToken: string;
    expiresInSeconds: number;
    embedUrl: string;
  }> {
    const res = await this.requester('/v1/embeds/session-token', {
      method: 'POST',
      body: JSON.stringify({ characterId, origin }),
    });
    return res.data;
  }
}
