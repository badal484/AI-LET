import type { Curriculum } from './types.js';

/** React from zero to advanced. Checked against react.dev (Learn + Reference, Oct 2026). */
export const react: Curriculum = {
  id: 'react',
  name: 'React',
  match: /\b(react(\.?js)?|next\.?js|jsx)\b/i,
  codeLang: 'jsx',
  docs: 'react.dev/learn',
  before: 'JavaScript through Level 4 (functions, arrays, objects, destructuring, modules, async/await) and basic HTML/CSS',
  levels: [
    {
      title: 'Start',
      lessons: [
        {
          title: 'What React is',
          topics: ['why React: building UIs from components', 'declarative UI vs changing the DOM by hand', 'single-page apps, and where frameworks (Next.js) fit'],
        },
        {
          title: 'Setup',
          topics: ['creating a project with Vite (npm create vite@latest)', 'the project files: index.html, main.jsx, App.jsx', 'npm run dev and the browser dev tools / React DevTools'],
        },
      ],
      project: 'a Vite React app that shows your name and a list of your skills',
    },
    {
      title: 'Core React',
      lessons: [
        {
          title: 'Components and JSX',
          topics: ['function components', 'JSX rules: one parent, className, closing tags, {} for JS', 'importing and exporting components', 'fragments'],
        },
        {
          title: 'Props',
          topics: ['passing and reading props (with destructuring)', 'default values', 'children', 'props are read-only'],
        },
        {
          title: 'Rendering lists and conditions',
          topics: ['map() to render lists', 'keys: why and which', 'conditional rendering: &&, ternary, early return'],
        },
        {
          title: 'Events',
          topics: ['onClick and other handlers', 'passing handlers as props', 'event object and preventDefault'],
        },
        {
          title: 'State',
          topics: ['useState', 'state is a snapshot; updates re-render', 'updater functions (setCount(c => c + 1))', 'updating objects and arrays without mutating'],
        },
        {
          title: 'Forms',
          topics: ['controlled inputs', 'several inputs in one state object', 'checkboxes, selects, textarea', 'submitting and simple validation'],
        },
        {
          title: 'Sharing state',
          topics: ['lifting state up', 'one source of truth', 'thinking in React: splitting a UI into components'],
        },
        {
          title: 'Styling',
          topics: ['CSS files and className', 'inline styles', 'CSS modules', 'Tailwind with React'],
        },
      ],
      project: 'a todo app with add, toggle, delete, filter and an edit form',
    },
    {
      title: 'Effects and data',
      lessons: [
        {
          title: 'useEffect',
          topics: ['what an effect is (syncing with something outside React)', 'the dependency array', 'cleanup functions', 'when you do not need an effect'],
        },
        {
          title: 'Fetching data',
          topics: ['fetch in an effect with loading and error states', 'avoiding race conditions (ignore flag / AbortController)', 'data libraries (TanStack Query) in short'],
        },
        {
          title: 'Refs',
          topics: ['useRef for DOM elements (focus an input)', 'useRef for values that do not re-render', 'forwarding refs / ref as a prop'],
        },
        {
          title: 'Routing',
          topics: ['React Router: routes, Link, useParams', 'nested routes and layouts', 'not-found pages and navigation'],
        },
      ],
      project: 'a movie or recipe browser: search page, details page with a route param, data from a public API',
    },
    {
      title: 'Advanced React',
      lessons: [
        {
          title: 'Context and reducers',
          topics: ['prop drilling and useContext', 'useReducer', 'context + reducer for app state', 'when to reach for a state library (Zustand, Redux Toolkit)'],
        },
        {
          title: 'Custom hooks',
          topics: ['rules of hooks', 'writing a custom hook (useFetch, useLocalStorage)', 'sharing logic, not state'],
        },
        {
          title: 'Performance',
          topics: ['why components re-render', 'memo, useMemo, useCallback (and when not to)', 'lazy loading and Suspense', 'React DevTools profiler'],
        },
        {
          title: 'Quality',
          topics: ['error boundaries', 'accessibility in React', 'testing with React Testing Library', 'React with TypeScript (typing props and state)'],
        },
        {
          title: 'Modern React',
          topics: ['Next.js: pages, routing, server vs client components', 'server actions and data fetching (overview)', 'deploying a React/Next app (check current host limits)'],
        },
      ],
      project: 'final project: a full app (e.g. expense tracker or notes) with routing, context, a custom hook, tests, deployed',
    },
  ],
};
