// Capture each role's poster.html to poster.jpg at 1920x1080. Run from demo/: node posters.mjs
import { chromium } from '/home/ubuntu/pet/control-app/app/node_modules/playwright/index.mjs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
for (const role of ['doctor', 'patient']) {
  await page.goto(pathToFileURL(path.resolve(role, 'composition/poster.html')).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.resolve(role, 'poster.jpg'), type: 'jpeg', quality: 92 });
}
await browser.close();
console.log('posters ok');
