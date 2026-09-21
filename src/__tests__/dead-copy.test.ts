// ============================================
// Bangladesh Business Tycoon - Copy that lies to the player
// ============================================
//
// The game used to have a "Next Day" button. The server owns the clock now, so
// a player cannot advance a day at all — days arrive on their own, about one a
// real minute, and the top bar counts down to the next.
//
// The button went. The copy did not. A tutorial slide told players to press it
// for weeks, and seven empty states still said "Advance days to generate data"
// — instructions to do something the interface no longer offers. That is
// invariant U1, and it went unnoticed because the end-to-end test drives HTTP
// and never reads a rendered string.
//
// This is the cheap half of the guard the register asked for: a scan of
// player-facing source for phrases that describe controls that do not exist.
// It cannot see a rendered page, so it will not catch everything — but it
// catches this class, which is the one with a track record here.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');

/** Where player-facing strings live. */
const COPY_DIRS = [
  path.join(ROOT, 'src/components'),
  path.join(ROOT, 'src/lib/i18n/messages'),
  path.join(ROOT, 'src/lib/game/onboarding'),
];

/**
 * Phrases that instruct the player to advance the clock.
 *
 * Deliberately narrow. "Next day in 45s" is a countdown and correct; "Advance
 * to the next day" is an instruction and is not. The difference is an
 * imperative verb, so that is what is matched.
 */
const DEAD_PHRASES: { pattern: RegExp; why: string }[] = [
  {
    pattern: /\b(advance|click|press|tap|hit|push)\b[^.!?"'`]{0,40}\bnext\s+day\b/i,
    why: 'the "Next Day" button was removed when the server took over the clock',
  },
  {
    pattern: /\badvance\s+(the\s+)?days?\b/i,
    why: 'a player cannot advance a day — the server clock does, about once a minute',
  },
  {
    pattern: /\b(click|press|tap)\b[^.!?"'`]{0,30}\b(end|finish)\s+(the\s+)?day\b/i,
    why: 'there is no end-of-day control',
  },
];

function sourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) found.push(full);
  }
  return found;
}

/**
 * Strip comments before scanning.
 *
 * A comment explaining *why* the button was removed is a good comment, and
 * several exist. Failing on those would push people to delete the explanation
 * rather than fix the copy.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');
}

describe('player-facing copy', () => {
  const files = COPY_DIRS.flatMap(sourceFiles);

  it('has files to scan', () => {
    // A scanner pointed at nothing passes forever. This is the guard on the guard.
    expect(files.length).toBeGreaterThan(20);
  });

  it('never tells the player to advance the day themselves', () => {
    const offences: string[] = [];

    for (const file of files) {
      const source = withoutComments(fs.readFileSync(file, 'utf8'));

      for (const line of source.split('\n')) {
        for (const { pattern, why } of DEAD_PHRASES) {
          if (pattern.test(line)) {
            offences.push(`${path.relative(ROOT, file)}: "${line.trim().slice(0, 100)}" — ${why}`);
          }
        }
      }
    }

    expect(offences, offences.join('\n')).toEqual([]);
  });

  it('catches the phrasing it is meant to catch', () => {
    // A scanner nobody has tested against a positive case is not a scanner.
    const samples = [
      'No history yet. Advance days to generate data.',
      'Advance to the next day to generate news!',
      'Click Next Day to continue',
      'Press the next day button',
    ];

    for (const sample of samples) {
      expect(
        DEAD_PHRASES.some(({ pattern }) => pattern.test(sample)),
        `missed: ${sample}`,
      ).toBe(true);
    }
  });

  it('leaves correct copy alone', () => {
    // The countdown is accurate and must keep working.
    const allowed = [
      'Next day in 45s',
      'Next day soon',
      'The next day arrives on its own.',
      'Your chart builds as the days pass.',
      'The log fills in once a day has been traded.',
    ];

    for (const sample of allowed) {
      expect(
        DEAD_PHRASES.some(({ pattern }) => pattern.test(sample)),
        `false positive: ${sample}`,
      ).toBe(false);
    }
  });
});
