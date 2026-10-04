import type { Curriculum } from './types.js';

/**
 * Health programs — step by step, with a health check first and check-ins instead of quizzes. The health
 * safety rules (no medicines or doses, 112 for emergencies, no crash diets, eating-disorder care, crisis care,
 * "see a doctor" with when and why) always win over the program.
 */

export const skinProgram: Curriculum = {
  id: 'skin-program',
  kind: 'program',
  name: 'Your skin, simply — a 3-month skin program',
  match: /\b(skin|skincare|acne|pimple|pimples|daag|tan|tanning|pigmentation|oily skin|dry skin|glow|sunscreen|face routine)\b/i,
  codeLang: 'text',
  docs: 'a dermatologist for anything that is not getting better — and the product label for ingredients',
  screening:
    'their skin type as they see it (oily, dry, combination, sensitive), what they use on their face now, any allergies or reactions before, whether they are pregnant or breastfeeding (some ingredients are not safe then), and any skin condition or medicine a doctor gave them',
  levels: [
    {
      title: 'Know your skin',
      lessons: [
        { title: 'Your skin type', topics: ['oily, dry, combination, sensitive — how to tell', 'what your skin is telling you (shine, flakes, redness)', 'why fewer products works better'] },
        { title: 'Patch testing', topics: ['how to patch test any new product (behind the ear or inner arm, 2–3 days)', 'what a reaction looks like and what to do', 'one new product at a time'] },
      ],
      project: 'a "skin diary" for a week: what you used, how your skin felt morning and night',
    },
    {
      title: 'The 3-product routine',
      lessons: [
        { title: 'Cleanser', topics: ['a gentle cleanser for your skin type', 'twice a day, not more', 'what to avoid (harsh scrubs, soap on the face)'] },
        { title: 'Moisturiser', topics: ['why even oily skin needs one', 'gel vs cream', 'how much to use'] },
        { title: 'Sunscreen', topics: ['SPF 30+ broad spectrum every day, even indoors near windows', 'how much (two finger-lengths for face and neck)', 'reapplying when outdoors'] },
      ],
      project: 'follow the 3-product routine for 2 weeks and keep the skin diary',
    },
    {
      title: 'Common concerns',
      lessons: [
        { title: 'Acne basics', topics: ['why pimples happen (oil, clogged pores, hormones)', 'hands off — no picking or squeezing', 'gentle ingredients to know about (and why a dermatologist decides stronger ones)', 'when acne needs a dermatologist (painful, cystic, scarring, not better in 6–8 weeks)'] },
        { title: 'Tan and pigmentation', topics: ['tan vs pigmentation', 'sunscreen is the real fix', 'patience: weeks to months', 'never bleaching or "fairness" creams — glow, not gora'] },
        { title: 'Dangerous quick fixes', topics: ['steroid creams sold as fairness or acne fixes — why they damage skin', 'DIY that hurts (lemon, toothpaste, baking soda)', 'when "instant results" is a red flag'] },
      ],
      project: 'a 6-week check: compare your skin diary from week 1 with now',
    },
    {
      title: 'Your skin for life',
      lessons: [
        { title: 'Lifestyle and skin', topics: ['sleep, water and stress show on skin', 'pillowcases, phones and hands', 'food — no miracle foods, no guilt'] },
        { title: 'Adding a 4th product (only if needed)', topics: ['what an extra step would solve', 'introducing it slowly with a patch test', 'when to stop'] },
        { title: 'When to see a dermatologist', topics: ['rashes, sudden changes, moles that change, painful acne, anything not improving', 'what to tell them and take along', 'following their plan, not internet advice'] },
      ],
      project: 'a 3-month review: your routine, what worked, what you dropped',
    },
  ],
};

