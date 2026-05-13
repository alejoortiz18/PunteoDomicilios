/**
 * diagnostico-login.mjs
 * Valida login visible en producción local IIS y marca error si termina en /Home/Error.
 */
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:7261';
const USUARIO = 'MMUNOZ';

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 350 });
  const page = await browser.newPage();

  const consoleErrors = [];
  const httpErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      consoleErrors.push(txt);
      console.log('[CONSOLE ERROR]', txt);
    }
  });

  page.on('response', response => {
    if (response.status() >= 400) {
      const line = `${response.status()} ${response.url()}`;
      httpErrors.push(line);
      console.log('[HTTP ERROR]', line);
    }
  });

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.fill('input[name="usuario"]', USUARIO);
  await page.click('button[type="submit"]');

  await sleep(4000);

  const finalUrl = page.url();
  await page.screenshot({ path: 'resultado-login.png', fullPage: true });

  console.log('URL final:', finalUrl);
  console.log('Errores consola:', consoleErrors.length);
  console.log('Errores HTTP:', httpErrors.length);

  if (finalUrl.includes('/Home/Error')) {
    console.log('RESULTADO: FALLA - el login terminó en /Home/Error');
    process.exitCode = 1;
  } else if (finalUrl.endsWith('/login')) {
    console.log('RESULTADO: FALLA - se quedó en /login');
    process.exitCode = 1;
  } else {
    console.log('RESULTADO: OK - login redirigió fuera de /login y /Home/Error');
  }

  await sleep(5000);
  await browser.close();
})();
