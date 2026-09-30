import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const bundle = await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import Dashboard from './src/app/ops/merch/MerchDashboard'; createRoot(document.getElementById('root')).render(<Dashboard />);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, outfile: '/private/tmp/dc-product-test.js', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{name:'test-link',setup(b){b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:`import React from 'react'; export default function Link(props){return React.createElement('a',props)}`,resolveDir:process.cwd()}));}}] });
const source = bundle.outputFiles.find(f=>f.path.endsWith('.js')).text;
const tick = () => new Promise(r=>setTimeout(r,10));
async function until(check) { for(let i=0;i<100;i++){ if(check())return;await tick();}assert.fail('UI did not reach expected state'); }
function fixture() {
  return {id:'p',title:'Fixture Tee',handle:'tee',description:'',product_type:'T-Shirt',active:true,images:[{url:'https://example.invalid/tee.png',altText:'Tee photo',width:100,height:100}],options:[{name:'Size',values:['S','M']}],tags:[],merch_variants:['S','M'].map((title,i)=>({id:'v'+i,product_id:'p',title,sku:'DCM0'+(i+1),price_cents:4500,currency:'usd',stock:0,active:true,sort_order:i,selected_options:[{name:'Size',value:title}]}))};
}
async function setup({unknown=false,rejected=false,refreshFailure=false}={}) {
  const product=fixture(); const data={orders:[],products:[product],adjustments:[],newOrders:0};
  const calls=[];const applied=new Set();let drop=unknown;let reject=rejected;let failLoad=false;let savedProduct;
  const dom=new JSDOM('<div id="root"></div>',{url:'https://ops.example.invalid',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){w.structuredClone=structuredClone;w.fetch=async(url,options={})=>{
    if(String(url).endsWith('/inventory')){
      const body=JSON.parse(options.body);calls.push(body);
      if(reject&&body.variantId==='v1'){reject=false;return {ok:false,status:409,json:async()=>({error:'Count changed'})};}
      const v=product.merch_variants.find(v=>v.id===body.variantId);
      if(!applied.has(body.requestId)){v.stock+=body.delta;applied.add(body.requestId);}
      if(drop){drop=false;throw new Error('Lost response');}
      if(refreshFailure)failLoad=true;
      return {ok:true,json:async()=>({stock:v.stock})};
    }
    if(String(url).endsWith('/product')){savedProduct=JSON.parse(options.body);data.products=[savedProduct];return {ok:true,json:async()=>({ok:true})};}
    if(failLoad){failLoad=false;return {ok:false,json:async()=>({error:'Refresh failed'})};}
    return {ok:true,json:async()=>structuredClone(data)};
  };}});
  dom.window.eval(source); const doc=dom.window.document;
  const button=(name)=>[...doc.querySelectorAll('button')].find(b=>b.textContent===name||b.getAttribute('aria-label')===name);
  await until(()=>button('Inventory'));button('Inventory').click();await until(()=>button('Manage Fixture Tee'));
  function fill(input,value){Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));}
  const quantity=size=>[...doc.querySelectorAll('label')].find(l=>l.textContent.includes(`Quantity change for ${size}`))?.querySelector('input');
  const open=async()=>{button('Manage Fixture Tee').click();await until(()=>quantity('S'));};
  const save=async()=>{button('Save stock changes').click();await until(()=>button('Save stock changes')||button('Retry remaining changes'));await tick();};
  return {dom,doc,product,calls,button,fill,quantity,open,save,getSaved:()=>savedProduct};
}