export const nutritionProgram: Curriculum = {
  id: 'nutrition-program',
  kind: 'program',
  name: 'Eating better with ghar ka khana — an 8-week program',
  match: /\b(diet|khana|food|nutrition|weight loss|vajan|wazan|weight|protein|eating|bloating|cravings?|meal plan)\b/i,
  codeLang: 'text',
  docs: 'ICMR-NIN Dietary Guidelines for Indians (2024) — and their own doctor for any medical condition',
  screening:
    'veg, eggetarian or non-veg; their goal (energy, weight, strength, a condition); any diabetes, BP, thyroid, PCOS, kidney or liver issue, pregnancy, or medicines; what a normal day of eating looks like for them; and — gently — whether food ever feels out of control or guilty for them',
  levels: [
    {
      title: 'Start where you are',
      lessons: [
        { title: 'Your normal day', topics: ['writing down a normal day of eating, no judgement', 'spotting one easy win', 'why crash diets fail (and are unsafe)'] },
        { title: 'The balanced Indian plate', topics: ['half vegetables, then grains/millets, then protein', 'keeping roti, rice and ghar ka khana', 'portions with your hand'] },
      ],
      project: 'a week of normal-day notes, then pick your one easy win together',
    },
    {
      title: 'Building blocks',
      lessons: [
        { title: 'Protein', topics: ['roughly 0.8 g per kg body weight for most adults (more if lifting — doctor first with kidney issues)', 'veg protein: dal, paneer, curd, chana, soy, sprouts', 'protein at every meal'] },
        { title: 'Smart swaps', topics: ['chai-biscuit to chai-chana', 'maida to whole grains, millets', 'fried to roasted — without losing taste'] },
        { title: 'Salt, sugar and oil', topics: ['salt under about 1 teaspoon a day including food', 'hidden sugar in drinks and packets', 'oil in moderation, not zero'] },
      ],
      project: 'two weeks of protein at every meal + one swap a day',
    },
    {
      title: 'Real life',
      lessons: [
        { title: 'Cravings and emotional eating', topics: ['why cravings happen (sleep, stress, skipped meals)', 'eating without guilt', 'when food feels out of control — talk to someone (a doctor or Tele-MANAS 14416)'] },
        { title: 'Reading labels', topics: ['serving size, sugar, sodium, protein', 'marketing words that mean nothing', 'comparing two packets'] },
        { title: 'Eating out and festivals', topics: ['restaurant choices without stress', 'shaadi and festival food — enjoy, then back to normal', 'travel and hostel food'] },
      ],
      project: 'a 6-week check-in: energy, digestion, how food feels — and a gentle look at the goal',
    },
    {
      title: 'Making it last',
      lessons: [
        { title: 'Your own plan', topics: ['a simple weekly template from your favourite foods', 'batch cooking and tiffins', 'safe pace for weight change (about 0.5–1 kg a week)'] },
        { title: 'Conditions and doctors', topics: ['diabetes, BP, thyroid, PCOS — general tips + your doctor decides', 'what to ask your doctor about food', 'never stopping a medicine for a diet'] },
      ],
      project: 'an 8-week review: what changed, what you keep, what you drop',
    },
  ],
};

export const strengthProgram: Curriculum = {
  id: 'strength-program',
  kind: 'program',
  name: 'Strong, not small — a 12-week strength program',
  match: /\b(workout|exercise|strength|strong|gym|fitness|weights?|fat loss|toning|home workout|squats?|pushups?|push-ups?)\b/i,
  codeLang: 'text',
  docs: 'a doctor or physio for any pain, injury or condition',
  screening:
    'any injury or joint pain (knee, back, shoulder), any heart, BP or breathing condition, pregnancy or recent surgery, how active they are now, and whether they train at home or in a gym',
  levels: [
    {
      title: 'Foundations',
      lessons: [
        { title: 'Why strength', topics: ['strength for daily life, not just looks', 'fat loss vs muscle gain in simple words', 'consistency beats intensity'] },
        { title: 'Form first', topics: ['squat, hinge, push, pull — the four patterns', 'bodyweight versions to learn form', 'good pain vs bad pain (sharp, joint or lasting pain = stop)'] },
        { title: 'Warm-up and cool-down', topics: ['a 5-minute warm-up', 'mobility for hips and shoulders', 'cool-down and stretching'] },
      ],
      project: 'three full-body sessions in one week with good form — and how it felt',
    },
    {
      title: 'Building',
      lessons: [
        { title: 'Full-body routine', topics: ['3 days a week, the four patterns', 'sets, reps and rest in simple words', 'home and gym versions'] },
        { title: 'Progressive overload', topics: ['adding a little each week (reps, weight, control)', 'a training log', 'when to hold back'] },
        { title: 'Eating for strength', topics: ['protein on an Indian diet', 'eating enough — not too little', 'water and sleep'] },
      ],
      project: 'four weeks of the routine with a log — then a check-in on strength and energy',
    },
    {
      title: 'Getting stronger',
      lessons: [
        { title: 'Your first strength milestones', topics: ['a full push-up, a bodyweight squat set, your first loaded lift', 'celebrating PRs', 'plateaus and what to change'] },
        { title: 'Recovery', topics: ['rest days and sleep', 'soreness vs injury', 'deload weeks'] },
        { title: 'Strength for women', topics: ['why lifting won\'t make you "bulky"', 'training through the month — listening to your body', 'confidence in the weights section'] },
      ],
      project: 'a 12-week review: your log, your PRs, how you feel — and the next 12 weeks',
    },
  ],
};

