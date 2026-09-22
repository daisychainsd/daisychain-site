/* eslint-disable @typescript-eslint/no-require-imports -- Standalone optional Node browser harness. */
// Run against the isolated local server documented in tests/MERCH-BROWSER.md.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.MERCH_TEST_ORIGIN || 'http://127.0.0.1:3105';
const unknownOutcome = process.argv.includes('--unknown-outcome');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true});
  const context = await browser.newContext({httpCredentials:{username:'staff',password:'merch-local-test'},viewport:{width:1280,height:1000}});
  const page = await context.newPage(); const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  const product={id:'p1',title:'Daisy Chain Tee',handle:'daisy-chain-tee',description:'Fixture merch',product_type:'Shirt',active:true,images:[],options:[{name:'Size',values:['M']}],tags:[],merch_variants:[{id:'v1',product_id:'p1',title:'M',sku:'TEE-M',price_cents:3000,currency:'usd',stock:12,active:true,sort_order:0,selected_options:[{name:'Size',value:'M'}]}]};
  const order={id:'00000000-0000-4000-8000-000000000001',order_number:1,stripe_session_id:'cs_fixture',stripe_payment_intent_id:'pi_fixture',livemode:true,email:'fixture@example.invalid',customer_name:'Fixture Person',phone:'+16195550123',shipping_address:{line1:'123 Example St',city:'San Diego',state:'CA',postal_code:'92101',country:'US'},items:[{variant_id:'v1',title:'Daisy Chain Tee',variant_title:'M',sku:'TEE-M',quantity:1,unit_price_cents:3000}],currency:'usd',subtotal_cents:3000,shipping_cents:599,discount_cents:0,tax_cents:0,total_cents:3599,payment_status:'paid',fulfillment_status:'new',inventory_issue:false,exported_at:null,shipped_at:null,tracking_number:null,notes:'',confirmation_email_sent_at:null,created_at:'2026-09-14T12:00:00Z'};
  let adjustment; const adjustmentKeys=[]; let failNextLoad=false;
  await page.route('**/*', async route=>{
    const req=route.request(); const url=new URL(req.url());
    if(url.origin!==origin) return route.abort();
    if(url.pathname==='/api/ops/merch' && failNextLoad) { failNextLoad=false; return route.fulfill({status:503,json:{error:'Simulated refresh failure'}}); }
    if(url.pathname==='/api/ops/merch') return route.fulfill({json:{orders:[order],products:[product],adjustments:[],newOrders:1}});
    if(url.pathname==='/api/ops/merch/order') { const body=req.postDataJSON(); assert.equal(body.tracking,''); order.fulfillment_status=body.status; return route.fulfill({json:{ok:true}}); }
    if(url.pathname==='/api/ops/merch/inventory') {adjustment=req.postDataJSON(); adjustmentKeys.push(adjustment.requestId); if(adjustmentKeys.length===1) { if(unknownOutcome) return route.abort(); failNextLoad=true; } return route.fulfill({json:{stock:9}});}
    if(url.pathname==='/api/ops/merch/export') return route.fulfill({contentType:'text/csv',body:'Order Number,Name\r\nDC-00001,Fixture Person\r\n'});
    return route.continue();
  });
  await page.goto(`${origin}/ops/merch`,{waitUntil:'networkidle'});
  await page.getByText('DC-00001',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Mark shipped',exact:true}).click();
  await page.getByRole('button',{name:'Mark unshipped',exact:true}).click();
  await page.getByRole('button',{name:'Mark shipped',exact:true}).waitFor();
  assert.equal(order.fulfillment_status,'new');
  await page.screenshot({path:'/private/tmp/daisy-merch-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Select eligible'}).click();
  const download=page.waitForEvent('download'); await page.getByRole('button',{name:'Export CSV (1)',exact:true}).click(); await download;
  await page.getByRole('button',{name:'INVENTORY',exact:true}).click();
  await page.getByLabel('Quantity change').fill('-3'); await page.getByLabel('Reason',{exact:true}).fill('Fixture booth sales');
  if (unknownOutcome) {
  await page.getByRole('button',{name:'Save adjustment'}).click();
  await page.getByRole('alert').waitFor();
  await page.getByRole('button',{name:'Save adjustment'}).click();
  await page.getByRole('status').filter({hasText:'Saved.'}).waitFor();
  assert.equal(adjustmentKeys[0],adjustmentKeys[1], 'Unknown write outcome must reuse request key');
  } else {
  await page.getByRole('button',{name:'Save adjustment'}).click();
  await page.getByRole('status').filter({hasText:'Saved, but the list did not refresh'}).waitFor();
  assert.equal(await page.getByLabel('Quantity change').inputValue(),'');
  assert.equal(adjustmentKeys.length,1);
  await page.getByRole('button',{name:'Refresh',exact:true}).click();
  await page.getByLabel('Quantity change').fill('-3'); await page.getByLabel('Reason',{exact:true}).fill('Fixture booth sales');
  await page.getByRole('button',{name:'Save adjustment'}).click();
  await page.getByRole('status').filter({hasText:'Saved.'}).waitFor();
  assert.notEqual(adjustmentKeys[0],adjustmentKeys[1], 'A confirmed save must allow a later identical intentional adjustment');
  }
  assert.equal(adjustment.delta,-3);assert.equal(adjustment.variantId,'v1');
  await page.getByRole('button',{name:'PRODUCTS',exact:true}).click(); await page.getByRole('button',{name:'Edit product'}).click();
  await page.getByLabel('Name',{exact:true}).waitFor(); assert.equal(await page.getByLabel('Name',{exact:true}).inputValue(),'Daisy Chain Tee');
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.setViewportSize({width:390,height:844}); await page.getByRole('button',{name:'ORDERS',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
  await page.screenshot({path:'/private/tmp/daisy-merch-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]); await browser.close(); console.log('PASS: dashboard desktop/mobile, CSV download, manual adjustment and catalog editor; no browser errors. API responses were isolated fixtures.');
})().catch(e=>{console.error(e);process.exit(1)});
