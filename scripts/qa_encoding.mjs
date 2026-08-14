/* Deterministic text-encoding gate.
 *
 * Catches mojibake: text that was written as UTF-8, then read back as if it
 * were Windows-1252 and written out as UTF-8 again. The classic tell is a
 * middle dot growing a capital A-circumflex in front of it, or an en dash
 * turning into three punctuation marks. It is invisible in a diff summary,
 * survives every syntax check, and lands on the screen in front of the
 * reader, so it needs a gate of its own.
 *
 * The forbidden sequences are not a hand-written list. They are derived from
 * the non-ASCII characters this codebase actually uses: take each one, encode
 * it as UTF-8, push every byte through the Windows-1252 table, and that is
 * exactly what its corrupted twin looks like. New glyphs are covered the day
 * they are introduced, and a character the project never uses never produces
 * a false positive.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let pass = 0;
const failed = [];
function check(name, condition, detail) {
  if (condition) pass += 1;
  else failed.push(name + (detail ? ' -> ' + detail : ''));
}

/* Windows-1252 high range. Five bytes are undefined in the codepage; a decoder
 * that hits one cannot produce mojibake from it, so they stay out of the map
 * and any character whose UTF-8 uses them is skipped below. */
const CP1252_HIGH = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…',
  0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8A: 'Š',
  0x8B: '‹', 0x8C: 'Œ', 0x8E: 'Ž', 0x91: '‘', 0x92: '’',
  0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—',
  0x98: '˜', 0x99: '™', 0x9A: 'š', 0x9B: '›', 0x9C: 'œ',
  0x9E: 'ž', 0x9F: 'Ÿ',
};
function cp1252(byte) {
  if (byte < 0x80) return String.fromCharCode(byte);
  if (byte > 0x9F) return String.fromCharCode(byte);
  return CP1252_HIGH[byte] || null;
}

/* What one round of double-encoding does to a single character. Returns null
 * when the character cannot survive the trip, which means it cannot be the
 * source of this defect either. */
function corrupt(char) {
  const bytes = Buffer.from(char, 'utf8');
  if (bytes.length < 2) return null;
  let out = '';
  for (const byte of bytes) {
    const mapped = cp1252(byte);
    if (mapped === null) return null;
    out += mapped;
  }
  return out === char ? null : out;
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'site', '__pycache__', '.pytest_cache', 'dist', 'build', '.venv', '_build']);
const TEXT = /\.(js|mjs|cjs|jsx|ts|tsx|css|html|json|py|md|txt|yml|yaml|toml|ps1|sh)$/;
/* pdflatex console captures. They are evidence of a compile, transcribed byte
 * for byte from a tool that prints Latin-1 font names into a UTF-8 terminal,
 * so they are legitimately not valid UTF-8 and must not be rewritten to make
 * a gate happy. Excluded as tool output, not as an exception to the rule. */
const GENERATED_LOG = /(^|[\\/])(doi_|final_)?compile\d*\.txt$/;
const files = [];
function walk(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (TEXT.test(entry.name) && !GENERATED_LOG.test(entry.name)) files.push(full);
  }
}
['src', 'scripts', 'docs', 'tests'].forEach((dir) => walk(join(root, dir)));

check('the scan found source files to read', files.length > 100, String(files.length));

// --- 1. every file is valid, unmarked UTF-8 --------------------------------
const decoded = new Map();
const notUtf8 = [];
const withBom = [];
for (const file of files) {
  const buffer = readFileSync(file);
  const text = buffer.toString('utf8');
  // A round trip that loses bytes means the file was never valid UTF-8.
  if (!Buffer.from(text, 'utf8').equals(buffer)) notUtf8.push(relative(root, file));
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) withBom.push(relative(root, file));
  decoded.set(file, text);
}
check('every scanned file is valid UTF-8', notUtf8.length === 0, notUtf8.slice(0, 5).join(', '));
check('no file carries a UTF-8 byte order mark', withBom.length === 0, withBom.slice(0, 5).join(', '));

/* Written as an escape, not as the glyph. This file is inside the tree it
 * scans, so a literal marker here would be reported as a defect in the gate
 * that exists to find it. Every corrupted form below is escaped for the same
 * reason. */
const REPLACEMENT_CHAR = '\uFFFD';
/* Code only. A replacement character in code is decoded data that was lost on
 * the way in, always a defect. Prose is different: docs/mcp.md prints the
 * character in a troubleshooting table so a reader can recognise the symptom,
 * and that is the documentation doing its job. */
const CODE = /\.(js|mjs|cjs|jsx|ts|tsx|css|html|json|py)$/;
const replacement = [];
for (const [file, text] of decoded) {
  if (CODE.test(file) && text.includes(REPLACEMENT_CHAR)) replacement.push(relative(root, file));
}
check('no code file contains a U+FFFD replacement character', replacement.length === 0, replacement.slice(0, 5).join(', '));

// --- 2. the alphabet this project actually writes --------------------------
const alphabet = new Set();
for (const text of decoded.values()) {
  for (const char of text) {
    if (char.charCodeAt(0) > 0x7F) alphabet.add(char);
  }
}
check('the codebase uses non-ASCII characters worth protecting', alphabet.size > 5, String(alphabet.size));

const corruptions = new Map();
for (const char of alphabet) {
  const broken = corrupt(char);
  // Skip anything whose corrupted form is itself in the alphabet as a
  // legitimate character sequence would be indistinguishable from the defect.
  if (broken) corruptions.set(broken, char);
}
check('every protected character has a derived corrupted form', corruptions.size > 5, String(corruptions.size));

// The three forms that were actually found in this repository, pinned so the
// derivation itself cannot silently stop working.
check('the derivation reproduces a double-encoded middle dot', corrupt('·') === '\u00c2\u00b7', JSON.stringify(corrupt('·')));
check('the derivation reproduces a double-encoded en dash', corrupt('–') === '\u00e2\u20ac\u201c', JSON.stringify(corrupt('–')));
check('the derivation reproduces a double-encoded multiplication X', corrupt('✕') === '\u00e2\u0153\u2022', JSON.stringify(corrupt('✕')));

// --- 3. the actual scan ----------------------------------------------------
const hits = [];
for (const [file, text] of decoded) {
  for (const [broken, original] of corruptions) {
    let index = text.indexOf(broken);
    while (index !== -1) {
      const line = text.slice(0, index).split('\n').length;
      hits.push(relative(root, file).split(sep).join('/') + ':' + line
        + '  ' + JSON.stringify(broken) + ' should be ' + JSON.stringify(original));
      index = text.indexOf(broken, index + broken.length);
    }
  }
}
check('no source file contains double-encoded text',
  hits.length === 0,
  hits.slice(0, 12).join(' | ') + (hits.length > 12 ? ' | ...and ' + (hits.length - 12) + ' more' : ''));

if (failed.length) {
  console.error(`qa_encoding: ${failed.length} failed, ${pass} passed`);
  failed.forEach((failureName) => console.error('FAIL  ' + failureName));
  process.exitCode = 1;
} else {
  console.log(`${pass} passed (${files.length} files, ${corruptions.size} protected characters)`);
}
