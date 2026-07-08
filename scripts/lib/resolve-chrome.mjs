/* resolve-chrome: cross-platform headless-Chrome binary resolution for the
 * browser QA gates (qa_web / qa_worlds / qa_ui).
 *
 * These gates used to hardcode the Windows install path
 * (C:\Program Files\Google\Chrome\Application\chrome.exe), which is exactly why
 * they could only ever run locally: on the Linux CI runner that path does not
 * exist, so the gate SKIPped and a visually broken web build could ship on a
 * green CI. resolveChrome() finds Chrome on Windows, Linux AND macOS so qa_web
 * can run on ubuntu-latest in CI (where Chrome is on PATH as google-chrome, or
 * is installed + pointed at via CHROME_PATH by browser-actions/setup-chrome).
 *
 * Resolution order (first hit wins):
 *   1. CHROME_PATH or CHROME_BIN env var, when it points at a real file (or, on
 *      POSIX, a bare command name resolvable via `which`). This is the
 *      deterministic override CI uses. Both names are honoured because qa_web
 *      historically read CHROME_BIN while qa_worlds/qa_ui read CHROME_PATH.
 *   2. Platform defaults:
 *      - win32:  Program Files, Program Files (x86), LocalAppData installs
 *      - linux:  google-chrome / google-chrome-stable / chromium-browser /
 *                chromium via `which` (PATH), then the common absolute installs
 *      - darwin: the /Applications Google Chrome (then Chromium) app binary
 *
 * Returns an absolute path (or a `which`-resolved command) or null when no
 * Chrome is found; every caller SKIPs (exit 0) on null so a Chrome-less box
 * never breaks a pipeline.
 */
'use strict';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

// POSIX `which`: absolute path for a command on PATH, or null. Only used on
// non-Windows platforms (win32 resolves by probing literal install paths).
function which(bin) {
  try {
    const r = spawnSync('which', [bin], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout) {
      const first = r.stdout.split(/\r?\n/)[0].trim();
      return first || null;
    }
  } catch { /* `which` unavailable; fall through to defaults */ }
  return null;
}

export function resolveChrome() {
  // 1) Explicit override. CI sets CHROME_PATH; CHROME_BIN kept for back-compat.
  const envPath = process.env.CHROME_PATH || process.env.CHROME_BIN;
  if (envPath) {
    if (existsSync(envPath)) return envPath;
    if (process.platform !== 'win32') {
      const resolved = which(envPath);
      if (resolved) return resolved;
    }
  }

  // 2) Platform defaults.
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ];
    return candidates.find((c) => existsSync(c)) || null;
  }

  if (process.platform === 'darwin') {
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
    return candidates.find((c) => existsSync(c)) || null;
  }

  // linux / other unix: PATH first (CI installs put Chrome on PATH), then the
  // common absolute install locations different distros ship.
  for (const bin of ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium']) {
    const resolved = which(bin);
    if (resolved) return resolved;
  }
  const absolutes = [
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser', '/usr/bin/chromium', '/snap/bin/chromium',
  ];
  return absolutes.find((c) => existsSync(c)) || null;
}
