import { spawn } from 'child_process';
import type { CodeBlock } from './codeBlocks.js';

/**
 * One broken script and a beginner stops trusting the mentor. Before code is sent, it's checked for
 * syntax errors — parsed only, never run: Python with Python's own parser (ast.parse), JavaScript /
 * TypeScript with the TypeScript compiler, JSON with JSON.parse. If a checker isn't available on this
 * machine (no python3, no typescript package), that language is skipped, never blocking a reply.
 */
export interface CodeIssue {
  lang: string;
  line?: number;
  message: string;
}

const PY = new Set(['python', 'py', 'python3']);
const JS = new Map([
  ['javascript', 'x.js'],
  ['js', 'x.js'],
  ['node', 'x.js'],
  ['jsx', 'x.jsx'],
  ['typescript', 'x.ts'],
  ['ts', 'x.ts'],
  ['tsx', 'x.tsx'],
]);

const PY_PARSE = [
  'import ast, sys',
  'try:',
  '    ast.parse(sys.stdin.read())',
  'except SyntaxError as e:',
  '    print(f"{e.lineno}|{e.msg}")',
].join('\n');

function checkPython(code: string): Promise<CodeIssue | null> {
  return new Promise((resolve) => {
    let out = '';
    let settled = false;
    const done = (v: CodeIssue | null) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    try {
      const child = spawn('python3', ['-c', PY_PARSE], { stdio: ['pipe', 'pipe', 'ignore'] });
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        done(null);
      }, 3000);
      child.on('error', () => done(null)); // no python3 here: skip
      child.stdout.on('data', (d) => (out += String(d)));
      child.on('close', () => {
        clearTimeout(timer);
        const m = /^(\d+)\|(.+)$/m.exec(out.trim());
        done(m ? { lang: 'python', line: Number(m[1]), message: m[2]!.trim() } : null);
      });
      child.stdin.end(code);
    } catch {
      done(null);
    }
  });
}

let typescript: typeof import('typescript') | null | undefined;
async function loadTypeScript() {
  if (typescript === undefined) typescript = await import('typescript').then((m) => (m.default ?? m) as typeof import('typescript')).catch(() => null);
  return typescript;
}

async function checkScript(code: string, fileName: string, lang: string): Promise<CodeIssue | null> {
  const ts = await loadTypeScript();
  if (!ts) return null;
  const out = ts.transpileModule(code, {
    fileName,
    reportDiagnostics: true,
    compilerOptions: { allowJs: true, jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
  });
  const d = out.diagnostics?.[0];
  if (!d) return null;
  const line = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : undefined;
  return { lang, line, message: ts.flattenDiagnosticMessageText(d.messageText, ' ') };
}

export async function checkCodeSyntax(blocks: CodeBlock[]): Promise<CodeIssue[]> {
  const issues: CodeIssue[] = [];
  for (const b of blocks.slice(0, 5)) {
    const code = b.code.slice(0, 20_000);
    let issue: CodeIssue | null = null;
    if (PY.has(b.lang)) issue = await checkPython(code);
    else if (JS.has(b.lang)) issue = await checkScript(code, JS.get(b.lang)!, b.lang);
    else if (b.lang === 'json') {
      try {
        JSON.parse(code);
      } catch (err) {
        issue = { lang: 'json', message: err instanceof Error ? err.message : 'invalid JSON' };
      }
    }
    if (issue) issues.push(issue);
  }
  return issues;
}

export function describeIssues(issues: CodeIssue[]): string[] {
  return issues.map(
    (i) => `Your ${i.lang} code has a syntax error${i.line ? ` at line ${i.line}` : ''}: ${i.message}. Fix it and send the complete corrected code.`,
  );
}
