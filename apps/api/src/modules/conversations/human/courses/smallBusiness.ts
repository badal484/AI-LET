import type { Curriculum } from './types.js';

/** Starting a small business in India, zero to growing. Registrations, tax and limits change — always confirm with a CA or the official site. */
export const smallBusiness: Curriculum = {
  id: 'small-business',
  name: 'Starting a small business',
  match: /\b(business|dhanda|dhandha|startup|apna kaam|vyapar|udyam|d2c|side hustle)\b/i,
  codeLang: 'text',
  docs: 'udyamregistration.gov.in, gst.gov.in, fssai.gov.in — and a CA for anything tax or legal',
  levels: [
    {
      title: 'Start',
      lessons: [
        { title: 'Is a business right for you now?', topics: ['why you want it (money, freedom, an idea)', 'time, money you can afford to lose, and family support', 'side business first vs quitting your job'] },
        { title: 'The founder mindset', topics: ['customers first, product second', 'small tests before big spends', 'why most first businesses fail (stock, no customers, no cash)'] },
      ],
      project: 'write one page: why you want a business, how much money and time you can put in, and what you cannot risk',
    },
    {
      title: 'The idea',
      lessons: [
        { title: 'Finding ideas', topics: ['from your skills, your network and your city', 'problems people already pay for', 'boring businesses that make money'] },
        { title: 'Testing demand cheaply', topics: ['talk to 10 possible customers', 'pre-orders and "would you pay ₹X?"', 'a WhatsApp or Instagram test before spending'] },
        { title: 'Competition', topics: ['who else sells this and at what price', 'your one difference', 'competition is proof of demand'] },
      ],
      project: 'test one idea with 10 real people and get at least 3 pre-orders or a clear "no"',
    },
    {
      title: 'Money',
      lessons: [
        { title: 'Costs', topics: ['one-time vs monthly costs', 'cost per piece (materials, packing, delivery, fees)', 'hidden costs people forget'] },
        { title: 'Pricing and margin', topics: ['price from cost + margin, then check the market', 'margin vs markup', 'when to raise prices'] },
        { title: 'Profit and break-even', topics: ['revenue - costs = profit', 'how many sales to break even', 'profit is not cash'] },
        { title: 'Cash flow', topics: ['money in vs money out by month', 'never stock more than you can sell', 'credit to customers — the silent killer'] },
        { title: 'Simple accounts', topics: ['a daily sales/expense sheet', 'separate business and personal money', 'a separate bank account and UPI'] },
      ],
      project: 'a one-sheet plan: cost per piece, price, margin, break-even number and a 3-month cash flow',
    },
    {
      title: 'First customers',
      lessons: [
        { title: 'Your first version', topics: ['the smallest thing you can sell this week', 'packaging and presentation on a budget', 'getting the first 10 customers from people you know'] },
        { title: 'Selling on WhatsApp and Instagram', topics: ['WhatsApp Business: catalogue, labels, quick replies', 'an Instagram page that sells', 'payment and delivery flow'] },
        { title: 'Marketplaces and local', topics: ['marketplaces: fees, returns, when they make sense', 'local shops, societies and stalls', 'which channel for which product'] },
        { title: 'Customer service', topics: ['replying fast and politely', 'handling complaints and refunds', 'turning a complaint into a loyal customer'] },
      ],
      project: 'get your first 10 paying customers and write down what each one said',
    },
    {
      title: 'Registrations and rules',
      lessons: [
        { title: 'What you need and when', topics: ['Udyam (MSME) registration — free, online', 'GST — when it becomes required (limits change; check gst.gov.in)', 'FSSAI for any food business', 'local shop licence and trade licence'] },
        { title: 'Tax basics', topics: ['business income and ITR', 'keeping bills and records', 'when to hire a CA (early)'] },
      ],
      project: 'list exactly which registrations YOUR business needs, checked on the official sites',
    },
    {
      title: 'Growth',
      lessons: [
        { title: 'Repeat customers', topics: ['why repeat beats new', 'reviews and referrals', 'a simple loyalty idea'] },
        { title: 'Marketing on a budget', topics: ['content that sells', 'collaborations with other small brands', 'when paid ads make sense (small tests only)'] },
        { title: 'Your first hire', topics: ['what to hand over first', 'paying fairly and on time', 'simple processes so it doesn\'t depend on you'] },
        { title: 'Money to grow', topics: ['grow from profit first', 'loans: MUDRA and bank loans — read the fine print', 'never borrow from informal lenders or for "guaranteed" schemes'] },
      ],
      project: 'a 6-month growth plan with numbers: repeat rate, one new channel, one process to hand over',
    },
    {
      title: 'Traps and hard times',
      lessons: [
        { title: 'Scams and traps', topics: ['franchise "guaranteed income" offers', 'MLM and "earn from home" schemes', 'fake bulk buyers and advance-payment frauds', 'what to do if you\'re cheated (1930, cybercrime.gov.in)'] },
        { title: 'When things go wrong', topics: ['a bad month: cut costs, talk to customers', 'when to change the idea (pivot) and when to stop', 'failure is data, not identity'] },
      ],
      project: 'final: review your business with me — numbers, customers, one thing to stop, one to double down on',
    },
  ],
};
