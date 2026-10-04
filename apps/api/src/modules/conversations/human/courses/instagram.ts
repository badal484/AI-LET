import type { Curriculum } from './types.js';

/** Instagram growth & personal brand, zero to advanced. Features and the algorithm change — check Instagram's own Creators pages; never promise numbers. */
export const instagram: Curriculum = {
  id: 'instagram',
  name: 'Instagram growth & personal brand',
  match: /\b(instagram|insta|reels?|influencer|content creat\w*|personal brand\w*|followers)\b/i,
  codeLang: 'text',
  docs: "Instagram's own Creators site (creators.instagram.com) — features change often",
  levels: [
    {
      title: 'Start',
      lessons: [
        { title: 'How Instagram works', topics: ['feed, Reels, Stories and Explore — what each is for', 'what the app looks at: watch time, shares, saves, comments (and why likes matter less)', 'reaching non-followers vs keeping followers', 'why the rules change and how to keep up'] },
        { title: 'Your why', topics: ['hobby, business, creator or job — different goals, different plans', 'a realistic picture: growth takes months, results vary', 'one clear goal for the next 90 days'] },
      ],
      project: 'write down your 90-day Instagram goal and the one reason it matters to you',
    },
    {
      title: 'Foundation',
      lessons: [
        { title: 'Your niche', topics: ['picking 1–2 topics you can talk about 100 times', 'niche = topic × audience × your angle', 'testing a niche before committing'] },
        { title: 'Your profile', topics: ['handle and the name field (with a keyword)', 'a bio formula: who you help + how + proof + CTA', 'profile photo and highlights', 'the link in bio'] },
        { title: 'Content pillars', topics: ['3–4 pillars (teach, story, behind-the-scenes, proof)', 'balancing value and personality', 'turning one idea into five posts'] },
        { title: 'Your audience', topics: ['who exactly you are talking to', 'what they search, save and share', 'reading comments and DMs for ideas'] },
      ],
      project: 'fix your profile end to end (bio, name field, highlights) and write your 4 content pillars',
    },
    {
      title: 'Creating content',
      lessons: [
        { title: 'Reels basics', topics: ['shooting on a phone: light, framing, sound', 'length and pacing', 'talking to camera without freezing'] },
        { title: 'Hooks', topics: ['the first 1–3 seconds: visual + text + spoken hook', 'hook types (question, bold claim, mistake, result first)', 'testing two hooks on the same idea'] },
        { title: 'Editing', topics: ['cuts, captions on screen, b-roll', 'a simple editing app workflow', 'cover images that make people tap'] },
        { title: 'Carousels', topics: ['educational and story carousels', 'slide 1 is a hook, the last slide is a CTA', 'design basics: fonts, contrast, few words'] },
        { title: 'Stories', topics: ['daily stories for the people who already follow you', 'polls, questions and quizzes', 'stories that sell without being salesy'] },
        { title: 'Captions, CTAs and keywords', topics: ['captions that add value', 'one clear call to action', 'keywords in captions and the name field (search)', 'hashtags today — few and relevant'] },
      ],
      project: 'post 3 Reels with three different hooks and 1 carousel; note which got the most saves and shares',
    },
    {
      title: 'Growth',
      lessons: [
        { title: 'Consistency', topics: ['a realistic posting schedule you can keep', 'a weekly content calendar', 'batching shoots'] },
        { title: 'Insights', topics: ['reach, plays, watch time, saves, shares, non-follower reach', 'what to do with a flop', 'one change at a time'] },
        { title: 'Trends', topics: ['using trending audio and formats', 'adapting a trend to your niche', 'when to skip a trend'] },
        { title: 'Community', topics: ['replying to comments and DMs', 'turning followers into fans', 'collab posts and creator friends'] },
        { title: 'What not to do', topics: ['buying followers or views, engagement pods, follow-unfollow', 'giveaway traps and fake "growth services"', 'why these hurt your reach and your brand'] },
      ],
      project: 'a 30-day content calendar, followed for two weeks — then read your Insights with me',
    },
    {
      title: 'Personal brand',
      lessons: [
        { title: 'Your story and voice', topics: ['your origin story in 3 lines', 'a voice people recognise', 'sharing without oversharing'] },
        { title: 'Visual identity', topics: ['colours, fonts, a recognisable look', 'face vs faceless accounts', 'a grid that makes sense'] },
        { title: 'Hard parts', topics: ['negative comments and trolls', 'comparison and burnout', 'taking breaks without losing everything'] },
      ],
      project: 'write your brand story and pin a Reel that tells it',
    },
    {
      title: 'Earning',
      lessons: [
        { title: 'Brand deals, honestly', topics: ['when brands start noticing (engagement and niche matter more than follower count)', 'realistic ranges — results vary, nothing is guaranteed', 'red flags: "pay us to get featured", fake brand DMs'] },
        { title: 'Media kit and pitching', topics: ['a one-page media kit', 'a pitch email or DM that gets replies', 'setting your rate and negotiating'] },
        { title: 'Other ways to earn', topics: ['affiliate links', 'UGC (content for brands\' own pages)', 'selling your own product or service'] },
        { title: 'Money basics', topics: ['contracts and usage rights', 'invoices and getting paid', 'GST and income tax basics — confirm with a CA'] },
      ],
      project: 'make your media kit and send 3 real pitches; we review the replies together',
    },
    {
      title: 'Advanced',
      lessons: [
        { title: 'Strategy from data', topics: ['finding your winning formats', 'A/B testing hooks and covers', 'doubling down without repeating yourself'] },
        { title: 'Beyond one platform', topics: ['repurposing to YouTube Shorts and other platforms', 'an email list or community you own', 'not depending on one app'] },
        { title: 'Scaling', topics: ['working with an editor', 'systems and templates', 'a long-term brand plan'] },
      ],
      project: 'final: a 90-day growth plan built from your own data, and a review of how far you came',
    },
  ],
};
