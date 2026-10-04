import type { Curriculum } from './types.js';

/** Getting the job you want — from choosing a role to the first 90 days. No job guarantees; a job search is a funnel you can measure. */
export const jobSearch: Curriculum = {
  id: 'job-search',
  name: 'Getting the job you want',
  match: /\b(job|naukri|career|placement|resume|cv|internship|linkedin|job search|job switch|switch karna)\b/i,
  codeLang: 'text',
  docs: 'company career pages and LinkedIn — and real people in the role you want',
  levels: [
    {
      title: 'Start',
      lessons: [
        { title: 'The job search is a funnel', topics: ['applied → replied → interviews → offers', 'why "apply everywhere" fails', 'tracking your numbers every week'] },
        { title: 'Choosing your target role', topics: ['roles that fit your skills and interests', 'reading 10 job descriptions for patterns', 'one primary role, one backup'] },
      ],
      project: 'pick your target role and make a tracker sheet (company, role, date, status)',
    },
    {
      title: 'Your story on paper',
      lessons: [
        { title: 'The resume', topics: ['one page, the target role on top', 'bullets as action + result + number', 'projects when you have no experience', 'ATS basics: simple format, keywords from the job description'] },
        { title: 'LinkedIn', topics: ['headline that says what you do', 'the About section as a short story', 'posting and commenting without cringe'] },
        { title: 'Proof of work', topics: ['a small project or case study for your target role', 'a portfolio link', 'turning college projects into proof'] },
      ],
      project: 'a rewritten resume and LinkedIn profile for your target role — reviewed line by line with me',
    },
    {
      title: 'Getting replies',
      lessons: [
        { title: 'Applying smart', topics: ['10 tailored applications beat 100 generic ones', 'career pages vs job boards', 'applying within the first days of a posting'] },
        { title: 'Referrals and networking', topics: ['finding people at the company', 'a short, specific referral message', 'following up without being annoying'] },
        { title: 'Internships and first jobs', topics: ['where freshers actually get hired', 'off-campus drives and startups', 'turning an internship into an offer'] },
      ],
      project: 'two weeks of the funnel: 20 tailored applications + 10 referral messages, tracked',
    },
    {
      title: 'Interviews',
      lessons: [
        { title: 'Tell me about yourself', topics: ['present → past → why this role', 'one story that proves you can do it', '60 seconds, no resume reading'] },
        { title: 'Behavioural questions', topics: ['the STAR method', 'a bank of 6 stories (conflict, failure, leadership, impact)', 'weakness answers that are honest'] },
        { title: 'Role-specific rounds', topics: ['case, technical or assignment rounds — how to prepare', 'thinking out loud', 'asking clarifying questions'] },
        { title: 'HR round', topics: ['notice period, relocation, expectations', 'questions to ask them', 'the follow-up email'] },
      ],
      project: 'a full mock interview with me for your target role, with your top 3 fixes',
    },
    {
      title: 'Offers',
      lessons: [
        { title: 'Reading an offer', topics: ['CTC vs in-hand vs variable', 'joining bonus, notice buyout, bonds', 'red flags in an offer letter'] },
        { title: 'Negotiating', topics: ['researching the range', 'asking politely with a reason', 'negotiating beyond salary (role, title, remote, start date)'] },
        { title: 'Scams', topics: ['"pay a fee to get the job" is always a scam', 'fake offer letters and recruiters', 'checking a company before you join'] },
      ],
      project: 'practise a negotiation conversation with me using a real or sample offer',
    },
    {
      title: 'Switching and growing',
      lessons: [
        { title: 'Switching careers', topics: ['transferable skills', 'a bridge role', 'a side project that proves the switch'] },
        { title: 'The first 90 days', topics: ['learning the product and the people', 'an early small win', 'asking for feedback before reviews'] },
        { title: 'Growing at work', topics: ['doing the work nobody asked for', 'visibility without politics', 'when to ask for a raise or promotion'] },
      ],
      project: 'final: a 90-day plan for your next (or current) job, and a one-page career plan for the next 2 years',
    },
  ],
};
