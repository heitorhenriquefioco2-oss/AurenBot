'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const arquivo = path.join(__dirname,'..','segundo-plano-background.js');
const chave = 'aurenAbasSegundoPlanoV1';
const esperar = () => new Promise(setImmediate);
function fixture(initial = {}) {
  const data = structuredClone(initial), tabs = new Map([[1,{autoDiscardable:true}],[2,{autoDiscardable:false}]]);
  let message, alarm, removed;
  const updates = [], alarms = new Map(), sent = [];
  const sandbox = {console,chrome:{
    runtime:{id:'own',onMessage:{addListener:fn=>{message=fn;}}},
    storage:{session:{get:async key=>({[key]:structuredClone(data[key])}),set:async value=>Object.assign(data,structuredClone(value))}},
    alarms:{get:async name=>alarms.get(name),create:async (name,value)=>alarms.set(name,value),clear:async name=>alarms.delete(name),onAlarm:{addListener:fn=>{alarm=fn;}}},
    tabs:{get:async id=>tabs.get(id),update:async (id,value)=>{updates.push({id,...value});Object.assign(tabs.get(id),value);},
      sendMessage:async (id,msg)=>{sent.push({id,msg});return {ativo:tabs.has(id)};},onRemoved:{addListener:fn=>{removed=fn;}}}
  }};
  vm.runInNewContext(fs.readFileSync(arquivo,'utf8'),sandbox);
  return {data,tabs,updates,alarms,sent,
    send:(ativo,sender={id:'own',tab:{id:1},frameId:0,url:'https://auren-online.com/'})=>new Promise(resolve=>{
      if(message({origem:'auren-segundo-plano',ativo},sender,resolve)!==true)resolve(undefined);
    }),
    pulse:async()=>{alarm({name:'auren-segundo-plano'});await esperar();},
    close:async id=>{removed(id);await esperar();}
  };
}
test('agenda pulsos e protege apenas a aba autorizada contra descarte',async()=>{
  const f=fixture();await f.send(true);
  assert.equal(f.tabs.get(1).autoDiscardable,false);
  assert.equal(f.tabs.get(2).autoDiscardable,false);
  assert.equal(f.alarms.get('auren-segundo-plano').periodInMinutes,0.5);
  await f.pulse();assert.equal(f.sent.length,1);assert.equal(f.sent[0].id,1);
});
test('parar restaura descarte automático e remove o alarme',async()=>{
  const f=fixture();await f.send(true);await f.send(false);
  assert.equal(f.tabs.get(1).autoDiscardable,true);
  assert.equal(f.alarms.size,0);
  await f.pulse();assert.equal(f.sent.length,0);
});
test('preserva a preferência anterior de não descartar a aba',async()=>{
  const f=fixture(),sender={id:'own',tab:{id:2},frameId:0,url:'https://www.auren-online.com/game'};
  await f.send(true,sender);await f.send(false,sender);
  assert.equal(f.tabs.get(2).autoDiscardable,false);
  assert.equal(f.updates.filter(v=>v.autoDiscardable===true).length,0);
});
test('reinício do service worker reconstitui alarme sem iniciar automações',async()=>{
  const f=fixture({[chave]:{'1':{autoDiscardable:true}}});await esperar();
  assert.equal(f.alarms.size,1);assert.equal(f.sent.length,0);
});
test('abas fechadas ou sem receptor deixam de receber pulsos',async()=>{
  const f=fixture();await f.send(true);await f.close(1);
  assert.equal(f.alarms.size,0);assert.deepEqual(f.data[chave],{});
  await f.send(true);f.tabs.delete(1);await f.pulse();
  assert.deepEqual(f.data[chave],{});
});
test('recusa mensagens de outro site, outra extensão ou iframe',async()=>{
  const f=fixture();
  for(const sender of [
    {id:'other',tab:{id:1},frameId:0,url:'https://auren-online.com/'},
    {id:'own',tab:{id:1},frameId:1,url:'https://auren-online.com/'},
    {id:'own',tab:{id:1},frameId:0,url:'https://elsewhere.test/'}
  ])assert.equal(await f.send(true,sender),undefined);
  await esperar();assert.equal(f.alarms.size,0);assert.equal(f.updates.length,0);
});
