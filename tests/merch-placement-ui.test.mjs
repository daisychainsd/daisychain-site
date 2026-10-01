import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const result=await build({stdin:{contents:`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {MerchProductInput} from './src/sanity/components/MerchProductInput';function App(){const [value,setValue]=useState('');return <><MerchProductInput value={value} elementProps={{id:'product'}} onChange={patch=>setValue(patch.type==='set'?patch.value:'')} /><output>{value}</output></>};createRoot(document.getElementById('root')).render(<App/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,jsx:'automatic',plugins:[{name:'sanity-patches',setup(b){b.onResolve({filter:/^sanity$/},()=>({path:'sanity',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export const set=value=>({type:'set',value});export const unset=()=>({type:'unset'});`}))}}]});
const source=result.outputFiles[0].text;
const tick=()=>new Promise(r=>setTimeout(r,10));
async function until(check){for(let i=0;i<100;i++){if(check())return;await tick();}assert.fail('Expected UI state did not appear');}

test('Sanity picker filters sold-out choices, preserves saved IDs through stock changes, and restores restocked choices',async()=>{
 const tee={id:'p1',title:'Original Tee',handle:'tee',available:true,imageUrl:null,price:{amount:'27.00',currencyCode:'USD'}};
 let products=[tee,{...tee,id:'p2',title:'Archived Tee',available:false}];
 let now=Date.now();let calls=0;
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.invalid/studio',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){w.Date.now=()=>now;w.fetch=async url=>{assert.equal(url,'/api/merch-products');calls++;return {ok:true,json:async()=>({products})}}}});
 try{
  dom.window.eval(source);const doc=dom.window.document;await until(()=>doc.querySelectorAll('option').length===2);
  assert.equal(doc.querySelector('option[value="p2"]'),null);
  const select=doc.querySelector('select');select.value='p1';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await until(()=>doc.querySelector('output').textContent==='p1');assert.match(doc.body.textContent,/\$27.00/);
  products=[{...products[0],title:'Renamed Tee',price:{amount:'33.75',currencyCode:'USD'},available:false}];now+=60001;dom.window.dispatchEvent(new dom.window.Event('focus'));await until(()=>doc.body.textContent.includes('Renamed Tee'));assert.match(doc.body.textContent,/\$33.75/);assert.match(doc.body.textContent,/sold out/i);assert.equal(doc.querySelector('output').textContent,'p1');
  assert.equal(doc.querySelector('option[value="p1"]').disabled,true);assert.match(doc.body.textContent,/No published products are currently in stock/);
  products=[{...products[0],available:true}];now+=60001;dom.window.dispatchEvent(new dom.window.Event('focus'));await until(()=>!doc.querySelector('option[value="p1"]').disabled);assert.equal(select.value,'p1');assert.doesNotMatch(doc.body.textContent,/No published products are currently in stock/);
  products=[];now+=60001;dom.window.dispatchEvent(new dom.window.Event('focus'));await until(()=>doc.body.textContent.includes('Unavailable product'));assert.equal(select.value,'p1');assert.equal(doc.querySelector('output').textContent,'p1');assert.equal(calls,4);
  select.value='';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await until(()=>doc.querySelector('output').textContent==='');
 }finally{dom.window.close();}
});
