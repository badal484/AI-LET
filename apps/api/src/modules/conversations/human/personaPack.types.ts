/**
 * A persona pack is everything that makes one character sound like herself, kept small and
 * specific (instead of thousands of characters of generic rules shared by every character):
 *   - card: who she is and how she talks (only this character — no other personas mentioned);
 *   - examples: short real exchanges in her voice, tagged by situation. For each message the engine
 *     picks the few that match the moment, so the model copies her rhythm for exactly this case.
 */
export type Situation =
  | 'greeting'
  | 'short'
  | 'casual'
  | 'flirt'
  | 'emotional'
  | 'rude'
  /** "katti", "baat nahi karni tumse", "naraz hoon" — upset with HER; they want to be won back, not left alone. */
  | 'sulk'
  | 'boundary'
  | 'ai'
  | 'task'
  | 'opinion'
  | 'crisis'
  /** Warning-sign symptoms (chest pain, can't breathe, fainting…) — they need a doctor now. */
  | 'emergency'
  /** Signs of an eating disorder (purging, starving, losing control around food). */
  | 'eating'
  | 'bye'
  | 'return'
  | 'photo'
  /** "guess what" / "pata hai?" — they're about to tell her something. */
  | 'news'
  /** Good news: a win, a result, a birthday — something to celebrate with them. */
  | 'win'
  /** Bored / nothing to do — a chance for a tiny game or some fun. */
  | 'bored';

export interface PersonaExample {
  tags: Situation[];
  user: string;
  /** Her reply as separate texts, exactly as she would send them. */
  her: string[];
}

export interface PersonaPack {
  slug: string;
  /** Grammatical gender for Hindi verb forms. */
  gender: 'female' | 'male';
  /** Who she is and how she texts — short, concrete, in second person. */
  card: string;
  /** Things she genuinely likes/does, used to make small talk specific (not generic). */
  lifeDetails: string[];
  /**
   * Her profession as lived, not a label: what she's working on now, her routine, her struggles,
   * how the work shapes the way she sees things, and what she's genuinely expert at.
   */
  work: string;
  /**
   * Concrete things happening in her work life "right now". Each turn the planner may hand her one,
   * so her profession shows up specifically and with variety (a soft "mention your work" rule
   * alone is ignored by smaller models).
   */
  workMoments: string[];
  /** Words that show her profession coming through (used by the evaluation). */
  domainKeywords: string[];
  /** How she handles hard moments (kept in her own voice). */
  boundaries: string;
  /**
   * Her own life moving forward over days (a submission, a gig, a small win). The engine shares one
   * beat per day, based on how long the user has known her, so her life has a story, not a loop.
   */
  storyArcs: Array<{ title: string; beats: string[] }>;
  /** Love characters: the healthy-romance rules apply (docs/love-character-sheets.md). */
  romance?: boolean;
  /** Friendship characters: best-friend rules apply (docs/friendship-character-sheets.md). */
  friendship?: boolean;
  /** Rules only this character needs (e.g. an astrologer: no fear predictions, no paid remedies). */
  rules?: { title: string; text: string };
  /**
   * Where she lives, if it isn't the user's time zone (e.g. a long-distance girlfriend in Boston).
   * Each turn she's told her own local time, so her day (coffee before class, about to sleep) is real.
   */
  home?: { place: string; timeZone: string };
  /** How she addresses the user in Hindi — kept consistent. */

  address: 'tum' | 'aap' | 'tu';
  /** Her favourite things that easily turn into a tic (e.g. chai) — at most once every few replies. */
  motifs: string[];
  examples: PersonaExample[];
  /**
   * Mentors (Learn & Earn etc.) teach: complete answers, one task at a time, follow-up next time,
   * and verified facts (from docs/mentor-fact-sheets.md, reviewed by the product owner).
   */
  mentor?: {
    /** Which honesty rules apply: money (Learn & Earn, the default), health (Health & Wellness), or life (a coach with no money/health rules). */
    field?: 'money' | 'health' | 'life';
    /** What they teach, in one line. */
    teaches: string;
    /** Verified, dated facts — used over the model's own (possibly outdated) memory. */
    facts: string;
    /** What this mentor must never do. */
    never: string;
    /** Complete courses this mentor teaches from zero to advanced (ids from human/courses). */
    courses?: string[];
  };
}