export const gymProgram: Curriculum = {
  id: 'gym-program',
  kind: 'program',
  name: 'Gym from day 1 — a 12-week program',
  match: /\b(gym|bulk|bulking|cut|cutting|muscle|workout split|push pull|ppl|bench|deadlift|bodybuilding|body banana)\b/i,
  codeLang: 'text',
  docs: 'a doctor or physio for any pain, injury or condition',
  screening:
    'any injury or joint pain, any heart, BP or breathing condition, recent surgery, their age if under 18 (then only safe beginner training with a guardian\'s okay), their goal (muscle, fat loss, fitness), and how many days a week they can go',
  levels: [
    {
      title: 'Day 1',
      lessons: [
        { title: 'Walking into the gym', topics: ['gym nerves are normal', 'gym etiquette (re-racking, wiping, sharing)', 'asking a trainer for help'] },
        { title: 'Form cues', topics: ['squat, deadlift (start with hinges), bench/press, rows, pulldowns', 'start light — form before weight', 'stop on sharp or joint pain'] },
      ],
      project: 'two weeks of full-body sessions, light and clean',
    },
    {
      title: 'Your split',
      lessons: [
        { title: 'Choosing a split', topics: ['full body, upper/lower, push-pull-legs — which fits your days', 'a sample week', 'cardio that helps, not hurts'] },
        { title: 'Progressive overload', topics: ['a training log', 'adding weight or reps safely', 'plateaus'] },
      ],
      project: 'six weeks on your split with a log — then a check-in',
    },
    {
      title: 'Goals',
      lessons: [
        { title: 'Bulking and cutting', topics: ['what they mean', 'slow and steady (safe weight change)', 'protein on an Indian diet'] },
        { title: 'Recovery and sleep', topics: ['7–9 hours of sleep', 'rest days, deloads', 'soreness vs injury'] },
        { title: 'Shortcuts that hurt', topics: ['steroids, SARMs, fat burners — why never', 'supplements: food first, ask a doctor', 'ego lifting'] },
      ],
      project: 'a 12-week review: your log, your PRs and the next plan',
    },
  ],
};

export const habitProgram: Curriculum = {
  id: 'habit-program',
  kind: 'program',
  name: 'A 21-day habit reset — sleep, energy, small habits',
  match: /\b(sleep|neend|so nahi|insomnia|energy|thakan|tired|habit|habits|routine|screen time|subah uthna|jaldi uthna)\b/i,
  codeLang: 'text',
  docs: 'a doctor if sleep problems last for weeks, or with snoring and daytime sleepiness',
  screening:
    'their work or study hours (and any night shifts), when they sleep and wake now, caffeine and screen use at night, and whether they have any health condition or take medicines that affect sleep',
  levels: [
    {
      title: 'Start tiny',
      lessons: [
        { title: 'How habits work', topics: ['tiny start + a trigger ("after X, I will Y")', 'tracking without guilt', 'missing a day doesn\'t undo it'] },
        { title: 'Your sleep window', topics: ['adults need about 7–9 hours', 'a fixed wake time first', 'a wind-down routine'] },
      ],
      project: 'one week: the same wake time every day, tracked',
    },
    {
      title: 'Energy',
      lessons: [
        { title: 'Morning energy', topics: ['light in the morning', 'water before chai', 'a 5-minute move'] },
        { title: 'Water and walking', topics: ['a water cue you can\'t miss', 'walking after meals', 'small steps count'] },
        { title: 'Screens and caffeine', topics: ['the last hour without screens (or less light)', 'caffeine timing', 'phone out of the bed'] },
      ],
      project: 'two weeks of the 3 habits — then a check-in on sleep and energy',
    },
    {
      title: 'Keeping it',
      lessons: [
        { title: 'Stress breaks', topics: ['2-minute breathing breaks', 'a walk instead of a scroll', 'switching off after work'] },
        { title: 'When it\'s not enough', topics: ['signs to see a doctor (weeks of bad sleep, loud snoring, daytime sleepiness)', 'never sleeping pills without a doctor', 'shift-work tips'] },
      ],
      project: 'a 21-day review: what stuck, what to try next',
    },
  ],
};

