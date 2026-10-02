import type { Curriculum } from './types.js';

/** TypeScript from zero to advanced. Checked against the TypeScript Handbook (Oct 2026). */
export const typescript: Curriculum = {
  id: 'typescript',
  name: 'TypeScript',
  match: /\b(type ?script|ts)\b/i,
  codeLang: 'typescript',
  docs: 'www.typescriptlang.org/docs/handbook',
  before: 'JavaScript basics up to functions, arrays and objects (the JavaScript course levels 1–3)',
  levels: [
    {
      title: 'Start',
      lessons: [
        {
          title: 'What TypeScript is',
          topics: [
            'TypeScript = JavaScript + types, compiled to JavaScript',
            'what errors types catch before running',
            'types disappear at runtime',
          ],
        },
        {
          title: 'Setup',
          topics: [
            'npm install -D typescript, npx tsc --init',
            'tsconfig.json: target, module, strict',
            'compiling with tsc and running with node, or tsx',
            'reading a type error in VS Code',
          ],
        },
      ],
      project: 'convert a small JavaScript file to TypeScript and fix every error with strict on',
    },
    {
      title: 'Basic types',
      lessons: [
        {
          title: 'Primitive types and inference',
          topics: ['string, number, boolean, null, undefined', 'type annotations vs inference', 'any (and why to avoid it) vs unknown', 'never and void'],
        },
        {
          title: 'Arrays, tuples and objects',
          topics: ['number[] and Array<number>', 'tuples and readonly', 'object types, optional (?) and readonly properties', 'index signatures and Record'],
        },
        {
          title: 'Functions',
          topics: ['parameter and return types', 'optional and default parameters', 'function types and callbacks', 'overloads'],
        },
        {
          title: 'Type aliases and interfaces',
          topics: ['type vs interface', 'extending interfaces and intersections (&)', 'declaration merging', 'when to use which'],
        },
        {
          title: 'Unions and literals',
          topics: ['union types (string | number)', 'literal types ("small" | "large")', 'enums vs union literals', 'as const'],
        },
      ],
      project: 'a typed shopping cart: products, cart items and totals with interfaces and unions',
    },
    {
      title: 'Working with types',
      lessons: [
        {
          title: 'Narrowing',
          topics: ['typeof and truthiness narrowing', 'in and instanceof', 'discriminated unions', 'exhaustive checks with never', 'custom type guards (x is T)'],
        },
        {
          title: 'Classes',
          topics: ['typed fields and constructors', 'public, private, protected, readonly', 'parameter properties', 'implements and abstract classes'],
        },
        {
          title: 'Generics',
          topics: ['generic functions <T>', 'generic interfaces and classes', 'constraints (T extends …)', 'default type parameters'],
        },
        {
          title: 'Modules and declarations',
          topics: ['import/export with types (import type)', '.d.ts files and @types packages', 'typing a library without types'],
        },
      ],
      project: 'a typed API client with generics that fetches and validates JSON',
    },
    {
      title: 'Advanced types',
      lessons: [
        {
          title: 'Type operators',
          topics: ['keyof and typeof (types from values)', 'indexed access types (T["key"])', 'satisfies'],
        },
        {
          title: 'Utility types',
          topics: ['Partial, Required, Readonly', 'Pick, Omit, Record', 'ReturnType, Parameters, Awaited, NonNullable'],
        },
        {
          title: 'Conditional and mapped types',
          topics: ['conditional types and infer', 'mapped types and key remapping', 'template literal types'],
        },
        {
          title: 'TypeScript in real projects',
          topics: [
            'runtime validation (zod) since types vanish at runtime',
            'strict options that matter (noUncheckedIndexedAccess)',
            'TypeScript with Node/Express and with React (props, state, events)',
            'reading complex library types',
          ],
        },
      ],
      project: 'final project: a Node/Express API or React app fully in strict TypeScript with zod validation',
    },
  ],
};
