/**
 * Sahne tasarımı ekran görüntüleri — 8 sahne karşılaştırması
 * Kullanım: node scripts/stage-screenshots.js
 */
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'https://remiks-istanbul-dj-production.up.railway.app';
const OUT_DIR = '/Users/yavuzalpazizoglu/Desktop/screenshots';
const SLUG = 'vxpeajoe'; // DENEME-42, active, 10 istek

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const STAGES = [
  { id: 'club',      label: 'Club' },
  { id: 'festival',  label: 'Festival' },
  { id: 'cyber',     label: 'Cyber' },
  { id: 'rave',      label: 'Rave' },
  { id: 'cinema',    label: 'Cinema' },
  { id: 'elegant',   label: 'Elegant' },
  { id: 'minimal',   label: 'Minimal' },
  { id: 'corporate', label: 'Corporate' },
];

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const displayUrl = `${BASE_URL}/display/${SLUG}`;
  console.log(`🖥  Açılıyor: ${displayUrl}`);
  await page.goto(displayUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2500));

  // Fullscreen hint gizle
  await page.evaluate(() => {
    const hint = document.querySelector('.display-fullscreen-hint');
    if (hint) hint.style.display = 'none';
  });

  // animLevel HIGH yap (localStorage)
  await page.evaluate(() => {
    const keys = Object.keys(localStorage);
    for (const k of keys) {
      try {
        const v = JSON.parse(localStorage.getItem(k));
        if (v && typeof v === 'object' && ('animLevel' in v || 'stageDesign' in v)) {
          v.animLevel = 'high';
          localStorage.setItem(k, JSON.stringify(v));
        }
      } catch {}
    }
  });

  for (const stage of STAGES) {
    console.log(`📸 ${stage.label} çekiliyor...`);

    // React state yerine DOM class'ı direkt değiştir
    await page.evaluate((sid) => {
      const dp = document.querySelector('.display-page');
      if (!dp) return;
      const existing = [...dp.classList].filter(c => c.startsWith('stage-'));
      existing.forEach(c => dp.classList.remove(c));
      dp.classList.add(`stage-${sid}`);

      // animLevel HIGH
      dp.setAttribute('data-anim', 'high');

      // Hint gizle
      const hint = document.querySelector('.display-fullscreen-hint');
      if (hint) hint.style.display = 'none';
    }, stage.id);

    await new Promise(r => setTimeout(r, 900));

    const file = path.join(OUT_DIR, `new-stage-${stage.id}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log(`   ✅ ${file}`);
  }

  await browser.close();
  console.log('\n🎉 Tüm sahneler hazır!');
  console.log(`📁 Klasör: ${OUT_DIR}`);
})();
