import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:4321";
const OUT = process.env.SHOT_DIR || "/tmp/claude-0/-home-user-robolearn/e786903c-54d4-5879-a517-e633ff045c52/scratchpad/shots";
fs.mkdirSync(OUT, { recursive: true });

const sizes = [
  { name: "1440", w: 1440, h: 900 },
  { name: "768", w: 768, h: 1024 },
  { name: "375", w: 375, h: 812 },
];

const errors = [];
// Prefer the environment's preinstalled old-headless shell if present; otherwise
// fall back to Playwright's own managed browser so this runs anywhere.
const SHELL = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const launchOpts = fs.existsSync(SHELL) ? { executablePath: SHELL } : {};
const browser = await chromium.launch(launchOpts);

async function run() {
  for (const s of sizes) {
    const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning")
        errors.push(`[${s.name}] ${m.type()}: ${m.text()}`);
    });
    page.on("pageerror", (e) => errors.push(`[${s.name}] pageerror: ${e.message}`));

    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(2600); // let the exchange boot + stream
    await page.screenshot({ path: `${OUT}/home-${s.name}.png` });

    // open a line
    const row = page.locator(".row").first();
    if (await row.count()) {
      await row.click();
      await page.waitForTimeout(1400);
      await page.screenshot({ path: `${OUT}/detail-${s.name}.png` });
    }

    // take the line + surge, on desktop only
    if (s.name === "1440") {
      const take = page.locator(".act-take");
      if (await take.count()) { await take.click(); await page.waitForTimeout(400); }
      const surge = page.locator(".opbtn", { hasText: "Surge test" });
      if (await surge.count()) { await surge.click(); await page.waitForTimeout(1200); }
      await page.screenshot({ path: `${OUT}/after-actions-${s.name}.png` });

      // cut signal state
      const cut = page.locator(".opbtn", { hasText: "Cut signal" });
      if (await cut.count()) { await cut.click(); await page.waitForTimeout(500); }
      await page.screenshot({ path: `${OUT}/dropped-${s.name}.png` });
    }

    await ctx.close();
  }

  // reduced motion: confirm the static fallback is a real page, not broken
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`[reduced] pageerror: ${e.message}`));
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/reduced-1440.png` });
    await ctx.close();
  }

  // guide
  for (const s of [sizes[0], sizes[2]]) {
    const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h } });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") errors.push(`[guide-${s.name}] ${m.text()}`); });
    page.on("pageerror", (e) => errors.push(`[guide-${s.name}] pageerror: ${e.message}`));
    await page.goto(BASE + "/guide/", { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/guide-${s.name}.png`, fullPage: s.name === "375" ? false : true });
    await ctx.close();
  }
}

try {
  await run();
} finally {
  await browser.close();
}

// horizontal scroll check
console.log("SHOTS:", fs.readdirSync(OUT).join(", "));
console.log("CONSOLE ISSUES:", errors.length);
for (const e of errors) console.log("  " + e);
