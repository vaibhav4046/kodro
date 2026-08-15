/* Secret and personal-data scan over the files that would actually publish.
 *
 * The repository is public. Everything `git ls-files` reports is already
 * readable by anyone, so the scan reads exactly that set: an untracked scratch
 * file with a token in it is a local problem, and a tracked one is a disclosed
 * credential. Working-tree contents are read rather than blob contents, so a
 * secret staged but not yet committed is caught before it lands.
 *
 * Two classes are looked for.
 *
 * Credentials are matched by issuer-specific shape wherever one exists, which
 * is what keeps the false-positive rate low enough for the gate to stay on:
 * `AKIA` followed by sixteen upper-case characters is an AWS key id and cannot
 * be anything else, whereas a bare forty-character hex string is a hash more
 * often than it is a secret. One generic rule covers assignment of a long
 * literal to something named like a credential, because a home-grown scheme
 * has no issuer prefix to match.
 *
 * Personal data is the leak this project actually produced: absolute paths
 * carrying the account name of whichever machine ran a tool. Those arrive
 * through generated logs and build databases rather than through code, so the
 * shape is matched instead of any particular name, and documented placeholders
 * are allowed by name.
 *
 * Matched text is never printed. A finding reports the file, the line and the
 * rule, which is enough to fix it and not enough to republish it.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let pass = 0;
const failed = [];
function check(name, condition, detail) {
  if (condition) pass += 1;
  else failed.push(name + (detail ? ' -> ' + detail : ''));
}

// --- the file set ----------------------------------------------------------

const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 64 * 1024 * 1024 })
  .toString('utf8')
  .split('\0')
  .filter(Boolean);

check('git reported a tracked file set', tracked.length > 200, String(tracked.length));

/* Fonts, images, compiled PDFs and the like. A credential cannot be read out
 * of them by a line-oriented scan, and decoding them as text produces noise
 * that would have to be allowlisted away. */
const BINARY = /\.(png|jpe?g|gif|webp|ico|icns|pdf|ttf|otf|woff2?|eot|zip|gz|xz|7z|mp4|webm|wav|mp3|db|sqlite3?|pyc|exe|dll|so|dylib)$/i;
/* Bigger than this and it is generated data, not authored text. The largest
 * authored file in the tree is well under it. */
const MAX_BYTES = 4 * 1024 * 1024;

const files = [];
const skippedLarge = [];
for (const relativePath of tracked) {
  if (BINARY.test(relativePath)) continue;
  const full = join(root, relativePath);
  let size;
  try {
    size = statSync(full).size;
  } catch {
    continue; // deleted in the working tree; nothing to publish from it.
  }
  if (size > MAX_BYTES) {
    skippedLarge.push(relativePath);
    continue;
  }
  files.push(relativePath);
}

check('the scan reads a substantial share of the tracked tree', files.length > 150, String(files.length));

// --- the rules -------------------------------------------------------------

/* Every pattern is written from its issuer's documented format. `source` is
 * where the shape comes from, so a future reader can check a rule rather than
 * trusting it. */