test('thumbnail opens only that product; batch saves size inputs, refresh failure never replays confirmed writes',async()=>{
  const t=await setup({refreshFailure:true});try{
    assert.equal(t.doc.querySelector('img').alt,'Tee photo');await t.open();assert.equal(t.doc.querySelectorAll('select').length,0);
    t.fill(t.quantity('S'),'3');t.fill(t.quantity('M'),'5');await tick();await t.save();
    await until(()=>t.calls.length===2&&t.quantity('S').value==='');
    assert.deepEqual(t.product.merch_variants.map(v=>v.stock),[3,5]);
    assert.match(t.doc.body.textContent,/Recent activity could not refresh/);
    t.fill(t.quantity('S'),'3');await tick();await t.save();await until(()=>t.calls.length===3);
    assert.notEqual(t.calls[0].requestId,t.calls[2].requestId);assert.equal(t.product.merch_variants[0].stock,6);
  }finally{t.dom.window.close();}
});
test('unknown save locks navigation; retry uses the same key and continues remaining sizes exactly once',async()=>{
  const t=await setup({unknown:true});try{
    await t.open();t.fill(t.quantity('S'),'3');t.fill(t.quantity('M'),'5');await tick();await t.save();
    await until(()=>t.button('Retry remaining changes'));assert.equal(t.button('All products').disabled,true);assert.equal(t.button('Orders').disabled,true);
    t.button('Retry remaining changes').click();await until(()=>t.calls.length===3&&t.quantity('M').value==='');
    assert.equal(t.calls[0].requestId,t.calls[1].requestId);assert.deepEqual(t.product.merch_variants.map(v=>v.stock),[3,5]);
  }finally{t.dom.window.close();}
});
test('partial rejection clears saved sizes and leaves only remaining changes to retry',async()=>{
  const t=await setup({rejected:true});try{
    await t.open();t.fill(t.quantity('S'),'2');t.fill(t.quantity('M'),'4');await tick();await t.save();
    await until(()=>t.doc.body.textContent.includes('Count changed'));
    assert.equal(t.quantity('S').value,'');assert.equal(t.quantity('M').value,'4');
    await t.save();await until(()=>t.calls.length===3);assert.deepEqual(t.product.merch_variants.map(v=>v.stock),[2,4]);
  }finally{t.dom.window.close();}
});
test('size editor supports renaming, next DCM SKU, inherited price and duplicate prevention',async()=>{
  const t=await setup();try{
    await t.open();t.button('Edit product & sizes').click();await until(()=>t.button('Add size / option'));
    const size=[...t.doc.querySelectorAll('label')].find(l=>l.textContent==='Size / option').querySelector('input');t.fill(size,'XS');
    const add=t.doc.querySelector('input[id="variant-p"]');t.fill(add,'L');t.button('Add size / option').click();await tick();
    assert.ok([...t.doc.querySelectorAll('input')].some(i=>i.value==='DCM03'));
    t.fill(add,'L');t.button('Add size / option').click();await tick();assert.match(t.doc.body.textContent,/already exists/);
    t.button('Save product').click();await until(()=>t.getSaved());
    assert.equal(t.getSaved().merch_variants.length,3);assert.equal(t.getSaved().merch_variants[0].selected_options[0].value,'XS');
    assert.equal(t.getSaved().merch_variants[2].price_cents,4500);assert.equal(t.getSaved().merch_variants[2].sku,'DCM03');
  }finally{t.dom.window.close();}
});

test('thumbnail zoom and positioning persist on save, appear on cards, and reset without replacing the photo',async()=>{
  const t=await setup();try{
    await t.open();t.button('Edit product & sizes').click();await until(()=>t.button('Reset to full photo'));
    const original=t.doc.querySelector('img[alt="Thumbnail crop preview"]').src;
    const toggle=[...t.doc.querySelectorAll('label')].find(l=>l.textContent==='Crop to fill square').querySelector('input');
    toggle.click();await tick();
    t.fill(t.doc.querySelector('[aria-label="Thumbnail zoom"]'),'1.75');await tick();
    t.fill(t.doc.querySelector('[aria-label="Thumbnail horizontal position"]'),'30');await tick();
    t.fill(t.doc.querySelector('[aria-label="Thumbnail vertical position"]'),'70');await tick();
    const preview=t.doc.querySelector('img[alt="Thumbnail crop preview"]');
    assert.equal(preview.style.transform,'scale(1.75)');assert.equal(preview.style.objectPosition,'30% 70%');
    t.button('Save product').click();await until(()=>t.getSaved());
    assert.deepEqual(t.getSaved().images[0].thumbnailCrop,{zoom:1.75,x:30,y:70});assert.equal(t.getSaved().images[0].url,original);
    await until(()=>t.button('Edit product & sizes') && !t.button('All products').disabled);
    t.button('All products').click();await until(()=>t.button('Manage Fixture Tee'));
    assert.equal(t.button('Manage Fixture Tee').querySelector('img').style.transform,'scale(1.75)');
    await t.open();t.button('Edit product & sizes').click();await until(()=>t.button('Reset to full photo'));
    t.button('Reset to full photo').click();await tick();
    assert.equal(t.doc.querySelector('img[alt="Thumbnail crop preview"]').style.objectFit,'contain');
    t.button('Save product').click();await tick();assert.equal(t.getSaved().images[0].thumbnailCrop,undefined);
  }finally{t.dom.window.close();}
});
