const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // 監聽並印出 console logs 與 errors
  page.on('console', msg => {
    console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', error => {
    console.log(`[Browser Error] ${error.message}`);
  });

  try {
    await page.goto('http://localhost:8765', { waitUntil: 'networkidle0' });
    
    // 等待 2 秒確保資料已經完全處理並繪製
    await new Promise(r => setTimeout(r, 2000));

    // 切換到投球分析 Tab
    await page.evaluate(() => {
      const tabs = document.querySelectorAll('.tab');
      if(tabs.length >= 2) tabs[1].click(); // 第二個通常是投球分析
    });

    await new Promise(r => setTimeout(r, 2000));

    // 檢查 Fireball Speedometer 有沒有畫出 <rect> 或者文字
    const content = await page.evaluate(() => {
      const container = document.querySelector('#fireball-speedometer');
      return container ? container.innerHTML : 'Container Not Found';
    });

    console.log('Fireball Speedometer HTML length:', content.length);
    if(content.length < 200) {
      console.log('Content dump:', content);
    }
  } catch (err) {
    console.error('Puppeteer Script Error:', err);
  } finally {
    await browser.close();
  }
})();