const RULES = [
  {
    id: 'private-key-block',
    source: 'PEM RFC 7468 encapsulation boundary',
    pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/,
  },
  { id: 'aws-access-key-id', source: 'AWS key id prefix', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'aws-session-token', source: 'AWS temporary credential prefix', pattern: /\bASIA[0-9A-Z]{16}\b/ },
  { id: 'github-token', source: 'GitHub token prefixes ghp_/gho_/ghu_/ghs_/ghr_', pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { id: 'github-fine-grained-token', source: 'GitHub fine-grained PAT prefix', pattern: /\bgithub_pat_[A-Za-z0-9_]{50,}\b/ },
  { id: 'slack-token', source: 'Slack token prefixes xoxb/xoxp/xoxa/xoxr/xoxs', pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { id: 'google-api-key', source: 'Google API key prefix', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: 'openai-key', source: 'OpenAI secret key prefix', pattern: /\bsk-(?:proj-)?[A-Za-z0-9]{32,}\b/ },
  { id: 'anthropic-key', source: 'Anthropic API key prefix', pattern: /\bsk-ant-[A-Za-z0-9_-]{24,}\b/ },
  { id: 'stripe-live-key', source: 'Stripe live secret key prefixes', pattern: /\b[sr]k_live_[A-Za-z0-9]{20,}\b/ },
  { id: 'groq-key', source: 'Groq API key prefix', pattern: /\bgsk_[A-Za-z0-9]{40,}\b/ },
  { id: 'json-web-token', source: 'JWS compact serialisation of a JSON header', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/ },
  {
    id: 'credential-assignment',
    source: 'a long literal assigned to a credential-shaped name',
    /* The name has to be the whole identifier, so `token_count` and
     * `secret_santa` do not match, and the value has to be twenty or more
     * characters with no whitespace, which is longer than every placeholder
     * this project writes and shorter than nothing real. */
    pattern: /(?:^|[^A-Za-z0-9_])(?:password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)["']?\s*[:=]\s*["'][^"'\s]{20,}["']/i,
  },
];

/* Absolute home directories. The account name is whatever sits in the slot, so
 * the rule matches the shape and the allowlist below names the placeholders
 * this project writes on purpose.
 *
 * The Unix form needs a left guard and both forms need a trailing separator,
 * or prose reads as a path: "a companion/home/arm module" contains the
 * characters of `/home/arm` and none of the meaning. Requiring the segment to
 * continue keeps the rule on things that are actually addressing a file. */
const HOME_PATH = /(?:[A-Za-z]:[\\/]Users[\\/]|(?<![A-Za-z0-9._-])\/(?:home|Users)\/)([A-Za-z0-9._-]+)[\\/]/g;
/* Documented stand-ins. Anything a reader is meant to substitute. `runner` and
 * `runneradmin` are GitHub Actions accounts, which are shared infrastructure
 * rather than a person. */
const PLACEHOLDER_ACCOUNTS = new Set([
  'name', 'you', 'user', 'username', 'yourname', 'your-name', 'your_name',
  'USERNAME', 'USER', 'runner', 'runneradmin', 'me', 'student', 'teacher',
  'pupil', 'someone', 'account', 'example',
]);

/* Files whose job is to describe the defect. A gate that scans its own
 * detection patterns reports itself, and a document that shows a reader what a
 * leaked path looks like has to contain one. Each entry is a file, never a
 * directory, so a new file cannot inherit an exemption. */
const ALLOWED_FILES = new Set([
  'scripts/qa_secrets.mjs',
]);

// --- decoding --------------------------------------------------------------

/* Reading every file as UTF-8 is what let this gate pass over a real leak.
 * Redirecting a console on Windows writes UTF-16LE, so `C:\Users\<name>\` is
 * stored as those characters with a NUL between each one. Decoded as UTF-8
 * that is `C\0:\0\\0U\0...`, which no rule here matches, and the file reports
 * clean while naming an account on every path it prints. Six tracked LaTeX
 * console captures sat in the tree that way while this gate printed PASS.
 *
 * So the encoding is determined from the bytes rather than assumed. A BOM
 * settles it outright. Without one, UTF-16 is still recognisable: half of the
 * bytes are NUL and they all land on the same parity, which never happens in
 * text that is actually UTF-8. */
function decodeText(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString('utf16le');
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return Buffer.from(buffer.subarray(2)).swap16().toString('utf16le');
  }
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString('utf8');
  }
  const probe = buffer.subarray(0, buffer.length - (buffer.length % 2));
  const window = probe.subarray(0, Math.min(probe.length, 4096));
  let evenNul = 0;
  let oddNul = 0;
  for (let index = 0; index < window.length; index += 1) {
    if (window[index] !== 0) continue;
    if (index % 2 === 0) evenNul += 1;
    else oddNul += 1;
  }
  const threshold = window.length / 4;
  if (oddNul > threshold && evenNul === 0) return probe.toString('utf16le');
  if (evenNul > threshold && oddNul === 0) return Buffer.from(probe).swap16().toString('utf16le');
  return buffer.toString('utf8');
}

// --- the scan --------------------------------------------------------------

const findings = [];
const pathFindings = [];

for (const relativePath of files) {
  if (ALLOWED_FILES.has(relativePath)) continue;
  let text;
  try {
    text = decodeText(readFileSync(join(root, relativePath)));
  } catch {
    continue;
  }
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line || line.length > 4000) continue; // minified or generated payload.
    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        findings.push(`${relativePath}:${index + 1}  ${rule.id}`);
      }
    }
    HOME_PATH.lastIndex = 0;
    let match = HOME_PATH.exec(line);
    while (match !== null) {
      const account = match[1];
      const bracketed = line.slice(Math.max(0, match.index)).includes('<');
      if (!PLACEHOLDER_ACCOUNTS.has(account) && !PLACEHOLDER_ACCOUNTS.has(account.toLowerCase()) && !bracketed) {
        pathFindings.push(`${relativePath}:${index + 1}  home path naming an account`);
      }
      match = HOME_PATH.exec(line);
    }
  }
}

