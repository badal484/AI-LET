import type { Curriculum } from './types.js';

/** Node.js and backend from zero to advanced. Checked against nodejs.org docs and expressjs.com (Oct 2026). */
export const nodejs: Curriculum = {
  id: 'nodejs',
  name: 'Node.js & backend',
  match: /\b(node(\.?js)?|express(\.?js)?|backend|back-end|rest ?apis?)\b/i,
  codeLang: 'javascript',
  docs: 'nodejs.org/en/learn',
  before: 'JavaScript through Level 4 (functions, objects, modules, async/await)',
  levels: [
    {
      title: 'Start',
      lessons: [
        {
          title: 'What Node.js is',
          topics: ['JavaScript outside the browser: V8 + libuv', 'what a backend / server does', 'Node vs browser: no DOM, has fs, process, modules'],
        },
        {
          title: 'Setup',
          topics: ['installing Node LTS, node -v, npm -v', 'npm init -y, package.json and scripts', 'ES modules ("type": "module") vs CommonJS', 'node --watch for development'],
        },
      ],
      project: 'a script that reads a text file and prints the number of words and lines',
    },
    {
      title: 'Core Node',
      lessons: [
        {
          title: 'Built-in modules',
          topics: ['fs (promises API): read, write, append, readdir', 'path: join, resolve, extname', 'os and process (argv, env, exit codes)', 'events and EventEmitter'],
        },
        {
          title: 'Async in Node',
          topics: ['the event loop in Node', 'callbacks → promises → async/await in Node APIs', 'streams and pipes (big files)', 'Buffer basics'],
        },
        {
          title: 'npm',
          topics: ['installing packages, dependencies vs devDependencies', 'semver (^ and ~) and package-lock.json', 'npx and global installs', 'checking packages are safe (npm audit, popularity)'],
        },
        {
          title: 'Environment and config',
          topics: ['environment variables and .env (node --env-file)', '.gitignore for secrets', 'different config for dev and production'],
        },
      ],
      project: 'a CLI notes app: add/list/delete notes saved in a JSON file, commands from process.argv',
    },
    {
      title: 'HTTP and Express',
      lessons: [
        {
          title: 'HTTP',
          topics: ['requests and responses, methods, headers, status codes', 'a raw server with the http module', 'JSON over HTTP', 'testing with curl / Postman / Thunder Client'],
        },
        {
          title: 'Express basics',
          topics: ['app, routes, req, res', 'route params and query strings', 'express.json() and request bodies', 'sending status codes properly'],
        },
        {
          title: 'Middleware',
          topics: ['what middleware is, next()', 'logging, CORS, static files', 'error-handling middleware', 'routers to split routes into files'],
        },
        {
          title: 'REST API design',
          topics: ['resources and URLs', 'CRUD with GET, POST, PUT/PATCH, DELETE', 'validation (zod / express-validator)', 'pagination, filtering and consistent error responses'],
        },
      ],
      project: 'a REST API for books or tasks (CRUD) with validation and proper status codes, in memory',
    },
    {
      title: 'Databases and auth',
      lessons: [
        {
          title: 'Databases from Node',
          topics: ['SQL vs NoSQL in short', 'PostgreSQL with pg or an ORM (Prisma)', 'MongoDB with Mongoose (overview)', 'migrations and seeding'],
        },
        {
          title: 'Authentication',
          topics: ['hashing passwords with bcrypt (never store plain passwords)', 'sessions vs JWT', 'protecting routes with middleware', 'refresh tokens and logout (overview)'],
        },
        {
          title: 'Security',
          topics: ['input validation and SQL/NoSQL injection', 'helmet, rate limiting, CORS settings', 'secrets management', 'OWASP Top 10 in short'],
        },
        {
          title: 'Files and real-time',
          topics: ['file uploads (multer) and storage', 'WebSockets / Socket.IO basics', 'sending email (overview)'],
        },
      ],
      project: 'your REST API, now with a database, signup/login, protected routes and rate limiting',
    },
    {
      title: 'Production backend',
      lessons: [
        {
          title: 'Testing',
          topics: ['unit tests (Vitest/Jest)', 'API tests with supertest', 'test databases'],
        },
        {
          title: 'Structure and TypeScript',
          topics: ['layers: routes, controllers/services, data access', 'error and logging strategy', 'Node with TypeScript'],
        },
        {
          title: 'Performance and scale',
          topics: ['caching (in memory, Redis)', 'background jobs and queues', 'clustering / worker threads (overview)', 'idempotent retries'],
        },
        {
          title: 'Deployment',
          topics: ['environment config for production', 'deploying to a host (check current free limits)', 'Docker basics', 'logs, health checks and monitoring'],
        },
      ],
      project: 'final project: a deployed, tested backend for an app idea, with auth, a database and a README with API docs',
    },
  ],
};
