import type { Curriculum } from './types.js';

/** HTML and CSS from zero to advanced. Checked against MDN's Learn web development (Oct 2026). */
export const htmlCss: Curriculum = {
  id: 'html-css',
  name: 'HTML & CSS',
  match: /\b(html5?|css3?|tailwind|web ?design)\b/i,
  codeLang: 'html',
  docs: 'developer.mozilla.org/en-US/docs/Learn_web_development',
  levels: [
    {
      title: 'Start',
      lessons: [
        {
          title: 'How the web works',
          topics: ['browser, server, URL and HTTP in simple words', 'what HTML, CSS and JavaScript each do', 'setup: VS Code, a browser and the Live Server extension'],
        },
      ],
      project: 'a "hello" page that opens in your browser',
    },
    {
      title: 'HTML',
      lessons: [
        {
          title: 'HTML basics',
          topics: ['tags, elements and attributes', 'the page skeleton: doctype, html, head, body, meta charset and viewport, title', 'headings and paragraphs', 'comments and whitespace'],
        },
        {
          title: 'Text and links',
          topics: ['strong, em, br, hr', 'lists: ul, ol, li', 'links: a, href, target, relative vs absolute paths', 'block vs inline elements'],
        },
        {
          title: 'Images and media',
          topics: ['img with src and alt (why alt matters)', 'image formats and sizes', 'audio, video and iframe embeds', 'figure and figcaption'],
        },
        {
          title: 'Tables',
          topics: ['table, tr, td, th', 'thead, tbody, caption', 'colspan, rowspan', 'when not to use tables (layout)'],
        },
        {
          title: 'Forms',
          topics: ['form, action and method', 'input types (text, email, password, number, date, checkbox, radio)', 'label (for/id), textarea, select', 'buttons and built-in validation (required, minlength, pattern)'],
        },
        {
          title: 'Semantic HTML and accessibility',
          topics: ['header, nav, main, section, article, aside, footer', 'why semantics help screen readers and SEO', 'accessibility basics: alt, labels, headings order, keyboard use', 'meta tags for SEO and sharing'],
        },
      ],
      project: 'a multi-page personal site in plain HTML: home, about, a projects table and a contact form',
    },
    {
      title: 'CSS basics',
      lessons: [
        {
          title: 'CSS basics',
          topics: ['inline, internal and external CSS (link)', 'selectors: element, class, id', 'properties and values, comments', 'the cascade, specificity and inheritance'],
        },
        {
          title: 'Colours, text and units',
          topics: ['colours: names, hex, rgb, hsl, opacity', 'fonts, Google Fonts, font-size, weight, line-height', 'units: px, %, em, rem, vw, vh', 'text-align, decoration, transform'],
        },
        {
          title: 'The box model',
          topics: ['content, padding, border, margin', 'box-sizing: border-box', 'width, height, min/max sizes', 'margin collapsing', 'overflow'],
        },
        {
          title: 'Display and position',
          topics: ['display: block, inline, inline-block, none', 'position: static, relative, absolute, fixed, sticky', 'z-index', 'centering things'],
        },
        {
          title: 'More selectors',
          topics: ['descendant and child selectors', 'pseudo-classes: :hover, :focus, :nth-child', 'pseudo-elements: ::before, ::after', 'attribute selectors', 'backgrounds, borders, border-radius, shadows'],
        },
      ],
      project: 'style your personal site: colours, fonts, spacing and a hover effect on links and buttons',
    },
    {
      title: 'Layout',
      lessons: [
        {
          title: 'Flexbox',
          topics: ['flex container and items', 'justify-content and align-items', 'flex-direction, flex-wrap, gap', 'flex-grow, shrink, basis', 'common layouts: navbar, cards row'],
        },
        {
          title: 'Grid',
          topics: ['grid-template-columns and rows, fr units', 'gap, repeat(), minmax()', 'placing items, grid areas', 'auto-fit / auto-fill for responsive cards', 'Flexbox vs Grid'],
        },
        {
          title: 'Responsive design',
          topics: ['mobile-first thinking', 'media queries', 'responsive images (max-width: 100%, srcset)', 'clamp() for fluid sizes', 'testing in DevTools device mode'],
        },
      ],
      project: 'a responsive landing page (navbar, hero, features grid, footer) that works on phone and laptop',
    },
    {
      title: 'Advanced CSS',
      lessons: [
        {
          title: 'Motion',
          topics: ['transitions', 'transform: translate, scale, rotate', 'keyframe animations', 'prefers-reduced-motion'],
        },
        {
          title: 'Modern CSS',
          topics: ['custom properties (CSS variables) and theming', 'dark mode with prefers-color-scheme', 'container queries', ':has() and nesting'],
        },
        {
          title: 'Organising CSS',
          topics: ['naming (BEM) and reusable classes', 'a CSS reset', 'Sass in short', 'Tailwind CSS: utility-first basics'],
        },
        {
          title: 'Shipping a site',
          topics: ['performance: image sizes, fonts', 'accessibility check (Lighthouse)', 'deploying for free on GitHub Pages / Netlify / Vercel (check current limits)'],
        },
      ],
      project: 'final project: your portfolio site — responsive, accessible, dark mode, deployed with a live link',
    },
  ],
};
