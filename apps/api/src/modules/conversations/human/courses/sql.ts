import type { Curriculum } from './types.js';

/** SQL from zero to advanced (PostgreSQL flavour, notes for MySQL/SQLite). Checked against the PostgreSQL docs (Oct 2026). */
export const sql: Curriculum = {
  id: 'sql',
  name: 'SQL',
  match: /\b(sql|mysql|postgres(ql)?|sqlite|database|databases|dbms)\b/i,
  codeLang: 'sql',
  docs: 'www.postgresql.org/docs/current/tutorial.html',
  levels: [
    {
      title: 'Start',
      lessons: [
        {
          title: 'What databases and SQL are',
          topics: [
            'what a database is and why not just Excel',
            'tables, rows, columns',
            'relational databases and SQL dialects (PostgreSQL, MySQL, SQLite)',
          ],
        },
        {
          title: 'Setup',
          topics: ['an easy start: SQLite or an online SQL playground', 'installing PostgreSQL or using a free hosted one', 'running your first query'],
        },
      ],
      project: 'create a database and run SELECT 1 and a query on a sample table',
    },
    {
      title: 'Basics',
      lessons: [
        {
          title: 'Creating tables',
          topics: ['CREATE TABLE and data types (INTEGER, TEXT/VARCHAR, NUMERIC, BOOLEAN, DATE, TIMESTAMP)', 'PRIMARY KEY', 'NOT NULL, UNIQUE, DEFAULT, CHECK', 'DROP TABLE and ALTER TABLE'],
        },
        {
          title: 'Changing data',
          topics: ['INSERT (one and many rows)', 'UPDATE with WHERE (and the danger of forgetting it)', 'DELETE', 'RETURNING (PostgreSQL)'],
        },
        {
          title: 'SELECT',
          topics: ['SELECT columns and *', 'WHERE with = <> < > AND OR NOT', 'IN, BETWEEN, LIKE / ILIKE', 'IS NULL and NULL rules', 'ORDER BY, LIMIT, OFFSET', 'DISTINCT and column aliases'],
        },
        {
          title: 'Functions',
          topics: ['string functions (UPPER, LOWER, LENGTH, CONCAT, SUBSTRING)', 'number functions (ROUND, ABS)', 'date functions (NOW, date parts, intervals)', 'CASE WHEN and COALESCE'],
        },
      ],
      project: 'a students table: create it, insert 20 rows, and answer 10 questions with SELECT',
    },
    {
      title: 'Grouping and joining',
      lessons: [
        {
          title: 'Aggregates',
          topics: ['COUNT, SUM, AVG, MIN, MAX', 'GROUP BY', 'HAVING vs WHERE', 'the logical order a query runs in'],
        },
        {
          title: 'Relationships',
          topics: ['one-to-many and many-to-many', 'FOREIGN KEY and ON DELETE', 'junction tables'],
        },
        {
          title: 'Joins',
          topics: ['INNER JOIN', 'LEFT and RIGHT JOIN', 'FULL OUTER JOIN', 'self join and CROSS JOIN', 'joining three tables'],
        },
        {
          title: 'Subqueries and set operations',
          topics: ['subqueries in WHERE and FROM', 'EXISTS and IN', 'correlated subqueries', 'UNION, UNION ALL, INTERSECT, EXCEPT'],
        },
      ],
      project: 'an online-store database (customers, products, orders, order_items) with 15 business questions answered',
    },
    {
      title: 'Advanced SQL',
      lessons: [
        {
          title: 'CTEs and window functions',
          topics: ['WITH (common table expressions)', 'recursive CTEs', 'ROW_NUMBER, RANK, DENSE_RANK', 'PARTITION BY, running totals, LAG/LEAD'],
        },
        {
          title: 'Design',
          topics: ['normalisation (1NF, 2NF, 3NF) simply', 'when to denormalise', 'naming and choosing keys (serial / identity / UUID)'],
        },
        {
          title: 'Performance',
          topics: ['indexes: what they are and when they help', 'EXPLAIN / EXPLAIN ANALYZE', 'composite indexes and why SELECT * hurts'],
        },
        {
          title: 'Transactions',
          topics: ['BEGIN, COMMIT, ROLLBACK', 'ACID simply', 'isolation levels and locking (overview)'],
        },
        {
          title: 'More database objects',
          topics: ['views and materialised views', 'functions / stored procedures and triggers (overview)', 'JSON columns (jsonb)'],
        },
        {
          title: 'SQL from code',
          topics: ['connecting from Node or Python', 'parameterised queries and SQL injection', 'ORMs (Prisma, SQLAlchemy) vs raw SQL', 'backups and users/permissions (GRANT)'],
        },
      ],
      project: 'final project: design and build the database for an app idea, with indexes, a view, and reports using CTEs and window functions',
    },
  ],
};
