import type { Curriculum } from './types.js';

/** JavaScript from zero to advanced. Checked against MDN's JavaScript Guide and Reference (Oct 2026). */
export const javascript: Curriculum = {
  id: 'javascript',
  name: 'JavaScript',
  match: /\b(java ?script|js|ecmascript|es6)\b/i,
  codeLang: 'javascript',
  docs: 'developer.mozilla.org/en-US/docs/Web/JavaScript',
  levels: [
    {
      title: 'Start',
      lessons: [
        {
          title: 'What JavaScript is',
          topics: [
            'what a programming language is and what JavaScript is used for (websites, servers, apps)',
            'where JavaScript runs: the browser and Node.js',
            'JavaScript vs Java (different languages) and what ECMAScript / ES6+ means',
            'how a program runs: top to bottom, one statement at a time',
          ],
        },
        {
          title: 'Setup and your first program',
          topics: [
            'running JS in the browser console (F12 → Console)',
            'installing Node.js LTS and VS Code, checking with node -v',
            'creating app.js and running it with node app.js',
            'console.log and printing several values',
            'comments: // and /* */',
            'statements, semicolons and reading an error message',
          ],
        },
      ],
      project: 'a "self intro" program that prints your name, city and 3 goals on separate lines',
    },
    {
      title: 'Basics',
      lessons: [
        {
          title: 'Variables',
          topics: [
            'what a variable is (a labelled box for a value)',
            'let: declaring, assigning and reassigning',
            'const: values that are not reassigned (use it by default)',
            'var and why modern code avoids it',
            'naming rules and camelCase, reserved words',
          ],
        },
        {
          title: 'Data types',
          topics: [
            'string, number and boolean',
            'undefined vs null',
            'bigint and symbol (what they are, when they appear)',
            'typeof and its surprises (typeof null)',
            'primitives vs objects (overview)',
          ],
        },
        {
          title: 'Operators',
          topics: [
            'arithmetic: + - * / % ** and operator precedence',
            'assignment shortcuts: += -= ++ --',
            'comparison: == vs ===, != vs !==, < > <= >=',
            'logical: && || ! and short-circuiting',
            'nullish coalescing ?? and optional chaining ?.',
            'the ternary operator condition ? a : b',
          ],
        },
        {
          title: 'Type conversion',
          topics: [
            'converting with Number(), String(), Boolean(), parseInt, parseFloat',
            'implicit coercion ("5" + 1 vs "5" - 1)',
            'truthy and falsy values',
            'NaN and Number.isNaN',
          ],
        },
        {
          title: 'Strings',
          topics: [
            'quotes, template literals and ${} interpolation',
            'escape characters (\\n, \\", \\\\)',
            'length, indexing and at()',
            'common methods: toUpperCase, toLowerCase, trim, includes, startsWith, endsWith, indexOf',
            'slice, substring, replace, replaceAll, split, repeat, padStart',
            'strings are immutable',
          ],
        },
        {
          title: 'Numbers and Math',
          topics: [
            'integers, decimals and the 0.1 + 0.2 problem',
            'toFixed, Number.isInteger, Infinity',
            'Math.round, floor, ceil, trunc, abs, max, min, pow, sqrt',
            'random numbers with Math.random (a dice roll)',
          ],
        },
        {
          title: 'Conditions',
          topics: [
            'if, else if, else',
            'combining conditions with && and ||',
            'nested conditions and guard clauses (early return)',
            'switch with break and default',
          ],
        },
        {
          title: 'Loops',
          topics: [
            'for loop (start, condition, step)',
            'while and do...while',
            'break and continue',
            'for...of over strings and arrays',
            'for...in over object keys',
            'nested loops and avoiding infinite loops',
          ],
        },
      ],
      project: 'a number-guessing game (Math.random + loop + conditions) and a grade calculator',
    },
    {
      title: 'Core',
      lessons: [
        {
          title: 'Functions',
          topics: [
            'why functions: reuse and naming a piece of work',
            'function declarations, calling, parameters vs arguments',
            'return values (and undefined when nothing is returned)',
            'function expressions',
            'arrow functions and implicit return',
            'default parameters and rest parameters (...args)',
          ],
        },
        {
          title: 'Scope and hoisting',
          topics: [
            'global, function and block scope',
            'shadowing',
            'hoisting of var and function declarations',
            'the temporal dead zone for let and const',
          ],
        },
        {
          title: 'Arrays',
          topics: [
            'creating arrays, index, length, at()',
            'push, pop, shift, unshift, splice, slice, concat',
            'includes, indexOf, find, findIndex, findLast',
            'looping: for, for...of, forEach',
            'map, filter, reduce',
            'some, every, sort (with a compare function), reverse, join, flat',
            'spread [...arr], Array.from, Array.isArray',
            'non-mutating versions: toSorted, toReversed, with',
          ],
        },
        {
          title: 'Objects',
          topics: [
            'object literals, keys and values, dot vs bracket access',
            'adding, changing and deleting properties, the in operator',
            'methods and a first look at this',
            'shorthand properties and computed keys',
            'Object.keys, values, entries, fromEntries, assign',
            'nested objects and arrays of objects',
          ],
        },
        {
          title: 'Destructuring and spread',
          topics: [
            'array destructuring (with skipping and defaults)',
            'object destructuring (renaming, defaults, nested)',
            'destructuring in function parameters',
            'spread for objects ({...obj}) and rest in destructuring',
          ],
        },
        {
          title: 'Values vs references',
          topics: [
            'primitives are copied, objects are shared by reference',
            'comparing objects (=== checks the reference)',
            'shallow copy with spread, deep copy with structuredClone',
            'Object.freeze and const with objects',
          ],
        },
        {
          title: 'JSON and Dates',
          topics: [
            'what JSON is, JSON.stringify and JSON.parse',
            'pretty printing and what JSON cannot hold',
            'Date: creating, getting parts, formatting with toLocaleDateString',
            'timestamps and date maths (difference in days)',
          ],
        },
        {
          title: 'Errors and debugging',
          topics: [
            'reading an error: type, message and stack (bottom to top)',
            'common errors: ReferenceError, TypeError, SyntaxError, RangeError',
            'try, catch, finally',
            'throw and new Error with a clear message',
            'debugging with console.log, console.table and the DevTools debugger / breakpoints',
          ],
        },
      ],
      project: 'a student marks manager: an array of objects with add, list, average and topper using map/filter/reduce',
    },
    {
      title: 'Intermediate',
      lessons: [
        {
          title: 'Higher-order functions and callbacks',
          topics: [
            'functions as values (stored, passed, returned)',
            'callbacks',
            'writing your own map/filter to see how they work',
            'function composition and chaining',
          ],
        },
        {
          title: 'Closures',
          topics: [
            'lexical scope',
            'what a closure is (a function remembering its variables)',
            'practical closures: counters, private data, function factories',
            'the classic loop + closure bug and why let fixes it',
          ],
        },
        {
          title: 'this, call, apply, bind',
          topics: [
            'this in a method, in a plain function and in strict mode',
            'arrow functions and this',
            'losing this when passing a method as a callback',
            'call, apply and bind',
          ],
        },
        {
          title: 'Prototypes',
          topics: [
            'the prototype chain and how property lookup works',
            'Object.create and Object.getPrototypeOf',
            'constructor functions and new',
            'own properties vs inherited (Object.hasOwn)',
          ],
        },
        {
          title: 'Classes',
          topics: [
            'class, constructor and methods',
            'getters and setters',
            'static methods and properties',
            'private fields and methods (#)',
            'extends and super',
            'instanceof and when classes help vs plain objects',
          ],
        },
        {
          title: 'Modules',
          topics: [
            'why modules: one file, one job',
            'export (named and default) and import',
            'ES modules vs CommonJS (require/module.exports)',
            '"type": "module" in package.json and modules in the browser',
            'dynamic import()',
          ],
        },
        {
          title: 'Map, Set, WeakMap, WeakSet',
          topics: [
            'Set: unique values, add/has/delete, removing duplicates',
            'Map: any key type, get/set/has, iterating',
            'Map vs object, Set vs array',
            'WeakMap and WeakSet (what weak means)',
          ],
        },
        {
          title: 'Iterators and generators',
          topics: [
            'the iteration protocol (Symbol.iterator, next)',
            'making your own object iterable',
            'generator functions, yield and lazy sequences',
          ],
        },
        {
          title: 'Regular expressions',
          topics: [
            'what a regex is, literal /…/ and flags (g, i, m)',
            'character classes, quantifiers, anchors',
            'groups and named groups',
            'test, match, matchAll, replace with regex',
            'practical: validating an email or phone number (and its limits)',
          ],
        },
      ],
      project: 'a library system with classes (Book, Member, Library), split into modules, using Map for lookups',
    },
    {
      title: 'Asynchronous JavaScript',
      lessons: [
        {
          title: 'Sync vs async',
          topics: [
            'what blocking means and why JS needs async',
            'setTimeout, setInterval, clearTimeout, clearInterval',
            'callbacks for async work and callback hell',
          ],
        },
        {
          title: 'Promises',
          topics: [
            'what a promise is: pending, fulfilled, rejected',
            'then, catch, finally and chaining',
            'creating a promise with new Promise',
            'Promise.all, allSettled, race, any',
          ],
        },
        {
          title: 'async / await',
          topics: [
            'async functions always return a promise',
            'await and writing async code top to bottom',
            'try/catch with await',
            'running in sequence vs in parallel (await in a loop vs Promise.all)',
          ],
        },
        {
          title: 'The event loop',
          topics: [
            'call stack, Web APIs, task queue',
            'microtasks (promises) vs macrotasks (timers)',
            'predicting the output order of a tricky snippet',
          ],
        },
        {
          title: 'fetch and APIs',
          topics: [
            'what an API is, HTTP methods and status codes',
            'fetch GET and reading JSON',
            'POST with headers and a JSON body',
            'checking response.ok and handling network errors',
            'loading and error states, AbortController for cancelling',
            'CORS errors: what they mean',
          ],
        },
      ],
      project: 'a weather or movie search app that calls a free public API with async/await and handles errors',
    },
    {
      title: 'JavaScript in the browser',
      lessons: [
        {
          title: 'The DOM',
          topics: [
            'linking a script to HTML (script tag, defer)',
            'what the DOM tree is',
            'selecting: getElementById, querySelector, querySelectorAll',
            'changing text, HTML (and why innerHTML with user input is dangerous), attributes and styles',
            'classList: add, remove, toggle',
            'creating, inserting and removing elements',
          ],
        },
        {
          title: 'Events',
          topics: [
            'addEventListener and the event object',
            'click, input, change, submit, keydown',
            'preventDefault and form handling',
            'bubbling, capturing and stopPropagation',
            'event delegation',
          ],
        },
        {
          title: 'Browser storage and APIs',
          topics: [
            'localStorage and sessionStorage (with JSON)',
            'cookies (what they are, basics)',
            'timers in the UI, the Clipboard API, geolocation',
            'what never to store in the browser (secrets, tokens carelessly)',
          ],
        },
      ],
      project: 'a todo app in the browser: add, complete, delete, filter, saved in localStorage',
    },
    {
      title: 'Advanced',
      lessons: [
        {
          title: 'Functional programming',
          topics: [
            'pure functions and side effects',
            'immutability in practice',
            'currying and partial application',
            'compose and pipe',
          ],
        },
        {
          title: 'Performance patterns',
          topics: [
            'debounce (search box) and throttle (scroll)',
            'memoization',
            'measuring with console.time and performance.now',
          ],
        },
        {
          title: 'Memory',
          topics: [
            'how garbage collection works (reachability)',
            'common leaks: forgotten timers, listeners, global variables',
            'spotting a leak in DevTools (overview)',
          ],
        },
        {
          title: 'Metaprogramming',
          topics: [
            'Symbol and well-known symbols',
            'getters/setters with Object.defineProperty',
            'Proxy and Reflect (a validation example)',
          ],
        },
        {
          title: 'Design patterns',
          topics: ['module pattern', 'factory', 'singleton', 'observer / pub-sub', 'when a pattern is overkill'],
        },
        {
          title: 'Security basics',
          topics: [
            'XSS and why textContent beats innerHTML for user input',
            'never use eval or new Function with user input',
            'never put API keys or secrets in front-end code',
            'validating input on the server, not only in the browser',
          ],
        },
        {
          title: 'Testing',
          topics: [
            'why tests, and unit vs integration',
            'setting up Vitest or Jest',
            'writing test cases with expect',
            'testing async code',
          ],
        },
        {
          title: 'Tooling',
          topics: [
            'npm, package.json, dependencies vs devDependencies, scripts',
            'ESLint and Prettier',
            'bundlers (Vite) — what they do',
            'Git basics for every project (init, add, commit, push)',
          ],
        },
        {
          title: 'Modern JavaScript',
          topics: [
            'ES2015 → today: what each big version added (overview)',
            'optional chaining, nullish coalescing, logical assignment (&&= ||= ??=)',
            'numeric separators, Object.groupBy, structuredClone, Array findLast/toSorted',
            'top-level await',
            'how to check browser support (MDN compatibility tables)',
          ],
        },
      ],
      project: 'add tests and a debounced live search to your todo or weather app, and clean it up with ESLint',
    },
    {
      title: 'Node.js and real projects',
      lessons: [
        {
          title: 'Node.js basics',
          topics: [
            'what Node is and how it differs from the browser (no DOM, has fs/process)',
            'fs and path: reading and writing files',
            'process.argv and environment variables (process.env, --env-file)',
            'npm packages and npx',
          ],
        },
        {
          title: 'Building an API',
          topics: [
            'the http module (a tiny server)',
            'Express: routes, req and res, JSON',
            'route params, query strings and request bodies',
            'middleware and error handling',
            'a REST API for a resource (GET, POST, PUT, DELETE)',
          ],
        },
        {
          title: 'Shipping it',
          topics: [
            'a good README and project structure',
            'deploying a Node app (a free host — check current limits)',
            'what to learn next: TypeScript, React, databases',
          ],
        },
      ],
      project: 'final project: a full app of your own idea — front end + Node/Express API — deployed, with a README, on GitHub',
    },
  ],
};
