import type { Curriculum } from './types.js';

/** Freelancing from the first client to a steady practice. No income promises — it's a numbers game you can measure. */
export const freelancing: Curriculum = {
  id: 'freelancing',
  name: 'Freelancing — first client to steady work',
  match: /\b(freelanc\w*|fiverr|upwork|contra|client|clients|side income|remote work)\b/i,
  codeLang: 'text',
  docs: 'the platforms\' own help pages (Upwork, Fiverr, Contra) — fees and rules change',
  levels: [
    {
      title: 'Start',
      lessons: [
        { title: 'Is freelancing for you?', topics: ['freedom vs uncertainty — honestly', 'freelancing on the side before quitting', 'it\'s a numbers game: outreach → replies → calls → clients'] },
        { title: 'Your offer', topics: ['one service for one kind of client', 'the outcome, not the task ("more bookings", not "a website")', 'starter offer vs full offer'] },
      ],
      project: 'write your offer in one line: I help [who] get [result] with [service]',
    },
    {
      title: 'Proof',
      lessons: [
        { title: 'A small portfolio', topics: ['3 pieces that match your offer', 'spec work and redesigns when you have no clients', 'case studies: problem → what you did → result'] },
        { title: 'Your profiles', topics: ['LinkedIn as your storefront', 'platform profiles (Upwork, Fiverr, Contra) that convert', 'a simple one-page site or Notion portfolio'] },
      ],
      project: 'three portfolio pieces with short case studies, live on one link',
    },
    {
      title: 'Finding clients',
      lessons: [
        { title: 'Prospect lists', topics: ['who has the problem you solve', 'finding 50 good-fit prospects', 'a tracker sheet'] },
        { title: 'Outreach', topics: ['a cold message that\'s about them, not you', 'LinkedIn DMs and cold email', 'follow-ups (most replies come after the 2nd or 3rd)'] },
        { title: 'Platforms', topics: ['how proposals work on Upwork-style platforms', 'a proposal that gets opened', 'fees and when platforms are worth it'] },
        { title: 'Referrals and warm leads', topics: ['telling your network what you do', 'asking happy clients for referrals', 'partnering with other freelancers'] },
      ],
      project: 'two weeks of outreach: 50 prospects, messages and follow-ups, tracked — then we read the numbers',
    },
    {
      title: 'Winning the work',
      lessons: [
        { title: 'Discovery calls', topics: ['questions that uncover the real problem', 'listening more than pitching', 'deciding if it\'s a fit'] },
        { title: 'Proposals', topics: ['problem, plan, timeline, price, next step', 'options (good / better / best)', 'following up on a proposal'] },
        { title: 'Pricing', topics: ['hourly vs project vs retainer', 'pricing from value and your costs', 'raising prices with new clients first'] },
      ],
      project: 'a real proposal for a real prospect — reviewed with me before you send it',
    },
    {
      title: 'Doing the work',
      lessons: [
        { title: 'Scope and contracts', topics: ['a written scope and number of revisions', 'a simple contract', 'saying no to scope creep politely'] },
        { title: 'Getting paid', topics: ['advance payments (always for new clients)', 'invoices and payment methods for international clients', 'chasing late payments'] },
        { title: 'Client happiness', topics: ['updates before they ask', 'handling feedback and difficult clients', 'turning one project into repeat work'] },
      ],
      project: 'your own contract template, invoice template and onboarding checklist',
    },
    {
      title: 'Steady practice',
      lessons: [
        { title: 'Money and tax', topics: ['irregular income and a buffer fund', 'tax on freelance income, GST, foreign payments — confirm with a CA', 'separating business and personal money'] },
        { title: 'Scams and red flags', topics: ['"pay to get projects" and fake clients', 'overpayment and cheque frauds', 'unpaid "test tasks" that are real work'] },
        { title: 'Growing', topics: ['retainers and repeat clients', 'niching down', 'subcontracting or a small team'] },
      ],
      project: 'final: a 90-day plan with your numbers, a pricing update, and a look back at your first client',
    },
  ],
};
