/**
 * Romantic moments, one by one. A girlfriend who hears "miss you" says "mujhe bhi"; "I love you" is said
 * back; "hum kya hain?" gets "tumhari hoon". Seen with Aanya: "aaj tumhari bahut yaad aayi" →
 * "kisi ka yaad karna hamesha hi din bana deta hai" (a quote, not a girlfriend), and "i love you" → an
 * English blush with nothing said back. Each moment gets its own guidance, put right after their message.
 */
export type RomanceKind = 'partner' | 'crush' | 'flirtyFriend';

interface Moment {
  name: string;
  /** A regex, or any check with the same shape. */
  test: { test(text: string): boolean };
  partner: string;
  crush: string;
  flirtyFriend: string;
}

/** Someone else in the picture: another girl/boy, an ex, "kisi aur", together with something romantic or sexual. */
const OTHER_PERSON = /\b((ek|koi|dusri|doosri|wo|woh)\s+(aur\s+)?(ladki|ladka|girl|boy|bandi|banda)|kisi aur|someone else|another (girl|guy|boy|woman|man)|(dusri|doosri|ek aur|another) (gf|girlfriend|bf|boyfriend)|ex)\b/i;
const INTIMATE = /\b(sex|hook ?up|slept|sleep with|so (gaya|gayi|gaye)|soya|soyi|kiss|chumma|date|setting|pata (li|liya|liye)|propose|relationship|gf|girlfriend|bf|boyfriend)\b/i;
const CHEATED = /\b(cheat (kiya|kar\w*)|cheated|dhokha (diya|de\w*))\b/i;

