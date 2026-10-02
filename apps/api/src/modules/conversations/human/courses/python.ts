import type { Curriculum } from './types.js';

/** Python from zero to advanced. Checked against the official Python tutorial and library docs (Oct 2026). */
export const python: Curriculum = {
  id: 'python',
  name: 'Python',
  match: /\b(python|py)\b/i,
  codeLang: 'python',
  docs: 'docs.python.org/3/tutorial',
  levels: [
    {
      title: 'Start',
      lessons: [
        {
          title: 'What Python is',
          topics: [
            'what a programming language is and what Python is used for (automation, web, data, AI)',
            'interpreted language: what the interpreter does',
            'Python 3 vs the old Python 2',
            'how a program runs top to bottom',
          ],
        },
        {
          title: 'Setup and your first program',
          topics: [
            'installing Python from python.org (tick "Add to PATH" on Windows), checking python --version',
            'VS Code and the Python extension',
            'the interactive shell (REPL) vs a .py file',
            'print() with several values, sep and end',
            'comments with #',
            'indentation matters, and reading your first error',
          ],
        },
      ],
      project: 'a program that prints a small ASCII banner with your name and 3 goals',
    },
    {
      title: 'Basics',
      lessons: [
        {
          title: 'Variables and types',
          topics: [
            'variables and assignment (names point to values)',
            'naming rules, snake_case, constants in CAPS',
            'int, float, str, bool, None',
            'type() and isinstance()',
            'multiple assignment and swapping a, b = b, a',
          ],
        },
        {
          title: 'Input and type conversion',
          topics: [
            'input() always returns a string',
            'int(), float(), str(), bool() conversion',
            'what happens with bad input (ValueError)',
          ],
        },
        {
          title: 'Operators',
          topics: [
            'arithmetic: + - * / // % ** and precedence',
            'assignment shortcuts += -= *=',
            'comparison and chained comparisons (1 < x < 10)',
            'logical and, or, not and truthiness',
            'identity (is) vs equality (==), membership (in)',
          ],
        },
        {
          title: 'Strings',
          topics: [
            'quotes, triple quotes and escape characters',
            'indexing, negative indexing and slicing [start:stop:step]',
            'f-strings and format specs ({x:.2f})',
            'methods: upper, lower, strip, split, join, replace, find, startswith, count',
            'strings are immutable, len()',
          ],
        },
        {
          title: 'Conditions',
          topics: ['if, elif, else', 'nested conditions', 'conditional expression (a if c else b)', 'match / case (Python 3.10+)'],
        },
        {
          title: 'Loops',
          topics: [
            'while loops',
            'for loops and range()',
            'break, continue and the loop else clause',
            'enumerate() and zip()',
            'nested loops and avoiding infinite loops',
          ],
        },
      ],
      project: 'a number-guessing game and a simple calculator menu that keeps running until the user quits',
    },
    {
      title: 'Data structures',
      lessons: [
        {
          title: 'Lists',
          topics: [
            'creating, indexing and slicing lists',
            'append, insert, extend, remove, pop, clear',
            'sort vs sorted, reverse, key functions',
            'in, len, min, max, sum',
            'copying lists (shallow vs deep) and the aliasing trap',
          ],
        },
        {
          title: 'Tuples and sets',
          topics: [
            'tuples: immutable sequences, packing and unpacking',
            'sets: unique items, add, discard',
            'set operations: union, intersection, difference',
            'when to use list vs tuple vs set',
          ],
        },
        {
          title: 'Dictionaries',
          topics: [
            'keys and values, creating and accessing',
            'get() with a default, adding, updating, deleting',
            'looping with keys(), values(), items()',
            'nested dictionaries and lists of dictionaries',
            'counting with a dict (and collections.Counter)',
          ],
        },
        {
          title: 'Comprehensions',
          topics: ['list comprehensions', 'with conditions', 'dict and set comprehensions', 'when a normal loop is clearer'],
        },
      ],
      project: 'a contact book or expense tracker using lists of dictionaries (add, search, delete, totals)',
    },
    {
      title: 'Functions',
      lessons: [
        {
          title: 'Functions',
          topics: [
            'def, calling, parameters vs arguments',
            'return (and None when nothing is returned)',
            'default, keyword and positional arguments',
            '*args and **kwargs',
            'docstrings',
          ],
        },
        {
          title: 'Scope',
          topics: ['local vs global (LEGB rule)', 'global and nonlocal keywords', 'why mutable default arguments are a bug'],
        },
        {
          title: 'Functional tools',
          topics: [
            'functions as values, passing functions',
            'lambda',
            'map, filter, sorted with key, any, all',
            'recursion with a base case',
          ],
        },
        {
          title: 'Type hints',
          topics: ['annotating parameters and return types', 'list[int], dict[str, int], Optional / X | None', 'hints are not checked at runtime (mypy)'],
        },
      ],
      project: 'refactor your expense tracker into clean functions with type hints and docstrings',
    },
    {
      title: 'Files, errors and modules',
      lessons: [
        {
          title: 'Errors and exceptions',
          topics: [
            'reading a traceback (bottom line first)',
            'common errors: NameError, TypeError, ValueError, IndexError, KeyError',
            'try, except, else, finally',
            'raising exceptions and custom exception classes',
          ],
        },
        {
          title: 'Files',
          topics: [
            'open() modes and with (context manager)',
            'reading and writing text files',
            'pathlib for paths',
            'CSV with the csv module',
            'JSON with the json module',
          ],
        },
        {
          title: 'Modules and packages',
          topics: [
            'import, from … import, as',
            'the standard library tour: math, random, datetime, os, sys',
            'your own module and if __name__ == "__main__"',
            'packages and __init__.py',
          ],
        },
        {
          title: 'pip and virtual environments',
          topics: [
            'python -m venv .venv and activating it (Windows vs Mac/Linux)',
            'pip install, pip freeze, requirements.txt',
            'why every project gets its own venv',
          ],
        },
      ],
      project: 'a to-do or notes app on the command line that saves to a JSON file and handles bad input',
    },
    {
      title: 'Object-oriented Python',
      lessons: [
        {
          title: 'Classes and objects',
          topics: ['class, __init__ and self', 'instance attributes and methods', 'class attributes', '__str__ and __repr__'],
        },
        {
          title: 'Inheritance',
          topics: ['inheritance and super()', 'method overriding', 'composition vs inheritance', 'abstract base classes (abc)'],
        },
        {
          title: 'More OOP',
          topics: [
            '@property, @staticmethod, @classmethod',
            'dunder methods: __len__, __eq__, __lt__, __add__',
            'dataclasses',
            'encapsulation conventions (_name, __name)',
          ],
        },
      ],
      project: 'a bank account or library system with classes, inheritance and data saved to a file',
    },
    {
      title: 'Advanced Python',
      lessons: [
        {
          title: 'Iterators and generators',
          topics: ['iter() and next()', 'generator functions and yield', 'generator expressions', 'itertools basics'],
        },
        {
          title: 'Decorators and context managers',
          topics: ['functions inside functions and closures', 'writing a decorator (timing, logging)', 'functools.wraps', 'your own context manager (class or contextlib)'],
        },
        {
          title: 'The standard library, deeper',
          topics: ['collections: Counter, defaultdict, deque, namedtuple', 'datetime and time zones', 're (regular expressions)', 'logging instead of print'],
        },
        {
          title: 'Concurrency',
          topics: ['threads vs processes and the GIL (simply)', 'threading and concurrent.futures', 'asyncio, async and await', 'when to use which'],
        },
        {
          title: 'Testing and code quality',
          topics: ['assert and pytest basics', 'testing with fixtures', 'PEP 8, formatting (black/ruff)', 'debugging with breakpoint() / pdb'],
        },
      ],
      project: 'a CLI tool (e.g. a file organiser) with logging, tests and a requirements.txt',
    },
    {
      title: 'Real-world Python',
      lessons: [
        {
          title: 'Working with the web',
          topics: ['HTTP and APIs in short', 'requests: GET, POST, JSON, status codes', 'API keys from environment variables', 'basic web scraping and its rules (robots.txt, terms)'],
        },
        {
          title: 'Databases',
          topics: ['sqlite3: create, insert, select', 'parameterised queries (never string-built SQL)', 'an ORM in short (SQLAlchemy)'],
        },
        {
          title: 'Building web apps',
          topics: ['Flask or FastAPI: routes and JSON responses', 'request data and validation', 'running locally and deploying (check current host limits)'],
        },
        {
          title: 'Data basics',
          topics: ['NumPy arrays (overview)', 'pandas: reading CSV, filtering, grouping', 'a simple chart with matplotlib'],
        },
        {
          title: 'Packaging and next steps',
          topics: ['project structure and README', 'pyproject.toml basics', 'where to go next: web, data, AI, automation'],
        },
      ],
      project: 'final project: a FastAPI/Flask app with a database or a data report from a real CSV — on GitHub with a README',
    },
  ],
};
