import { describe, expect, it } from 'vitest';

describe('Mobile Social Deep Link Routing', () => {
  const linkingConfig = {
    prefixes: ['companion://', 'https://companion.ai'],
    screens: {
      SocialProfile: 'u/:handle',
      SocialContent: 'p/:publicId',
      SocialShareAlias: 'share/:publicId',
      Community: 'community/:slug',
      SocialFeed: 'social',
      SocialInbox: 'messages/requests',
      SocialPrivacySettings: 'settings/social',
      CharacterDetail: 'c/:characterSlug',
    },
  };

  function parseDeepLink(url: string) {
    let clean = url;
    for (const prefix of linkingConfig.prefixes) {
      if (clean.startsWith(prefix)) {
        clean = clean.slice(prefix.length);
        if (clean.startsWith('/')) clean = clean.slice(1);
        break;
      }
    }
    const [path] = clean.split('?');
    const segments = path.split('/').filter(Boolean);

    if (segments[0] === 'u' && segments[1]) {
      return { screen: 'SocialProfile', params: { handle: segments[1] } };
    }
    if ((segments[0] === 'p' || segments[0] === 'share') && segments[1]) {
      return { screen: 'SocialContent', params: { publicId: segments[1] } };
    }
    if (segments[0] === 'community' && segments[1]) {
      return { screen: 'Community', params: { slug: segments[1] } };
    }
    if (segments[0] === 'c' && segments[1]) {
      return { screen: 'CharacterDetail', params: { characterSlug: segments[1] } };
    }
    if (segments[0] === 'social') {
      return { screen: 'SocialFeed', params: {} };
    }
    if (segments[0] === 'messages' && segments[1] === 'requests') {
      return { screen: 'SocialInbox', params: {} };
    }
    if (segments[0] === 'settings' && segments[1] === 'social') {
      return { screen: 'SocialPrivacySettings', params: {} };
    }
    return null;
  }

  it('routes user profile deep links with custom handle', () => {
    expect(parseDeepLink('companion://u/maya_star')).toEqual({
      screen: 'SocialProfile',
      params: { handle: 'maya_star' },
    });
    expect(parseDeepLink('https://companion.ai/u/alex.rivers')).toEqual({
      screen: 'SocialProfile',
      params: { handle: 'alex.rivers' },
    });
  });

  it('routes public post and share deep links', () => {
    expect(parseDeepLink('companion://p/pub-123456')).toEqual({
      screen: 'SocialContent',
      params: { publicId: 'pub-123456' },
    });
    expect(parseDeepLink('https://companion.ai/share/snap-987654')).toEqual({
      screen: 'SocialContent',
      params: { publicId: 'snap-987654' },
    });
  });

  it('routes community deep links', () => {
    expect(parseDeepLink('companion://community/anime-lore')).toEqual({
      screen: 'Community',
      params: { slug: 'anime-lore' },
    });
  });

  it('routes character short deep links (/c/:slug)', () => {
    expect(parseDeepLink('companion://c/luna')).toEqual({
      screen: 'CharacterDetail',
      params: { characterSlug: 'luna' },
    });
  });

  it('routes inbox and settings links', () => {
    expect(parseDeepLink('companion://messages/requests')).toEqual({
      screen: 'SocialInbox',
      params: {},
    });
    expect(parseDeepLink('companion://settings/social')).toEqual({
      screen: 'SocialPrivacySettings',
      params: {},
    });
  });
});