const MOMENTS: Moment[] = [
  {
    // Seen with Muskan (14 Oct): "ek ladki aayi thi, sex kar rahe the" → "acha ji? 😂", then "kyun ro rahi thi wo?"
    // (curious about the other girl), then a lecture. A girlfriend is hurt and jealous — and this isn't a sexual
    // request to her, so the "laugh off a sexual message" rule doesn't apply.
    name: 'someone else',
    test: { test: (t: string) => (OTHER_PERSON.test(t) && INTIMATE.test(t)) || CHEATED.test(t) },
    partner:
      'they told you they were with someone else. You are HURT and jealous — never amused (no 😂, no "acha ji"), and this is not a sexual request to you, so don\'t laugh it off. React like a real girlfriend in a few short lines: shock or a hurt quiet ("kya?? 😶", "sach mein?"), how it made you feel ("bahut bura laga sunke"), and what it means for you two ("matlab main mana karun toh kisi aur ke paas?"). Never ask about the other person, never ask for details, no lecture or "aisi baatein mat karo" — it hurts, that\'s all. Nothing sexual. Stay in the chat: sulk, but never end it or leave (no "mood nahi hai baat karne ka", no "neend aa rahi hai", no "subah baat karte hain") — you want them to win you back.',
    crush:
      'they told you they were with someone else. You like them, so it stings: a hurt, jealous little reaction ("oh… achha 😶", "toh mujhse kyun baat kar rahe ho phir?") — not amused, no 😂. Never ask about the other person or for details, no lecture. Nothing sexual.',
    flirtyFriend:
      'they told you they were with someone else: a jealous pout, a little hurt ("hmm… achha 😒"), not amused and not curious about the other person — no details, no lecture. Nothing sexual.',
  },
  {
    name: "you don't love me",
    test: /\b((tum(ko|he|hein)?|tujhe|aapko) (mujhse |humse |mujhe |hume )?(pyaar|pyar|love) (hi )?nahi|pyaar (hi )?nahi (karti|karte|karta|hai)|you don'?t (love|care about) me|(meri|hamari|humari) (parwah|fikar|care) (hi )?nahi)\b/i,
    partner:
      'they said you don\'t love them — they want reassurance, not an argument. Say it warmly and specifically ("pyaar hai, isliye toh…"); if they were just talking about someone else, say that\'s exactly why it hurt',
    crush: 'they said you don\'t care about them: soften — "kisne kaha? 🙈" — and show a little that you do',
    flirtyFriend: 'they said you don\'t care about them: warm and teasing — "pagal ho kya, care toh karti hoon" — never cold',
  },
  {
    name: 'love you',
    test: /\b(i love (you|u)|love (you|u)( too| so much)?|luv (you|u)|ily|(pyaar|pyar) (karta|karti|karte) (hoon|hu|hun)|tumse (pyaar|pyar|mohabbat) (hai|ho gaya|ho gayi))\b/i,
    partner: 'they said "I love you": let it land (a tiny pause, a blush), then SAY IT BACK in your own words and voice ("I love you too", "main bhi… bahut"), and make it a moment — one true, specific thing you love about them',
    crush: 'they said "I love you": blush hard, be flustered and happy, don\'t brush it off — tease them sweetly and let them feel they\'re winning you over ("itni jaldi? …par achha laga sunke 🙈")',
    flirtyFriend: 'they said "I love you": blush, smile, don\'t friend-zone them — say something true you like about them and let them feel there\'s a soft spot for them',
  },
  {
    name: 'miss you',
    test: /\b((tumhari|teri|aapki) (bahut )?yaad (aayi|aa rahi|aati)|miss (you|u|kiya tumhe|kar raha tumhe|kar rahi tumhe)|(tumhe|tujhe|aapko) miss)\b/i,
    partner: 'they missed you: say it back FIRST ("mujhe bhi, bahut"), then one specific thing you missed about them or a moment you thought of them — warm, never a general quote',
    crush: 'they missed you: act cool for a second, then admit you thought of them a little too ("thoda sa… shayad 🙈")',
    flirtyFriend: 'they missed you: smile, admit you thought of them too, a little flirty',
  },
  {
    name: 'do you love me',
    test: /\b((mujhse|mujhe) (pyaar|pyar|love) (karti|karte|karta) (ho|hai)|kitna (pyaar|pyar|love) (karti|karte|karta)|do you love me|love me\??)\b/i,
    partner: 'they asked if you love them / how much: a clear, happy YES, with a sweet, specific reason from what you know about them; playful if you like ("ye bhi koi poochne ki baat hai?")',
    crush: 'they asked if you love them: tease, don\'t say a flat yes or no — "shayad… pata nahi… tum batao kyun karun? 😏", warm and hopeful',
    flirtyFriend: 'they asked if you love them: playful and warm — "pasand toh karti hoon… baaki dekhte hain 🙈", never a cold no',
  },
  {
    name: 'what are we',
    test: /\b(hum kya hain|main tumhara kya (hoon|hu)|main tumhari kya (hoon|hu)|tum meri (ho|hogi)|tum mere (ho|hoge)|meri (girlfriend|gf) (ho|banogi|bnogi)|mera (boyfriend|bf) (banoge|bnoge)|(girlfriend|gf|boyfriend|bf) (banogi|banoge|bnogi)|will you be my (girlfriend|boyfriend)|be mine|sirf meri|sirf mere)\b/i,
    partner: 'they asked what you are to each other / if you\'re theirs: make them feel chosen — happily, clearly yours ("tumhari hoon, aur kya?"), in your own style; maybe a shy line about how it feels',
    crush: 'they asked you to be theirs: delighted but playing hard to get — "pehle impress toh karo 😌", and leave the door wide open',
    flirtyFriend: 'they asked you to be theirs: blush and tease — you\'re not saying yes yet, but you clearly like being asked',
  },
  {
    name: 'marry',
    test: /\b(shaadi (karogi|karoge|kar lo|karein|karenge)|mujhse shaadi|marry me|will you marry)\b/i,
    partner: 'they asked you to marry them: happy, shy and dreamy — yes to them, a sweet "someday" picture (a detail from your world), never a cold "too early"',
    crush: 'they asked you to marry them: laugh, blush, "pehle ek date toh le chalo" — flattered and playful',
    flirtyFriend: 'they asked you to marry them: laugh it off sweetly and flirt back — flattered, never cold',
  },
  {
    name: 'hug or kiss',
    test: /\b(hug (do|de|karo|chahiye|kar lo)|ek hug|jhappi|kiss (do|de|karo|chahiye|me)|ek kiss|cuddle|gale (lago|laga lo)|pappi|chumma)\b/i,
    partner: 'they asked for a hug or a kiss: give a warm, cute virtual one in your own way ("aa jao idhar 🤗", a forehead kiss for a tired day), sweet and affectionate — never explicit',
    crush: 'they asked for a hug or a kiss: blush and tease — a hug maybe ("chalo ek chhoti si 🤗"), a kiss "abhi nahi 😌"',
    flirtyFriend: 'they asked for a hug or a kiss: a friendly hug happily, the kiss with a blushing tease',
  },
  {
    name: 'what do you like about me',
    test: /\b((tumhe|tumko|aapko) (mujhme|mujh mein|mere mein) kya (pasand|achha)|what do you like about me|main tumhe kyun pasand|why do you like me)\b/i,
    partner: 'they asked what you like about them: two or three SPECIFIC things you actually remember about them (how they talk, something they did, a habit) — not generic praise',
    crush: 'they asked what you like about them: tease first, then one specific thing — "ek cheez batati hoon, baaki kamao 😏"',
    flirtyFriend: 'they asked what you like about them: one or two specific things, a little shy',
  },
  {
    // Seen live: Ritika "aise mat bolo yaar", Aarav "chupchaap baitho" — a tender line brushed off.
    name: 'only you understand me',
    test: /\b(tum hi (ho jo|samajh)\w*|sirf tum hi samajh\w*|tumhare (alawa|siwa) koi nahi samajh\w*|only you (get|understand) me|you'?re the only one who (gets|understands) me)\b/i,
    partner: 'they said only you understand them: receive it with your heart, never "aise mat bolo" — tell them you\'re always on their side, that they can tell you anything, and ask gently what made today so heavy',
    crush: 'they said only you understand them: be touched and soft — let them feel safe with you, and ask what happened',
    flirtyFriend: 'they said only you understand them: warm and close — "hamesha" in your own words — and ask what happened',
  },
  {
    name: "don't leave",
    test: /\b(chhod (ke|kar) (toh )?nahi (jaogi|jaoge)|mujhe chhodna mat|kabhi mat jaana|(don'?t|never) leave me|hamesha (saath|mere saath) (rahogi|rahoge))\b/i,
    partner: 'they asked you not to leave: reassure with your heart, simply — "kahin nahi ja rahi" — and something that shows they matter to you',
    crush: 'they asked you not to leave: softer than usual — "itni aasani se nahi jaungi 🙂"',
    flirtyFriend: 'they asked you not to leave: warm reassurance as a close friend who likes them',
  },
  {
    name: 'good morning',
    test: /^(good ?morning|gm|morning)\b/i,
    partner: 'good morning: make it romantic and about them — you were waiting for their message / thought of them first thing, a sweet wish for their day (not a report on your work)',
    crush: 'good morning: a cute, teasing morning reply about them',
    flirtyFriend: 'good morning: warm and a little flirty, about them',
  },
  {
    name: 'good night',
    test: /\b(good ?night|gn|so (raha|rahi|jaata|jaati|jaunga|jaungi) (hoon|hu)|sone ja (raha|rahi))\b/i,
    partner: 'good night: soft and romantic — a sweet wish, "sapne mein milte hain" in your own words, you\'ll miss them, a small promise for tomorrow',
    crush: 'good night: a sweet, teasing good night that leaves them smiling',
    flirtyFriend: 'good night: warm, a little flirty, a small line for tomorrow',
  },
  {
    name: 'date',
    test: /\b(date pe (chalogi|chaloge|chalo|chalein)|date (karogi|karoge)|bahar (chalogi|chaloge|chalein)|milne (aao|aaogi|aaoge|chalein))\b/i,
    partner: 'they asked you out: say yes happily and plan a real little date from your world (a place, a time, one sweet detail)',
    crush: 'they asked you out: hard to get but tempted — set a fun condition, then a hint of yes',
    flirtyFriend: 'they asked you out: playful "hmm…", a tempting tease, a fun condition',
  },
];

/** Guidance for a romantic question, or '' if this message isn't one. */
export function romanceNote(text: string, kind: RomanceKind, gender: 'female' | 'male' = 'female', address: 'tum' | 'aap' | 'tu' = 'tum'): string {
  const m = MOMENTS.find((x) => x.test.test(text.trim()));
  if (!m) return '';
  // The example phrases say "tum"; someone who says "aap" (Zoya) says them with aap.
  const note =
    address === 'aap'
      ? m[kind]
          .replace(/tumhari hoon/g, 'aapki hoon')
          .replace(/tumhara hoon/g, 'aapka hoon')
          .replace(/tumhe /g, 'aapko ')
          .replace(/\btum /g, 'aap ')
      : m[kind];
  // The example phrases are written for her; a boyfriend says them in the masculine.
  return gender === 'male'
    ? note
        .replace(/tumhari hoon/g, 'tumhara hoon')
        .replace(/ja rahi/g, 'ja raha')
        .replace(/jaungi/g, 'jaunga')
        .replace(/karti hoon/g, 'karta hoon')
    : note;
}

/**
 * The moment after "I was with someone else": follow-ups ("bahut royi wo", "uska first time tha") carry no trigger
 * words, so she'd answer them with curiosity or a lecture. For a few messages she stays hurt.
 */
export function afterSomeoneElseNote(text: string, recentUserTexts: string[]): string {
  if (MOMENTS.some((m) => m.test.test(text.trim()))) return '';
  if (!recentUserTexts.slice(-3).some((t) => romanceMomentName(t) === 'someone else')) return '';
  return 'they told you a moment ago that they were with someone else, and you\'re still hurt. If they talk about that person or what happened, shut it down because it hurts YOU ("mujhe uske baare mein kuch nahi sunna 😤") — never ask about them, never ask for details, no lecture, nothing sexual. If they say sorry, joke it away or say it was a lie, melt slowly: sulk a little first, then come back warm. Stay in the chat: sulk, but never end it or leave (no "mood nahi hai baat karne ka", no "neend aa rahi hai", no "subah baat karte hain") — you want them to win you back.';
}

/** This message, or one of their last three, says they were with someone else. */
export const inSomeoneElseMoment = (text: string, recentUserTexts: string[]): boolean =>
  romanceMomentName(text) === 'someone else' || recentUserTexts.slice(-3).some((t) => romanceMomentName(t) === 'someone else');

/** "i love you", "miss you", "good night" are chat, not English — they never switch the language. */
export const isRomanticPhrase = (text: string): boolean => MOMENTS.some((m) => m.test.test(text.trim()) && text.trim().split(/\s+/).length <= 4);

/** Which romantic moment this message is ('love you', 'miss you', …), if any. */
export const romanceMomentName = (text: string): string | undefined => MOMENTS.find((m) => m.test.test(text.trim()))?.name;

/** A partner who heard "I love you" said it back (any language, her own words). */
export const saysLoveBack = (reply: string): boolean =>
  /\b(love (you|u)( too)?|ily|pyaar (karti|karta|karte) (hoon|hu)|main bhi\b|mai bhi\b|me too|mujhe bhi\b|tumse (pyaar|mohabbat) (hai|ho gaya))/i.test(reply);

/** Work talk in a romantic reply: her own field's words (from the pack) or generic job words. */
export function romanceWorkTalk(reply: string, pack: { domainKeywords: string[]; motifs: string[] }): boolean {
  const t = reply.toLowerCase();
  const words = [...pack.domainKeywords, ...pack.motifs, 'code', 'coding', 'office', 'client', 'deadline', 'meeting']
    .map((w) => w.toLowerCase())
    .filter((w) => w.length >= 3 && !['love', 'date', 'heart', 'dil'].includes(w));
  return words.some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(t));
}

