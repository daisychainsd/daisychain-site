import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const product={id:'p',handle:'hoodie',title:'Hoodie',productType:'',description:'',discountPercent:40,images:{edges:[
 {node:{url:'https://example.invalid/front.jpg',altText:'Front',thumbnailCrop:{zoom:1.25,x:40,y:65}}},
 {node:{url:'https://example.invalid/back.jpg',altText:'Back'}},
 {node:{url:'https://example.invalid/detail.jpg',altText:'Detail',thumbnailCrop:{zoom:2,x:60,y:30}}},
]},options:[{name:'Size',values:['L','S','M']}],variants:{edges:[
 {node:{id:'v-l',title:'L',availableForSale:false,selectedOptions:[{name:'Size',value:'L'}],price:{amount:'39.00',currencyCode:'USD'},compareAtPrice:{amount:'65.00',currencyCode:'USD'}}},
 {node:{id:'v-s',title:'S',availableForSale:true,selectedOptions:[{name:'Size',value:'S'}],price:{amount:'39.00',currencyCode:'USD'},compareAtPrice:{amount:'65.00',currencyCode:'USD'}}},
 {node:{id:'v-m',title:'M',availableForSale:true,selectedOptions:[{name:'Size',value:'M'}],price:{amount:'42.00',currencyCode:'USD'},compareAtPrice:{amount:'70.00',currencyCode:'USD'}}},
]}};
const result=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Detail from './src/app/shop/[handle]/ProductDetail';import {CartProvider,useCart} from './src/components/CartProvider';function Cart(){const {items,hydrated}=useCart();return <output data-hydrated={hydrated}>{JSON.stringify(items)}</output>}createRoot(document.getElementById('root')).render(<CartProvider><Detail product={${JSON.stringify(product)}}/><Cart/></CartProvider>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,jsx:'automatic',plugins:[{name:'next-link',setup(b){b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`import React from 'react';export default function Link(props){return React.createElement('a',props)}`,resolveDir:process.cwd()}))}}]});
const tick=()=>new Promise(r=>setTimeout(r,10));
async function until(check){for(let i=0;i<100;i++){if(check())return;await tick();}assert.fail('Expected UI state did not appear');}

test('product opens on an available size, updates sale comparison per size, and adds the effective price to cart',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.invalid/shop/hoodie',runScripts:'dangerously',pretendToBeVisual:true});
 try{
  dom.window.eval(result.outputFiles[0].text);const doc=dom.window.document;
  const button=name=>[...doc.querySelectorAll('button')].find(b=>b.textContent===name);
  await until(()=>button('Add to Cart') && doc.querySelector('output').getAttribute('data-hydrated')==='true');
  assert.equal(button('Add to Cart').disabled,false);assert.equal(button('L').disabled,true);assert.equal(doc.querySelector('s').textContent,'$65.00');
  button('Add to Cart').click();await until(()=>doc.querySelector('output').textContent.includes('v-s'));
  let cart=JSON.parse(doc.querySelector('output').textContent);assert.equal(cart[0].price,39);assert.equal(cart[0].variantId,'v-s');
  button('M').click();await until(()=>doc.querySelector('s').textContent==='$70.00');assert.match(doc.querySelector('[aria-live="polite"]').textContent,/\$42.00/);assert.match(doc.body.textContent,/40% OFF/);
  button('Add to Cart').click();await until(()=>doc.querySelector('output').textContent.includes('v-m'));
  cart=JSON.parse(doc.querySelector('output').textContent);assert.equal(cart[1].price,42);
 }finally{dom.window.close();}
});


test('product gallery uses each image’s saved crop and resets framing for an uncropped image',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.invalid/shop/hoodie',runScripts:'dangerously',pretendToBeVisual:true});
 try{
  dom.window.eval(result.outputFiles[0].text);const doc=dom.window.document;
  await until(()=>doc.querySelectorAll('img').length===4);
  const hero=()=>doc.querySelector('img');const thumbnails=()=>doc.querySelectorAll('button img');
  assert.equal(hero().src,'https://example.invalid/front.jpg');
  assert.equal(hero().style.objectFit,'cover');assert.equal(hero().style.objectPosition,'40% 65%');assert.equal(hero().style.transform,'scale(1.25)');
  thumbnails()[1].parentElement.click();await until(()=>hero().src.endsWith('/back.jpg'));
  assert.equal(hero().style.objectFit,'contain');assert.equal(hero().style.transform,'');assert.equal(hero().style.objectPosition,'');
  thumbnails()[2].parentElement.click();await until(()=>hero().src.endsWith('/detail.jpg'));
  assert.equal(hero().style.objectPosition,'60% 30%');assert.equal(hero().style.transform,'scale(2)');
  thumbnails()[0].parentElement.click();await until(()=>hero().src.endsWith('/front.jpg'));
  assert.equal(hero().style.objectPosition,'40% 65%');assert.equal(hero().style.transform,'scale(1.25)');
 }finally{dom.window.close();}
});