function report(list) {
  const unique = [...new Set(list)];
  return unique.slice(0, 10).join(' | ') + (unique.length > 10 ? ` | ...and ${unique.length - 10} more` : '');
}

check('no tracked file contains a credential', findings.length === 0, report(findings));
check('no tracked file contains a home path naming an account', pathFindings.length === 0, report(pathFindings));

// --- file-shaped secrets ---------------------------------------------------

/* A key file is a secret whether or not its contents parse. These are matched
 * on name because that is the only thing a scan can rely on for a format it
 * refuses to read. `.env.example` and `.env.sample` are the documented
 * opposite: they exist to be published. */
const SECRET_FILE = /(^|\/)(\.env(\.[A-Za-z0-9]+)?|.*\.(pem|key|p12|pfx|jks|keystore|ppk))$/i;
const PUBLISHABLE_ENV = /(^|\/)\.env\.(example|sample|template)$/i;
const secretFiles = tracked.filter(
  (relativePath) => SECRET_FILE.test(relativePath) && !PUBLISHABLE_ENV.test(relativePath),
);
check('no key or environment file is tracked', secretFiles.length === 0, secretFiles.slice(0, 10).join(', '));

// --- the gate checks itself ------------------------------------------------

/* A scan that silently stops matching is worse than no scan, because the green
 * line is read as evidence. Each rule is fired against a synthetic value built
 * to its own documented shape. The values are fabricated here and are not
 * credentials for anything. */
const PROBES = {
  'private-key-block': '-----BEGIN RSA PRIVATE KEY-----',
  'aws-access-key-id': 'AKIA' + 'Q'.repeat(16),
  'aws-session-token': 'ASIA' + 'Q'.repeat(16),
  'github-token': 'ghp_' + 'a'.repeat(36),
  'github-fine-grained-token': 'github_pat_' + 'a'.repeat(50),
  'slack-token': 'xoxb-' + '1'.repeat(12),
  'google-api-key': 'AIza' + 'a'.repeat(35),
  'openai-key': 'sk-' + 'a'.repeat(32),
  'anthropic-key': 'sk-ant-' + 'a'.repeat(24),
  'stripe-live-key': 'sk_live_' + 'a'.repeat(20),
  'groq-key': 'gsk_' + 'a'.repeat(40),
  'json-web-token': 'eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0.' + 'a'.repeat(10),
  'credential-assignment': 'api_key = "' + 'a'.repeat(24) + '"',
};
for (const rule of RULES) {
  const probe = PROBES[rule.id];
  check(`rule ${rule.id} matches a value of its documented shape`, Boolean(probe) && rule.pattern.test(probe), rule.source);
}

