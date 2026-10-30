/** Gate 3: synthetic 10 audit events via policy evaluate. */
import { evaluatePolicy } from '../packages/cloud/src/policy/evaluate';

const rule = {
  id: 'demo',
  denyUnpinnedNpxY: true,
  allowedCommands: ['node', 'npx'],
};

const cases = [
  { command: 'npx', args: ['-y', 'evil'] },
  { command: 'node', args: ['a.js'] },
  { command: 'curl' },
  { command: 'npx', args: ['foo'] },
  { command: 'node', args: ['b.js'] },
  { command: 'python' },
  { command: 'npx', args: ['-y', 'x'] },
  { command: 'node', args: ['c.js'] },
  { command: 'docker' },
  { command: 'npx', args: ['-y', 'y'] },
];

const events = cases.map((c, i) => {
  const d = evaluatePolicy(rule, c);
  return { id: i + 1, ...d, subject: c };
});

if (events.length !== 10) {
  console.error('expected 10 events');
  process.exit(1);
}
const denies = events.filter((e) => !e.allow).length;
console.log(JSON.stringify(events, null, 2));
console.log(`Gate3 demo: ${events.length} events, ${denies} denies`);
