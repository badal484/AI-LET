import type { Curriculum } from './types.js';

/** Spoken English, zero to advanced — for Hindi/Hinglish speakers. Speaking first, grammar only as much as speaking needs. */
export const spokenEnglish: Curriculum = {
  id: 'spoken-english',
  name: 'Spoken English',
  match: /\b(english|angrezi|angreji|spoken english|fluent english|english speaking|english bolna)\b/i,
  codeLang: 'text',
  docs: 'the Cambridge Dictionary website (cambridge.org) for meanings and pronunciation audio',
  levels: [
    {
      title: 'Start',
      lessons: [
        {
          title: 'Why English feels hard — and how we will learn',
          topics: [
            'the fear of mistakes, and why speaking daily beats memorising grammar',
            'the 10-minute daily habit (speak, record, listen back)',
            'thinking in small English phrases instead of translating from Hindi',
          ],
        },
        {
          title: 'Sounds and pronunciation basics',
          topics: [
            'vowel sounds that Hindi speakers mix up (ship/sheep, full/fool)',
            'v vs w, th, and the silent letters (knife, listen)',
            'word stress (PHO-to-graph vs pho-TO-graphy)',
            'using a dictionary\'s audio to check pronunciation',
          ],
        },
      ],
      project: 'record a 30-second voice note introducing yourself and listen back once',
    },
    {
      title: 'Basics',
      lessons: [
        { title: 'Introducing yourself', topics: ['name, city, work or studies', 'hobbies and one fun fact', 'asking the other person back ("And you?")', 'common mistakes ("myself Rohit" → "I am Rohit")'] },
        { title: 'Am / is / are and your daily routine', topics: ['am/is/are with simple facts', 'simple present for habits (I wake up at 7)', 'he/she + s (she works)', 'time words: always, usually, sometimes, never'] },
        { title: 'Asking questions', topics: ['what, where, when, why, who, how', 'do / does questions', 'polite question forms ("Could you tell me…")', 'answering in full sentences, not one word'] },
        { title: 'Talking about the past', topics: ['simple past: -ed verbs', 'common irregular verbs (go-went, eat-ate, see-saw)', 'did questions and negatives ("I didn\'t go")', 'telling what you did yesterday'] },
        { title: 'Talking about the future', topics: ['will for decisions and promises', 'going to for plans', 'present continuous for fixed plans ("I\'m meeting him tomorrow")'] },
        { title: 'Numbers, time, dates and money', topics: ['saying times (quarter past, half past)', 'dates (the 5th of October)', 'prices and phone numbers', 'asking "how much / how many"'] },
        { title: 'Polite English', topics: ['please, thank you, sorry, excuse me — where each fits', '"Could you…", "Would you mind…"', 'softening words ("a little", "maybe")', 'why "do the needful" and "revert back" sound odd'] },
      ],
      project: 'a 1-minute voice note about your day, from morning to night, in the past tense',
    },
    {
      title: 'Everyday conversations',
      lessons: [
        { title: 'Small talk', topics: ['starting a conversation (weather, weekend, food)', 'keeping it going with follow-up questions', 'ending it politely'] },
        { title: 'Out and about', topics: ['at a shop or restaurant', 'auto/cab and asking directions', 'at a bank or office counter', 'complaining politely'] },
        { title: 'Phone and video calls', topics: ['opening and closing a call', '"Can you hear me?", "You\'re on mute"', 'asking someone to repeat or slow down', 'leaving a voice message'] },
        { title: 'Describing people, places and things', topics: ['adjectives and their order', 'comparing (bigger, the best, more beautiful)', 'describing your home town'] },
        { title: 'Feelings and opinions', topics: ['I think / I feel / In my opinion', 'agreeing and disagreeing politely', 'saying how you feel without sounding rude'] },
        { title: 'Present continuous and present perfect', topics: ['what\'s happening now (I am reading)', 'have/has done — life experience and recent news', 'since vs for', 'the common "I am knowing" mistake'] },
      ],
      project: 'role-play a full conversation with me: ordering food and making small talk with the waiter',
    },
    {
      title: 'Confidence and fluency',
      lessons: [
        { title: 'Thinking in English', topics: ['self-talk: describing what you\'re doing in English', 'replacing translation with ready phrases', 'a daily 5-minute English diary'] },
        { title: 'Linking words and fillers', topics: ['and, but, so, because, although', 'natural fillers ("well…", "you know", "actually") — without overusing them', 'buying time politely ("Let me think…")'] },
        { title: 'Telling a story', topics: ['past continuous (I was walking when…)', 'sequence words (first, then, after that, finally)', 'making a story interesting'] },
        { title: 'Pronunciation, deeper', topics: ['-ed endings (worked, played, wanted)', 'sentence stress and rhythm', 'intonation for questions', 'words Indians often mispronounce'] },
        { title: 'Common Indian-English mistakes', topics: ['"I am having a doubt" → "I have a question"', 'prepone, "out of station", "do one thing" — what native speakers understand', 'the / a / an', 'him/her and he/she mix-ups'] },
        { title: 'Listening', topics: ['shadowing a short clip', 'learning from shows and podcasts with subtitles', 'understanding fast speakers'] },
      ],
      project: 'a 2-minute voice note telling a real story from your life, using linking words',
    },
    {
      title: 'English at work',
      lessons: [
        { title: 'Emails', topics: ['subject lines and greetings', 'formal vs informal tone', 'a request, an update and an apology email', 'ending an email'] },
        { title: 'Office conversations', topics: ['giving updates in a meeting', 'asking for help or clarification', 'disagreeing politely', 'saying no without sounding rude'] },
        { title: 'Work chat and messages', topics: ['professional WhatsApp/Slack messages', 'short and clear updates', 'following up without nagging'] },
        { title: 'Presentations', topics: ['opening and structure', 'signposting ("First…", "Moving on…")', 'handling questions', 'calming nerves'] },
      ],
      project: 'write a real email to your manager (or a teacher), then present a 2-minute update to me',
    },
    {
      title: 'Interviews',
      lessons: [
        { title: 'Tell me about yourself', topics: ['the 60-second structure: present → past → future', 'making your story specific', 'what NOT to say'] },
        { title: 'Common interview questions', topics: ['strengths and weaknesses', 'why this company / why should we hire you', 'questions about gaps or failures', 'asking your own questions at the end'] },
        { title: 'HR and salary talk', topics: ['notice period, relocation, expectations', 'talking about salary politely', 'follow-up email after the interview'] },
        { title: 'Voice and body language', topics: ['pace, pauses and clarity', 'eye contact and posture on video', 'nervousness tricks'] },
      ],
      project: 'a full mock interview with me — then I give you your top 3 improvements',
    },
    {
      title: 'Advanced',
      lessons: [
        { title: 'Phrasal verbs and idioms', topics: ['the 20 most common phrasal verbs (look after, give up, figure out…)', 'everyday idioms and when they sound natural', 'avoiding idioms that sound forced'] },
        { title: 'Conditionals', topics: ['if + present (real situations)', 'if + past (imaginary situations)', 'if + had (regrets)'] },
        { title: 'Reported speech', topics: ['"He said that…"', 'reporting questions and requests', 'using it in office updates'] },
        { title: 'Persuasion and negotiation', topics: ['making a case', 'handling objections', 'reaching agreement politely'] },
        { title: 'Group discussions and debates', topics: ['entering a discussion', 'building on others\' points', 'summarising', 'staying calm when interrupted'] },
        { title: 'Public speaking', topics: ['structuring a short talk', 'storytelling for impact', 'speaking without notes'] },
      ],
      project: 'final: a 3-minute talk on a topic you care about, without notes — recorded, reviewed, celebrated',
    },
  ],
};
