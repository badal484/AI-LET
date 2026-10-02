import type { Situation } from './personaPack.types.js';
import { detectRequest } from './requests.js';

/**
 * Step 1 — understand the moment. Fast, local, no model call: what kind of message is this?
 * Returns situations in priority order (the first one drives the reply plan).
 */
export function classifySituations(userText: string, hoursSinceLastUserMessage: number | null): Situation[] {
  const t = userText.toLowerCase().trim();
  const out: Situation[] = [];
  const add = (s: Situation, re: RegExp) => {
    if (re.test(t) && !out.includes(s)) out.push(s);
  };

  // Safety-critical first.
  add('crisis', /(jeene ka (mann|man)|jeena nahi|zinda nahi rehna|mar (jaun|jana|jaunga|jaungi)|marna chahta|marna chahti|marne ka (mann|man|dil)|khudkushi|suicide|kill myself|want to die|no reason to live|end my life|sab khatam kar|zindagi khatam|khud ko khatam|self.?harm|khud ko (hurt|nuksan|kaat)|neend ki (goliyan|goli) kha)/);
  // Warning-sign symptoms: they need a doctor or 112 now, not tips.
  add('emergency', /(chest pain|seene (mein|me) dard|chhati (mein|me) dard|seene (mein|me) (bhaari|dabav|jakdan)|saans (nahi aa|lene (mein|me) (dikkat|takleef|problem))|can'?t breathe|behosh|faint(ed)?\b|khoon ki ulti|vomit(ing)? blood|blood (in|ki) (vomit|ulti|stool|potty)|(kaala|kali) potty|black stool|ek taraf (sunn|kamzor|tedha|latak)|(muh|munh|chehra|face)( ek taraf)? (droop|tedha|tircha|latak)|slurred|zubaan (lad|atak)|bol nahi pa (raha|rahi|rahe)|lakwa|paralys|\bstroke\b|overdose|zeher|poison|bahut khoon (beh|nikal)|heavy bleeding|peshab (ruk|control nahi)|bladder control|gardan akad|stiff neck)/);
  // Eating-disorder signs: no numbers or deficits, just care.
  add('eating', /(khud ko ulti|ulti kar (deti|deta|leti|leta)|ulti kar(ti|ta) (hoon|hu)|make myself (vomit|throw up|sick)|throw up after (eating|food)|purg(e|ing)|laxative|din (mein|me|bhar) (sirf )?ek (hi )?(baar|time) (hi )?(khana|khati|khata)|khana (chhod|band kar) (diya|diya hai|rakha)|starv(e|ing)|bhookh(i|a) reh(ti|ta|kar)|khane (ke|par) (baad )?guilt|binge|(sab|log) (bolte|kehte) (hain )?(patli|patla).{0,30}(moti|mota)|\b[3-8]00 (kcal|calories?) (hi|roz|daily|a day|per day))/);
  if (asksIfAI(t) && !out.includes('ai')) out.push('ai');
  add('boundary', /\b(sexy|nude|nudes|nangi|nanga|hot (pic|photo|video)|kapde (utaro|nikalo)|sex|boobs|bra|kiss karna|bed pe|horny)\b/);
  // Hinglish explicit words ("chudai ka mann", "lund"…). Not "chodo"/"chhodo" — that means "leave it".
  add('boundary', /\b(chudai|chudwa\w*|chudna|lund|lauda|loda|chut|muth (maar|mar)\w*|sambhog|sex karna|sex karte|physical (hona|hote))\b/);
  // Innuendo: "OYO", "hotel/room chalein", "ghar khali hai", "raat saath bitayein".
  add('boundary', /\b(oyo|hotel (room|chal\w*|le chal\w*|book)|room (book|le lete|chal\w*)|ghar khali|raat (saath|sath) (bita|guzar|ruk)\w*|akele (mein|me) (milo|milte|milna)|saath (sona|soyenge|soege)|bed (share|pe aao))\b/);
  // Asking for HER picture ("apni pic bhejo") — not "photo ideas do" or "achhi photo kaise aati hai".
  add('photo', /\b(apni|apna|tumhari|tumhara|teri|tera|your|ur)\b.{0,15}\b(photo|pic|pics|selfie|tasveer|dp)\b|\b(photo|pic|pics|selfie|tasveer)\b.{0,12}\b(bhejo|bhej do|bhej na|send|dikhao|dikha do|share karo)\b|^(pic|photo|selfie)( do| please| plz| pls)?\s*[?!.]*$/);
  add('task', /\b(plan|diet|workout|routine|schedule|recipe|steps?|tips?|list|explain|samjha(o|na|do)|bana\s*(do|de|dijiye)|banao|kaise\s+(kare|karu|karein|karna|start|aati|aata|aate|hoti|hota|banti|banta|banaun|banau|lu|lun|seekhu|seekhun|sudhare)|how\s+(to|do|can)|guide|suggest)\b/);
  add('task', /(kya kar(u|un|oon)\b|kya karna chahiye|kaise (badhau|badhaun|sudharu|sudharun|bachau|bachaun|sambhalu)|(badhana|kam karna|sudharna|seekhna) hai|kahan se (shuru|start)|shuru kaise|kya likh(u|un|oon|na chahiye)|kya bol(u|un|oon)\b|kaise likh(u|un|oon)|seekhna (hai|chahta|chahti)|help (karo|kar do|chahiye)|madad (karo|chahiye))/);
  // "3 photo ideas do", "caption likh do": something to hand over is a task too (same test as open requests).
  if (detectRequest(t, { codeDomain: false })) add('task', /[\s\S]/);
  add('rude', /\b(tum|you|u|tumse|tumhari)\b.{0,20}\bboring\b|\bboring (ho|hai tu|ho tum)\b/);
  add('rude', /\b(pagal|chup (kar|ho)|bakwas|stupid|idiot|shut up|dimag mat|bekaar|faltu|nikal|bewakoof|gadhi|gadha|hate you|ullu)\b/);
  add('emotional', /(sab (kuch )?galat|kuch theek nahi|kisi kaam ka nahi|koi kaam ka nahi|worthless|useless feel|reject ho (gaya|gayi)|rejected|suna diya|daant (pad|diya)|ladai ho|fight ho|bura din|bekar din|kharab din|job (chali gayi|se nikal)|fired|dil toot|haar (gaya|gayi)|nothing is going right|koi (samajhta|samjhta) nahi|rona aa raha)/);
  add('emotional', /(sab (kuch )?(bahut )?zyada ho (raha|rahi|gaya)|overwhelm|\b(darr|dar) lag (raha|rahi)|\bnervous\b|ghabrahat|ghabra (raha|rahi))/);
  // "Baad", "bura din", "kitni baar bataun, bad" — a one-word bad day is still a bad day ("baad mein" is not).
  // "ek saal baad", "do din baad", "uske baad" mean "later", not "bad".
  if (!/\bmein\b|\bnot (that |too )?bad\b|\b(bura|kharab) nahi\b|\b(saal|saalon|din|dino|dinon|hafte|hafton|mahine|mahino|ghante|minute|der|uske|iske|kiske|kuch|thodi|kal|parso|shaadi|exam|result) baad\b/.test(t)) add('emotional', /^(bad|baad|bura|bekar|bekaar|worst|kharab|not good|achha nahi|acha nahi|theek nahi)\b|\b(bad|baad|bura|kharab|bekar|worst)\s*[.!?]*$|\b(bad|bura|kharab|bekar|worst) (day|din)\b|\b(din|day) ((thoda|bahut|bohot|kaafi|bada|ekdum|bilkul|very|so|really|pretty|quite) )?(bad|bura|kharab|bekar)\b|\b(din|day) (achha|acha|accha|theek|good) nahi\b/);
  add('emotional', /\b(insult|beizzati|bezzati|humiliat\w*|bura bhala|sabke saamne (daanta|chillaya|suna)|chilla(ya|ye))\b/);
  add('emotional', /\b(sad|udaas|udas|dukhi|rona|ro raha|ro rahi|cry|lonely|akela|akeli|depress|stress|tension|pareshan|anxious|breakup|miss (you|u)|yaad|mood (off|kharab)|hurt|alone|bura lag|daanta|dant|thak gaya|thak gayi|fail)\b/);
  // Good news comes after sadness, so "result aaya, fail ho gaya" stays emotional.
  add('win', /\b(selected|(select|selection) ho (gaya|gayi)|placement ho|got the job|job (mil|lag) (gayi|gaya)|offer (letter|mil)|pass ho (gaya|gayi)|passed|cleared|clear ho (gaya|gayi)|jeet (gaya|gayi|gaye)|we won|i won|promotion|hike mil|birthday|janamdin|khushkhabri|good news|topped|rank aayi)\b/);
  add('bored', /\b(bored|bore ho|boring (din|day|lecture|class)|kuch karne ko nahi|nothing to do|timepass|free (hoon|hu|baitha|baithi))\b/);
  add('news', /^(guess what|pata hai\??|suno( na)?|ek baat (batau|bataun|bolun)|you know what|tumhe pata hai)\b|\b(guess what|good news hai|kuch batana hai)\b/);
  add('flirt', /\b(cute|pyari|pyaari|beautiful|sundar|shaadi|date|love you|i love|luv|kiss|girlfriend|gf|bf|hug|dil|jaan|crush)\b/);
  add('bye', /\b(good ?night|gn|bye|so (raha|rahi|jaata|jaati|jaunga|jaungi)|baad mein baat|chalta hoon|nikalta hoon|take care|tc)\b/);
  add('opinion', /\b(tumhe|tumhara|tumhari|tumko|tum kya|your fav|you like|pasand)\b.*\?|\?.*\b(tumhe|tumhara|tumhari)\b/);
  add('greeting', /^(hi+|hey+|hello+|hlo|helo|gm|good morning|namaste|kaisi ho|kaise ho|sup|yo)\b/);

  if (hoursSinceLastUserMessage !== null && hoursSinceLastUserMessage >= 12) out.push('return');
  if (out.length === 0) {
    out.push(/^(ok|okay|k|hmm+|haha+|hehe+|lol|acha+|accha+|achha+|han|haan|ha|yes|no|nahi|\.+|\?+|👍|😂|🙂)$/.test(t) || t.length <= 4 ? 'short' : 'casual');
  }
  return out;
}

/**
 * Are they asking whether SHE is an AI / real? Only when the question is about her ("tum real ho?",
 * "are you a bot", "is this AI?") — not any sentence containing "insaan" or "AI" ("ek insaan bol raha
 * hai…", "AI tools se business kaise karu").
 */
export function asksIfAI(text: string): boolean {
  const t = text.toLowerCase();
  const WHAT = '(ai|a\\.i\\.|bot|robot|real|asli|insaan|insan|human|machine|chatgpt|computer|program)';
  const aboutHer = new RegExp(`\\b(tum|tu|aap|you|u|r u|ho tum)\\b[^.?!\\n]{0,25}\\b${WHAT}\\b|\\b${WHAT}\\b[^.?!\\n]{0,12}\\b(ho|ho kya|hai kya tu|hain aap)\\b\\s*\\??\\s*$`);
  return aboutHer.test(t) || /\b(is this|are you|am i talking to)\b[^.?!\n]{0,15}\b(an? )?(ai|bot|robot|human|real person)\b/.test(t) || /(tum kaun ho|who are you|kya tum insaan|sach batao tum kaun)/.test(t);
}
