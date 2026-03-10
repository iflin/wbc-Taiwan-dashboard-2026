const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('drawFireworksMap') || msg.text().includes('ERROR')) {
      console.log('BROWSER CONSOLE:', msg.text());
    }
  });

  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.message);
  });

  await page.goto('http://localhost:8765');
  await page.waitForTimeout(3000);

  const fireworksHtml = await page.evaluate(() => {
    const el = document.getElementById('fireworks-map');
    return el ? el.outerHTML : 'NOT FOUND';
  });
  console.log('FIREWORKS DOM:', fireworksHtml);

  await browser.close();
})();
