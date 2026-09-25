import { prisma } from '../../../infrastructure/database/prisma.js';
import { redis } from '../../../infrastructure/redis/redis.js';
import { logger } from '../../../config/logger.js';
import type { SearchQueryAnalysisResult } from '@ai-companion/types';

// Built-in common search typo map
const COMMON_TYPO_MAP: Record<string, string> = {
  'girlfirend': 'girlfriend',
  'grilfriend': 'girlfriend',
  'boyfirend': 'boyfriend',
  'budy': 'buddy',
  'studdy': 'study',
  'motivaton': 'motivation',
  'physic': 'physics',
  'programing': 'programming',
  'fitnes': 'fitness',
  'comapnion': 'companion',
  'phychologist': 'psychologist',
  'theripist': 'therapist',
  'charcter': 'character',
  'anmie': 'anime',
};

// Common Hinglish / Hindi to English concept translation mappings
const HINGLISH_MAP: Record<string, string> = {
  'dost': 'friend',
  'yaar': 'friend',
  'saathi': 'companion',
  'padhai': 'study',
  'seekhna': 'learn',
  'baat': 'chat',
  'ladki': 'female',
  'ladka': 'male',
  'accha': 'kind',
  'achha': 'kind',
  'masti': 'playful',
  'shant': 'calm',
  'hasmukh': 'cheerful',
  'majedaar': 'funny',
  'shayar': 'poet',
  'shayari': 'poetry',
};

// Stopwords in English & Hinglish
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'with', 'in', 'on', 'at', 'to', 'of', 'is', 'are', 'i', 'me', 'my', 'want', 'need', 'like', 'find', 'show',
  'mujhe', 'chahiye', 'ek', 'karo', 'karna', 'kisi', 'ke', 'ka', 'ki', 'ko', 'se', 'hai', 'bhi', 'wala', 'wali',
]);

const PERSONALITY_KEYWORDS = new Set([
  'funny', 'sarcastic', 'kind', 'warm', 'calm', 'sweet', 'dominant', 'shy', 'bold', 'flirty', 'patient', 'curious',
  'smart', 'witty', 'gentle', 'energetic', 'playful', 'caring', 'loyal', 'deep', 'supportive', 'playful',
]);

const ROLE_KEYWORDS = new Set([
  'friend', 'buddy', 'companion', 'girlfriend', 'boyfriend', 'mentor', 'tutor', 'coach', 'teacher', 'assistant',
  'therapist', 'partner', 'colleague', 'advisor', 'confidant',
]);

const TOPIC_KEYWORDS = new Set([
  'study', 'coding', 'programming', 'fitness', 'workout', 'gym', 'anime', 'science', 'math', 'gaming', 'crypto',
  'philosophy', 'music', 'psychology', 'history', 'space', 'writing', 'language', 'business', 'creative',
]);

const HINGLISH_MARKERS = new Set([
  'mujhe', 'chahiye', 'ek', 'karo', 'karna', 'kisi', 'hai', 'bhi', 'wala', 'wali',
  'kya', 'kaise', 'accha', 'achha', 'padhai', 'dost', 'yaar', 'saathi', 'kaun',
  'aap', 'tum', 'mera', 'meri', 'mere', 'hum', 'apna', 'apni',
]);