/* And does not match the things it is most likely to be confused by. A rule
 * that fires on a git hash or a lockfile integrity line gets switched off by
 * whoever has to run it. */
const NON_SECRETS = [
  'const token_count = 42;',
  'sha256-9f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8',
  'commit 13c0997ab8cbd1f01767ee02dd047123c325abcdef0123456789abcdef012345',
  '"integrity": "sha512-' + 'a'.repeat(60) + '"',
  'secret_santa = "a name"',
  'password: <your password here>',
];
for (const line of NON_SECRETS) {
  const fired = RULES.filter((rule) => rule.pattern.test(line)).map((rule) => rule.id);
  check(`no rule fires on ${JSON.stringify(line.slice(0, 32))}`, fired.length === 0, fired.join(', '));
}

check('the home-path rule matches a real account path', (() => {
  HOME_PATH.lastIndex = 0;
  const found = HOME_PATH.exec('C:\\Users\\jdoe\\AppData\\Local');
  return Boolean(found) && !PLACEHOLDER_ACCOUNTS.has(found[1]);
})(), '');

check('the home-path rule allows a documented placeholder', (() => {
  HOME_PATH.lastIndex = 0;
  const found = HOME_PATH.exec('/home/you/projects');
  return Boolean(found) && PLACEHOLDER_ACCOUNTS.has(found[1]);
})(), '');

check('the home-path rule ignores a slash-separated word list', (() => {
  HOME_PATH.lastIndex = 0;
  return HOME_PATH.exec('a companion/home/arm module') === null;
})(), '');

/* The decoder is what the rules are only as good as. Every case below is a
 * file this repository has actually produced: a PowerShell redirection writes
 * UTF-16LE with a BOM, a few tools write it without one, and everything
 * authored here is UTF-8. The leak line is fabricated, and `jdoe` is not an
 * account on any machine. */
const LEAK_LINE = 'Font file: C:\\Users\\jdoe\\AppData\\Local\\Programs\\MiKTeX\\lm.enc\n';
function matchesHomePath(text) {
  HOME_PATH.lastIndex = 0;
  const found = HOME_PATH.exec(text);
  return Boolean(found) && found[1] === 'jdoe';
}

check('a UTF-16LE file with a BOM is decoded before it is scanned', matchesHomePath(decodeText(
  Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(LEAK_LINE, 'utf16le')]),
)), '');

check('a UTF-16LE file with no BOM is decoded before it is scanned', matchesHomePath(decodeText(
  Buffer.from(LEAK_LINE, 'utf16le'),
)), '');

check('a UTF-16BE file with a BOM is decoded before it is scanned', matchesHomePath(decodeText(
  Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(LEAK_LINE, 'utf16le').swap16()]),
)), '');

check('a UTF-8 file is left alone by the decoder', decodeText(Buffer.from(LEAK_LINE, 'utf8')) === LEAK_LINE, '');

check('a UTF-8 file with a BOM loses only the BOM', decodeText(
  Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(LEAK_LINE, 'utf8')]),
) === LEAK_LINE, '');

/* Reading a UTF-16 file as UTF-8 is the exact failure being guarded against,
 * so it is asserted to fail. If this check ever passes the guard above has
 * become pointless and should be removed rather than left as decoration. */
check('the old UTF-8-only read would have missed it', !matchesHomePath(
  Buffer.from(LEAK_LINE, 'utf16le').toString('utf8'),
), '');

// --- result ----------------------------------------------------------------

if (failed.length) {
  console.error(`qa_secrets: ${failed.length} failed, ${pass} passed`);
  failed.forEach((failureName) => console.error('FAIL  ' + failureName));
  process.exitCode = 1;
} else {
  console.log(
    `PASS  secrets: ${pass} passed (${files.length} of ${tracked.length} tracked files read`
    + (skippedLarge.length ? `, ${skippedLarge.length} over the size cap` : '')
    + `, ${RULES.length} credential rules)`,
  );
}
