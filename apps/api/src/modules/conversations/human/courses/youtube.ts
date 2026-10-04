import type { Curriculum } from './types.js';

/** YouTube from zero to earning. Monetisation rules and numbers change — always check YouTube's own Help pages; never promise income. */
export const youtube: Curriculum = {
  id: 'youtube',
  name: 'YouTube from zero',
  match: /\b(youtube|yt|youtuber|channel|vlog\w*|shorts)\b/i,
  codeLang: 'text',
  docs: "YouTube Help and the YouTube Creators channel — monetisation rules change, check there",
  levels: [
    {
      title: 'Start',
      lessons: [
        { title: 'How YouTube works', topics: ['search, suggested and browse — where views come from', 'what YouTube rewards: clicks (CTR) and watch time (retention)', 'long videos vs Shorts', 'why the first 50 videos are practice'] },
        { title: 'Your why and your time', topics: ['hobby, brand, or income — different plans', 'a realistic timeline (months, not weeks) — results vary', 'how many hours a week you can actually give'] },
      ],
      project: 'write your channel goal and a weekly time budget you can keep for 3 months',
    },
    {
      title: 'Foundation',
      lessons: [
        { title: 'Your niche', topics: ['topics you can make 100 videos about', 'niche = audience + problem + your angle', 'studying 5 channels in your niche'] },
        { title: 'Setting up the channel', topics: ['name, handle and channel art', 'the About section and links', 'channel trailer and playlists'] },
        { title: 'Ideas that get views', topics: ['what people search (YouTube search suggestions)', 'outlier videos in your niche', 'turning one idea into a series'] },
      ],
      project: 'set up your channel fully and write a list of 30 video ideas',
    },
    {
      title: 'Making videos',
      lessons: [
        { title: 'Phone filming', topics: ['light (a window beats a ring light)', 'sound first — a cheap mic matters more than the camera', 'framing and a stable phone'] },
        { title: 'Talking to camera', topics: ['scripts vs bullet points', 'energy and pace', 'getting over camera shyness'] },
        { title: 'Editing basics', topics: ['cutting dead air', 'b-roll, text and zooms to keep attention', 'a simple free editing workflow'] },
        { title: 'Shorts', topics: ['the first second matters', 'vertical framing and captions', 'turning long videos into Shorts'] },
      ],
      project: 'publish your first 3 videos — imperfect is fine, published is the point',
    },
    {
      title: 'Getting clicks and watch time',
      lessons: [
        { title: 'Thumbnails', topics: ['one idea, big face or object, few words', 'contrast and readability on a phone', 'testing two thumbnails'] },
        { title: 'Titles', topics: ['curiosity + clarity', 'keywords people search', 'title and thumbnail working together, never misleading'] },
        { title: 'Retention', topics: ['the hook in the first 30 seconds', 'reading the retention graph', 'cutting where people leave'] },
        { title: 'Analytics', topics: ['CTR, average view duration, returning viewers', 'what to change after a flop', 'one change at a time'] },
      ],
      project: 'remake the thumbnail and title of your worst video and compare the numbers after a week',
    },
    {
      title: 'Growing',
      lessons: [
        { title: 'Consistency', topics: ['an upload schedule you can keep', 'batching and a content calendar', 'avoiding burnout'] },
        { title: 'Community', topics: ['replying to comments', 'community posts and polls', 'collaborations with similar channels'] },
        { title: 'What not to do', topics: ['sub-for-sub, buying views or subscribers', 'misleading thumbnails and reused content', 'why these hurt your channel'] },
      ],
      project: 'keep a schedule for 6 weeks and review your analytics with me',
    },
    {
      title: 'Earning',
      lessons: [
        { title: 'The YouTube Partner Program', topics: ['what it requires today (check YouTube Help — it changes)', 'ad revenue basics and why it varies a lot by niche', 'never trust "monetise in 7 days" services'] },
        { title: 'Other income', topics: ['brand sponsorships and how to pitch', 'affiliate links', 'memberships and Super Thanks', 'your own product or service'] },
        { title: 'Money basics', topics: ['contracts and usage', 'invoices and payments', 'tax on YouTube income — confirm with a CA'] },
      ],
      project: 'a simple media kit and 3 pitches to small brands in your niche',
    },
    {
      title: 'Advanced',
      lessons: [
        { title: 'Strategy', topics: ['series and formats that win', 'packaging (idea + title + thumbnail) before filming', 'learning from your top 10% videos'] },
        { title: 'Scaling', topics: ['hiring an editor or thumbnail designer', 'a second channel or a new language', 'building something you own (email list, community)'] },
      ],
      project: 'final: a 90-day plan built from your own analytics, and a look back at how far you came',
    },
  ],
};
