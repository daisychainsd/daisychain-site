import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const result=await build({stdin:{contents:`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {MerchProductInput,MerchProductsInput} from './src/sanity/components/MerchProductInput';function List(){const [items,setItems]=useState([{_key:'a',productId:'p3'}]);return <MerchProductsInput value={items} onChange={patches=>setItems([...items,...patches[1].items])} renderDefault={p=><ol>{p.value.map(i=><li key={i._key}>{i.productId}</li>)}</ol>} />};function App(){const [value,setValue]=useState('');return <><List/><MerchProductInput value={value} path={['merch','products',{_key:'x'},'productId']} elementProps={{id:'product'}} onChange={patch=>setValue(patch.type==='set'?patch.value:'')} /><output>{value}</output></>};createRoot(document.getElementById('root')).render(<App/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,jsx:'automatic',plugins:[{name:'sanity-patches',setup(b){b.onResolve({filter:/^sanity$/},()=>({path:'sanity',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export const set=value=>({type:'set',value});export const unset=()=>({type:'unset'});export const setIfMissing=value=>({type:'setIfMissing',value});export const insert=(items,position,path)=>({type:'insert',items,position,path});export const useFormValue=()=>[{productId:'p3'}];`}))}}]});
const source=result.outputFiles[0].text;
const tick=()=>new Promise(r=>setTimeout(r,10));
async function until(check){for(let i=0;i<100;i++){if(check())return;await tick();}assert.fail('Expected UI state did not appear');}

test('Sanity picker filters sold-out choices, preserves saved IDs through stock changes, and restores restocked choices',async()=>{
 const tee={id:'p1',title:'Original Tee',handle:'tee',available:true,imageUrl:null,price:{amount:'27.00',currencyCode:'USD'}};
 let products=[tee,{...tee,id:'p2',title:'Archived Tee',available:false},{...tee,id:'p3',title:'Listed Tee'}];
 let now=Date.now();let calls=0;
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.invalid/studio',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){w.Date.now=()=>now;w.fetch=async url=>{assert.equal(url,'/api/merch-products');calls++;return {ok:true,json:async()=>({products})}}}});
 try{
  dom.window.eval(source);const doc=dom.window.document;await until(()=>doc.querySelectorAll('option').length===2);
  assert.equal(doc.querySelector('option[value="p2"]'),null);assert.equal(doc.querySelector('option[value="p3"]'),null);
  const addAll=doc.querySelector('button');assert.match(addAll.textContent,/\(1\)/);addAll.click();await until(()=>doc.querySelector('ol').textContent==='p3p1');assert.equal(doc.querySelector('button'),null);
  const select=doc.querySelector('select');select.value='p1';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await until(()=>doc.querySelector('output').textContent==='p1');assert.match(doc.body.textContent,/\$27.00/);
  products=[{...products[0],title:'Renamed Tee',price:{amount:'33.75',currencyCode:'USD'},available:false}];now+=60001;dom.window.dispatchEvent(new dom.window.Event('focus'));await until(()=>doc.body.textContent.includes('Renamed Tee'));assert.match(doc.body.textContent,/\$33.75/);assert.match(doc.body.textContent,/sold out/i);assert.equal(doc.querySelector('output').textContent,'p1');
  assert.equal(doc.querySelector('option[value="p1"]').disabled,true);assert.match(doc.body.textContent,/No published products are currently in stock/);
  products=[{...products[0],available:true}];now+=60001;dom.window.dispatchEvent(new dom.window.Event('focus'));await until(()=>!doc.querySelector('option[value="p1"]').disabled);assert.equal(select.value,'p1');assert.doesNotMatch(doc.body.textContent,/No published products are currently in stock/);
  products=[];now+=60001;dom.window.dispatchEvent(new dom.window.Event('focus'));await until(()=>doc.body.textContent.includes('Unavailable product'));assert.equal(select.value,'p1');assert.equal(doc.querySelector('output').textContent,'p1');assert.equal(calls,4);
  select.value='';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await until(()=>doc.querySelector('output').textContent==='');
 }finally{dom.window.close();}
});