export class SearchQueryAnalyzer {
  /**
   * Analyzes an untrusted user search query, performing normalization, typo tolerance,
   * Hinglish translation, synonym expansion, and structured intent classification.
   */
  public static async analyze(rawQuery: string): Promise<SearchQueryAnalysisResult> {
    if (!rawQuery || typeof rawQuery !== 'string') {
      return {
        originalQuery: '',
        normalizedQuery: '',
        tokens: [],
        intent: 'GENERAL',
        extractedCategories: [],
        extractedTags: [],
        extractedPersonality: [],
        isSemanticSearchPreferred: false,
      };
    }

    const trimmed = rawQuery.trim();
    // Normalize punctuation & lower case
    const cleanStr = trimmed.toLowerCase().replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ');
    const rawTokens = cleanStr.split(' ').filter(t => t.length > 0);

    let hasHinglish = false;
    let spellCorrected = false;
    const tokens: string[] = [];
    const correctedTokens: string[] = [];

    for (const rawToken of rawTokens) {
      let token = rawToken;

      // Check Hinglish markers
      if (HINGLISH_MARKERS.has(token) || HINGLISH_MAP[token]) {
        hasHinglish = true;
      }

      // Check common typos
      if (COMMON_TYPO_MAP[token]) {
        token = COMMON_TYPO_MAP[token]!;
        spellCorrected = true;
      }

      // Check Hinglish map
      if (HINGLISH_MAP[token]) {
        token = HINGLISH_MAP[token]!;
      }

      correctedTokens.push(token);

      if (!STOP_WORDS.has(token)) {
        tokens.push(token);
      }
    }


    const normalizedQuery = correctedTokens.join(' ');
    const spellCorrection = spellCorrected || hasHinglish ? normalizedQuery : null;

    // Entity & Intent Extraction
    const extractedPersonality: string[] = [];
    const extractedTags: string[] = [];
    const extractedCategories: string[] = [];

    let isPersonalityIntent = false;
    let isRoleIntent = false;
    let isTopicIntent = false;

    for (const token of tokens) {
      if (PERSONALITY_KEYWORDS.has(token)) {
        extractedPersonality.push(token);
        isPersonalityIntent = true;
      }
      if (ROLE_KEYWORDS.has(token)) {
        extractedTags.push(token);
        isRoleIntent = true;
      }
      if (TOPIC_KEYWORDS.has(token)) {
        extractedCategories.push(token);
        isTopicIntent = true;
      }
    }

    // Determine Intent
    let intent: SearchQueryAnalysisResult['intent'] = 'GENERAL';
    let primaryIntent = 'GENERAL';
    if (hasHinglish) {
      intent = 'MULTILINGUAL';
      primaryIntent = 'MULTILINGUAL';
    } else if (isRoleIntent && isPersonalityIntent) {
      intent = 'ROLE_RELATIONSHIP';
      primaryIntent = 'ROLE_RELATIONSHIP';
    } else if (isRoleIntent) {
      intent = 'ROLE';
      primaryIntent = 'ROLE';
    } else if (isPersonalityIntent) {
      intent = 'PERSONALITY';
      primaryIntent = 'PERSONALITY';
    } else if (isTopicIntent) {
      intent = 'TOPIC_ACTIVITY';
      primaryIntent = 'TOPIC_ACTIVITY';
    } else if (tokens.length <= 2 && !isPersonalityIntent && !isRoleIntent) {
      intent = 'CHARACTER_NAME';
      primaryIntent = 'CHARACTER_NAME';
    }

    // Expand Synonyms from DB / Redis cache
    const expandedSynonyms = await this.resolveSynonyms(tokens);
    for (const syn of expandedSynonyms) {
      if (!tokens.includes(syn)) {
        tokens.push(syn);
      }
    }

    // Prefer semantic search if query is longer descriptive sentence or has personality/role intent
    const isSemanticSearchPreferred = tokens.length >= 3 || isPersonalityIntent || isRoleIntent || hasHinglish;

    return {
      originalQuery: trimmed,
      normalizedQuery,
      tokens,
      intent,
      primaryIntent,
      extractedCategories,
      extractedTags,
      extractedPersonality,
      extractedLanguage: hasHinglish ? 'hi-en' : 'en',
      language: hasHinglish ? 'hi' : 'en',
      synonymExpansions: expandedSynonyms,
      isSemanticSearchPreferred,
      spellCorrection,
    };
  }


  /**
   * Resolves configured search synonyms from DB with Redis caching.
   */
  public static async resolveSynonyms(tokens: string[]): Promise<string[]> {
    if (tokens.length === 0) return [];
    const synonyms: string[] = [];

    for (const token of tokens) {
      try {
        const cacheKey = `search:synonyms:${token}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            synonyms.push(...parsed);
            continue;
          }
        }

        const entry = await prisma.searchSynonym.findFirst({
          where: { term: token, isActive: true },
        });

        if (entry && Array.isArray(entry.synonyms)) {
          const list = entry.synonyms as string[];
          synonyms.push(...list);
          await redis.set(cacheKey, JSON.stringify(list), 'EX', 3600); // 1 hour cache
        }
      } catch (err) {
        logger.debug('Synonym lookup fallback', { err, token });
      }
    }

    return synonyms;
  }
}