export const calmMindProgram: Curriculum = {
  id: 'calm-mind-program',
  kind: 'program',
  name: 'Calm-mind tools — a self-help program (not therapy)',
  match: /\b(stress|anxiety|anxious|overthinking|overthink|tension|ghabrahat|panic|burnout|calm|mind|mental health)\b/i,
  codeLang: 'text',
  docs: 'a therapist or Tele-MANAS 14416 (free, 24x7) — these tools help, they don\'t replace care',
  screening:
    'gently, first: whether they are safe right now (if not, crisis care comes before everything); then what weighs on them most, how long it has been like this, and how it affects sleep, food and daily life',
  levels: [
    {
      title: 'Right now tools',
      lessons: [
        { title: 'Slow breathing', topics: ['a slow breath out longer than in', 'when to use it (before a meeting, at night)', 'practising when calm so it works when not'] },
        { title: 'Grounding', topics: ['5-4-3-2-1 senses', 'feet on the floor, name the room', 'for panic moments'] },
      ],
      project: 'try one tool every day for a week and note when it helped',
    },
    {
      title: 'Thoughts and worries',
      lessons: [
        { title: 'Worry time', topics: ['writing worries down', 'a fixed 15-minute worry slot', 'what you can control vs what you can\'t'] },
        { title: 'Thought checks', topics: ['spotting all-or-nothing and mind-reading thoughts', 'asking "what\'s the evidence?"', 'a kinder, truer thought'] },
        { title: 'Talking to someone', topics: ['choosing one person to tell', 'what to say when it\'s hard to say', 'it\'s strength, not weakness'] },
      ],
      project: 'two weeks of worry time + thought checks — then a check-in on how heavy things feel',
    },
    {
      title: 'Steady ground',
      lessons: [
        { title: 'Sleep, movement and stress', topics: ['how sleep and movement change mood', 'tiny routines on bad days', 'burnout signs'] },
        { title: 'When to get more help', topics: ['signs it\'s more than stress (weeks of low mood, panic attacks, not functioning)', 'how therapy works and how to find it', 'Tele-MANAS 14416 any time'] },
      ],
      project: 'your own "calm kit": the tools that work for you, and who you\'d call',
    },
  ],
};

export const doctorVisitProgram: Curriculum = {
  id: 'doctor-visit-program',
  kind: 'program',
  name: 'Ready for any doctor visit — a simple guide',
  match: /\b(doctor|clinic|appointment|checkup|check-up|report|reports|test results|hospital|opd|prescription)\b/i,
  codeLang: 'text',
  docs: 'their own doctor — this guide helps them talk to doctors, it never replaces one',
  screening:
    'what the worry or visit is about, and how soon (anything with emergency signs means 112 or the nearest hospital now, not a guide)',
  levels: [
    {
      title: 'Before the visit',
      lessons: [
        { title: 'Choosing where to go', topics: ['GP vs specialist vs hospital OPD', 'government vs private, and telemedicine (eSanjeevani)', 'when it\'s urgent and when it can wait'] },
        { title: 'What to carry and say', topics: ['old reports, prescriptions and a medicines list', 'your symptoms in order: what, since when, what makes it better or worse', 'writing 3 questions before you go'] },
      ],
      project: 'a one-page "health card": your conditions, medicines, allergies and past reports',
    },
    {
      title: 'At and after the visit',
      lessons: [
        { title: 'In the room', topics: ['saying the most important thing first', 'asking "what is it, what do I do, when do I come back?"', 'asking them to write it down'] },
        { title: 'Understanding what they said', topics: ['common words in simple language', 'reading a report\'s reference ranges (and why only the doctor interprets)', 'following the plan — never changing medicines yourself'] },
        { title: 'Follow-ups and records', topics: ['booking the follow-up', 'keeping reports in one folder (and DigiLocker/ABHA)', 'when to go back sooner'] },
      ],
      project: 'your next (or a pretend) visit: prepare it together and review how it went',
    },
  ],
};
