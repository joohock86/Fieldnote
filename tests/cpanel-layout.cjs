// Run with Playwright on NODE_PATH. Uses synthetic records; never contacts production.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../cpanel/public');
const output = path.resolve(__dirname, '../dist/layout-check');
const report = {id:'demo-report', customer:'Example facilities management customer', phone:'12345678', email:'long-customer-address@example.com', location:'Example location', equipment:'Air conditioning system', serial:'EXAMPLE-'+ 'A'.repeat(90), technician:'Example technician', date:'2026-10-12', action:'Maintenance', status:'Completed', parts:'Filter', notes:'Example service notes', photos:[]};
const contract = {id:'demo-contract', name:'Example annual maintenance agreement', customer:report.customer, phone:report.phone, email:report.email, location:report.location, equipment:report.equipment, serial:report.serial, notes:'Example contract', start_date:'2026-01-01', end_date:'2027-12-31', first_visit:'2026-01-01', interval_months:3, state:'Active'};

(async () => {
  fs.mkdirSync(output, {recursive:true});
  const browser = await chromium.launch(process.env.FIELDNOTE_BROWSER ? {executablePath:process.env.FIELDNOTE_BROWSER} : {channel:'msedge'});
  const failures = [];
  try {
    for (const width of [320,375,390,430,768,1024,1440]) {
      const context = await browser.newContext({viewport:{width,height:900}});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      let authenticated = false;
      await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.hostname !== 'fieldnote.test') return route.abort();
        if (url.pathname === '/api.php') {
          const action = url.searchParams.get('action');
          if (action === 'me' && !authenticated) return route.fulfill({status:401,json:{error:'Sign in required'}});
          if (action === 'login') { authenticated=true; return route.fulfill({json:{email:'long-team-address@example.com',id:'demo-user'}}); }
          if (action === 'reports') return route.fulfill({json:[report]});
          if (action === 'contracts') return route.fulfill({json:[contract]});
          throw new Error('Unexpected API action: '+action);
        }
        const name = url.pathname === '/' ? 'index.html' : path.basename(url.pathname);
        await route.fulfill({body:fs.readFileSync(path.join(root,name)),contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html'});
      });
      async function check(name) {
        const result = await page.evaluate(() => ({
          width:innerWidth, scroll:document.documentElement.scrollWidth,
          dialog:[...document.querySelectorAll('.modal:not(.hidden) .dialog')].map(el=>({width:el.clientWidth,scroll:el.scrollWidth})),
          inputSizes:[...document.querySelectorAll('input:not([type=checkbox]),select,textarea')].filter(el=>el.offsetParent!==null).map(el=>parseFloat(getComputedStyle(el).fontSize))
        }));
        if(result.scroll>width+1||result.dialog.some(d=>d.scroll>d.width+1)) failures.push({width,name,...result});
        if(width<=720 && result.inputSizes.some(size=>size<16)) failures.push({width,name,issue:'Input text below 16px can trigger iPhone zoom'});
        if([375,1440].includes(width)) await page.screenshot({path:path.join(output,`${width}-${name}.png`),fullPage:!result.dialog.length});
      }
      await page.goto('http://fieldnote.test/');
      await check('login');
      await page.locator('#login-email').fill('test@example.com');
      await page.locator('#login-password').fill('synthetic-test-password');
      await page.locator('#login-submit').click();
      await page.locator('[data-id="demo-report"]').waitFor();
      await check('reports');
      await page.locator('[data-id="demo-report"]').click();
      await check('report-detail');
      await page.locator('.close').click();
      await page.locator('#new').click();
      await check('report-form');
      await page.locator('.close').click();
      await page.locator('[data-view="customers"]').click();
      await check('customers');
      await page.locator('[data-customer-index]').click();
      await check('customer-detail');
      await page.locator('.close').click();
      await page.locator('[data-view="maintenance"]').click();
      await check('contracts');
      await page.locator('[data-contract]').first().click();
      await check('contract-detail');
      await page.locator('#edit-contract').click();
      await check('contract-form');
      await page.locator('.close').click();
      await page.getByRole('button',{name:'Scheduled visits',exact:true}).click();
      await check('scheduled-visits');
      assert.deepEqual(errors,[],`Browser errors at ${width}px`);
      await context.close();
      console.log(`Checked login, reports, customers, contracts, visits and forms at ${width}px`);
    }
  } finally { await browser.close(); }
  assert.deepEqual(failures,[],JSON.stringify(failures,null,2));
  console.log('cPanel responsive layout checks passed; synthetic screenshots in dist/layout-check.');
})().catch(error=>{console.error(error);process.exit(1)});
