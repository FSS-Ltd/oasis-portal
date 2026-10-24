import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const intervalOptions = new Set([
  'refetchInterval',
  'pollInterval',
  'pollingInterval',
  'refreshInterval',
]);
const repeatedReads = new Set(['refetch', 'fetchQuery', 'refetchQueries']);
const countdowns = new Map([
  ['apps/web/src/app/access-revoked/access-revoked-screen.tsx', 'updateCountdown'],
  ['apps/mobile/src/components/core/mobile-access-revoked-screen.tsx', 'updateRemainingTime'],
]);

function name(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  return undefined;
}

function isAllowedInterval(call, path) {
  const callback = call.arguments[0];
  if (!callback) return false;
  if (ts.isIdentifier(callback) && countdowns.get(path) === callback.text) return true;
  if (path !== 'apps/mobile/src/components/smoke/student-portal-smoke-screen.tsx') return false;
  if (!ts.isArrowFunction(callback) || !ts.isBlock(callback.body)) return false;
  const statements = callback.body.statements;
  if (statements.length !== 1 || !ts.isExpressionStatement(statements[0])) return false;
  const expression = statements[0].expression;
  return (
    ts.isCallExpression(expression) &&
    ts.isPropertyAccessExpression(expression.expression) &&
    ts.isIdentifier(expression.expression.expression) &&
    expression.expression.expression.text === 'heartbeat' &&
    expression.expression.name.text === 'mutate'
  );
}

function insideLoop(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (
      ts.isForStatement(parent) ||
      ts.isForOfStatement(parent) ||
      ts.isForInStatement(parent) ||
      ts.isWhileStatement(parent) ||
      ts.isDoStatement(parent)
    )
      return true;
    if (ts.isFunctionLike(parent)) return false;
  }
  return false;
}

function selfSchedulingRead(node) {
  const functionName = ts.isFunctionDeclaration(node)
    ? node.name?.text
    : ts.isArrowFunction(node) && ts.isVariableDeclaration(node.parent)
      ? name(node.parent.name)
      : undefined;
  if (!functionName || !node.body) return false;
  const calls = [];
  function collect(child) {
    if (ts.isCallExpression(child)) calls.push(child);
    ts.forEachChild(child, collect);
  }
  collect(node.body);
  const timers = calls.filter((call) => name(call.expression) === 'setTimeout');
  const reads = calls.some((call) =>
    [...repeatedReads, 'invalidate', 'invalidateQueries', 'fetch'].includes(name(call.expression)),
  );
  const repeats =
    calls.some((call) => name(call.expression) === functionName) ||
    timers.some((call) => call.arguments[0] && name(call.arguments[0]) === functionName);
  return (
    reads &&
    repeats &&
    timers.some((timer) => {
      const delay = timer.arguments[1];
      let calendarBoundary = false;
      function findBoundary(child) {
        if (ts.isCallExpression(child) && name(child.expression) === 'nextLondonMidnight')
          calendarBoundary = true;
        ts.forEachChild(child, findBoundary);
      }
      if (delay) findBoundary(delay);
      return !calendarBoundary;
    })
  );
}

/** Report state-discovery polling without forbidding one-shot event/deadline timers. */
export function detectPolling(source, path) {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const issues = [];
  function report(node, message) {
    const position = file.getLineAndCharacterOfPosition(node.getStart(file));
    issues.push(`${path}:${position.line + 1}: ${message}`);
  }
  function visit(node) {
    if ((ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)) && selfSchedulingRead(node)) {
      report(
        node,
        'Self-scheduling state-discovery reads must use events or explicit calendar deadlines.',
      );
    }
    if (
      (ts.isPropertyAssignment(node) ||
        ts.isShorthandPropertyAssignment(node) ||
        ts.isPropertyDeclaration(node)) &&
      intervalOptions.has(name(node.name))
    ) {
      report(node, 'Use committed-change events instead of interval query options.');
    }
    if (ts.isCallExpression(node)) {
      const method = name(node.expression);
      if (method === 'setInterval' && !isAllowedInterval(node, path)) {
        report(
          node,
          'Recurring intervals require a documented, narrow heartbeat or UI-clock exception.',
        );
      }
      if (repeatedReads.has(method) && insideLoop(node)) {
        report(node, 'Repeated confirmation reads must subscribe to committed changes.');
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return issues;
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return ['node_modules', '.git', '.next', 'dist', '__tests__', 'tests', 'generated'].includes(
        entry.name,
      )
        ? []
        : sourceFiles(path);
    }
    return /\.[cm]?[jt]sx?$/u.test(entry.name) && !/\.(test|spec)\./u.test(entry.name)
      ? [path]
      : [];
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const issues = ['apps', 'packages']
    .flatMap((directory) => sourceFiles(join(root, directory)))
    .flatMap((path) =>
      detectPolling(readFileSync(path, 'utf8'), relative(root, path).replaceAll('\\', '/')),
    );
  if (issues.length > 0) {
    console.error(issues.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Event architecture: no application state-discovery polling found.');
  }
}
