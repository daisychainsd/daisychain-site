/* eslint-disable @typescript-eslint/no-require-imports -- Optional isolated browser harness. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const origin = process.env.MERCH_TEST_ORIGIN || 'http://127.0.0.1:3117';
(async () => {
  const browser = await chromium.launch({headless:true});
  const context = await browser.newContext({httpCredentials:{username:'staff',password:'merch-local-test'},viewport:{width:1280,height:1000}});
  const page = await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  const base = {livemode:true,email:'fixture@example.invalid',customer_name:'Fixture Person',phone:'',shipping_address:{line1:'123 Example St',city:'San Diego',state:'CA',postal_code:'00123',country:'US'},items:[{variant_id:null,title:'Vinyl with download',variant_title:'Default Title',sku:'',quantity:2,unit_price_cents:4000,line_total_cents:8000}],currency:'usd',subtotal_cents:8000,shipping_cents:800,discount_cents:0,tax_cents:0,total_cents:8800,payment_status:'paid',fulfillment_status:'shipped',inventory_issue:false,exported_at:null,shipped_at:'2026-03-06T21:41:02Z',tracking_number:null,notes:'Bandcamp source history',confirmation_email_sent_at:null,created_at:'2025-11-11T18:19:57Z'};
  const bandcamp = {...base,id:'00000000-0000-4000-8000-000000000005',order_number:5,source:'bandcamp',source_order_id:'123:1001',source_data:{payment_id:1001},stripe_session_id:null,stripe_payment_intent_id:null};
  const website = {...base,id:'00000000-0000-4000-8000-000000000001',order_number:1,source:'website',stripe_session_id:'cs_fixture'};
  const observed=[];
  await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin!==origin) return route.abort();
    if(url.pathname==='/api/ops/merch') {
      const source=url.searchParams.get('source'); const status=url.searchParams.get('status'); observed.push(source);
      if(observed.length===1) assert.equal(status,'unshipped');
      return route.fulfill({json:{orders:[website,bandcamp].filter(o=>(source==='all'||o.source===source)&&(status==='all'||status==='unshipped'&&o.fulfillment_status!=='shipped'||o.fulfillment_status===status)),products:[],adjustments:[],newOrders:0}});
    }
    if(url.pathname==='/api/ops/merch/bandcamp-review') {
      const body=req.postDataJSON(); assert.equal(body.id,bandcamp.id); assert.deepEqual(body.snapshot,bandcamp.source_data.pending);
      bandcamp.shipping_address=bandcamp.source_data.pending.shipping_address;
      bandcamp.source_data={payment_id:1001,review_needed:false};
      return route.fulfill({json:{ok:true}});
    }
    if(url.pathname==='/api/ops/merch/order') {
      const body=req.postDataJSON(); assert.equal(body.id,bandcamp.id); assert.equal(body.notes,bandcamp.notes);
      bandcamp.fulfillment_status=body.status; bandcamp.shipped_at=body.status==='shipped'?'2026-09-22T20:00:00Z':null;
      return route.fulfill({json:{ok:true}});
    }
    return route.continue();
  });
  await page.goto(`${origin}/ops/merch`,{waitUntil:'networkidle'});
  await page.getByText('Nothing waiting to ship',{exact:true}).waitFor();
  assert.equal(await page.locator('article').count(),0);
  await page.getByRole('button',{name:'View shipped orders',exact:true}).click();
  await page.getByText('DC-00001',{exact:true}).waitFor(); await page.getByText('DC-00005',{exact:true}).waitFor();
  await page.getByLabel(/^Source/).selectOption('bandcamp');
  await page.getByText('DC-00001',{exact:true}).waitFor({state:'detached'});
  await page.getByText('DC-00005',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Mark unshipped',exact:true}).click();
  await page.getByRole('button',{name:'Unshipped',exact:true}).click();
  await page.getByRole('button',{name:'Mark shipped',exact:true}).click();
  await page.getByRole('button',{name:'Shipped',exact:true}).click();
  await page.getByRole('button',{name:'Mark unshipped',exact:true}).waitFor();
  await page.getByText('Fulfillment and notes',{exact:true}).click();
  await page.getByText('Purchase receipt is handled by Bandcamp.',{exact:false}).waitFor();
  assert.equal(bandcamp.fulfillment_status,'shipped'); assert.ok(observed.includes('bandcamp'));
  bandcamp.fulfillment_status='on_hold'; bandcamp.source_data={payment_id:1001,review_needed:true,pending:{customer_name:bandcamp.customer_name,shipping_address:{...bandcamp.shipping_address,line1:'456 Corrected St'},items:bandcamp.items,total_cents:bandcamp.total_cents,currency:'usd'}};
  await page.getByRole('button',{name:'Unshipped',exact:true}).click();
  await page.getByText('Review updated Bandcamp details',{exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Mark shipped',exact:true}).isDisabled(),true);
  await page.getByLabel('Review note',{exact:true}).fill('Checked corrected address and existing label');
  await page.getByRole('button',{name:'Accept updated Bandcamp details',exact:true}).click();
  await page.locator('article address').filter({hasText:'456 Corrected St'}).waitFor();
  assert.equal(await page.getByText('Review updated Bandcamp details',{exact:true}).count(),0);
  assert.equal(bandcamp.fulfillment_status,'on_hold');
  await page.getByRole('button',{name:'Mark shipped',exact:true}).waitFor();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'/tmp/daisy-bandcamp-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
  await page.screenshot({path:'/tmp/daisy-bandcamp-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'All orders',exact:true}).click();
  await page.getByLabel(/^Source/).selectOption('website');
  await page.getByText('DC-00005',{exact:true}).waitFor({state:'detached'}); await page.getByText('DC-00001',{exact:true}).waitFor();
  assert.deepEqual(errors,[]); await browser.close(); console.log('PASS: Bandcamp source filter, grouped items, shipping toggles, receipt copy, desktop/mobile; isolated fixtures only.');
})().catch(e=>{console.error(e);process.exit(1)});
