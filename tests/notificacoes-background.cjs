'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const keyW = 'w'.repeat(64), keyA = 'a'.repeat(64);
function dual() { return {versao:2, ativadas:true, repetir:true, dispositivos:{windows:{ativado:true,endereco:'http://100.70.0.1:8765',chave:keyW},android:{ativado:true,endereco:'http://100.70.0.2:8765',chave:keyA}}}; }
function fixture(cfg=dual(), options={}) {
  let listener; const calls=[],permissions=[];
  const sandbox={console,URL,AbortController,TypeError,crypto,setTimeout:options.timer || setTimeout,clearTimeout,
    chrome:{action:{onClicked:{addListener(){}}},runtime:{id:'own',onMessage:{addListener(fn){listener=fn}},openOptionsPage:async()=>{}},storage:{local:{get:async()=>({aurenNotificacoesV1:cfg})}},permissions:{contains:async obj=>{permissions.push(obj);return options.permission ? options.permission(obj) : true;}}},
    fetch:async (url,opt)=>{calls.push({url,opt});return options.fetch ? options.fetch(url,opt) : {ok:true,json:async()=>({ok:true})};}
  };
  vm.createContext(sandbox);
  sandbox.importScripts=(...names)=>names.forEach(name=>vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),sandbox));
  vm.runInContext(fs.readFileSync(path.join(root,'background.js'),'utf8'),sandbox);
  const send=(overrides={},sender={id:'own',tab:{id:1},url:'https://auren-online.com/hunt'})=>new Promise(resolve=>{
    if(listener({origem:'auren-avisos-windows',comando:'captcha',eventoId:'event-1',tipo:'sombra',...overrides},sender,resolve)!==true)resolve(undefined);
  });
  return {calls,permissions,send,normalizar:v=>sandbox.aurenConfigNotificacoes.normalizar(v)};
}
const plain=v=>JSON.parse(JSON.stringify(v));
test('migra endereço/chave legados só para seu dispositivo sem perder flags',()=>{
  const f=fixture();for(const id of ['windows','android']) {
    const c=f.normalizar({destino:id,ativadas:false,repetir:false,endereco:'http://100.70.0.3:8765',chave:keyA});
    assert.equal(c.dispositivos[id].endereco,'http://100.70.0.3:8765');assert.equal(c.dispositivos[id].chave,keyA);assert.equal(c.dispositivos[id].ativado,true);assert.equal(c.dispositivos[id==='windows'?'android':'windows'].chave,'');assert.equal(c.ativadas,false);assert.equal(c.repetir,false);
  }
});
test('configuração vazia começa desativada e perfis V2 desmarcados mantêm os dados',()=>{
  const f=fixture();const fresh=f.normalizar(undefined);assert.equal(fresh.ativadas,false);assert.equal(fresh.dispositivos.windows.ativado,false);assert.equal(fresh.dispositivos.android.ativado,false);
  const cfg=dual();cfg.dispositivos.android.ativado=false;assert.deepEqual(plain(f.normalizar(cfg)),cfg);
});
test('dispara para os dois antes de aguardar resposta de qualquer receptor',async()=>{
  const pending=[];const f=fixture(dual(),{fetch:(url,opt)=>new Promise(resolve=>pending.push({url,opt,resolve}))});
  const response=f.send();await new Promise(setImmediate);assert.equal(pending.length,2);
  for(const p of pending)p.resolve({ok:true,json:async()=>({ok:true})});
  const result=await response;assert.equal(result.ok,true);assert.equal(result.resultados.length,2);
  for(const c of f.calls){assert.deepEqual(JSON.parse(c.opt.body),{id:'event-1',tipo:'sombra'});assert.equal(c.opt.redirect,'error');assert.equal(c.opt.headers.Authorization,'Bearer '+(c.url.includes('0.1:')?keyW:keyA));}
});
test('erro de autenticação em um receptor não impede sucesso do outro',async()=>{
  const f=fixture(dual(),{fetch:async url=>url.includes('0.1:')?{ok:false,status:401}:{ok:true,json:async()=>({ok:true})}});
  const result=await f.send();assert.equal(result.ok,false);assert.equal(result.resultados.find(r=>r.destino==='android').ok,true);assert.match(result.erro,/Windows: A chave foi recusada/);assert.ok(!JSON.stringify(result).includes(keyW));assert.ok(!JSON.stringify(result).includes(keyA));
});
test('permissão ausente para Windows mantém envio Android independente',async()=>{
  const f=fixture(dual(),{permission:obj=>!obj.origins[0].includes('0.1/')});const r=await f.send();assert.equal(r.ok,false);assert.equal(r.resultados.find(r=>r.destino==='android').ok,true);assert.equal(f.calls.length,1);assert.match(f.calls[0].url,/0\.2:8765/);
});
test('timeout não cancela o envio ao outro receptor',async()=>{
  const f=fixture(dual(),{timer:(cb,ms)=>setTimeout(cb,ms===5000?10:ms),fetch:(url,opt)=>url.includes('0.1:')?new Promise((resolve,reject)=>opt.signal.addEventListener('abort',()=>reject(Object.assign(new Error(),{name:'AbortError'})))):Promise.resolve({ok:true,json:async()=>({ok:true})})});
  const r=await f.send();assert.equal(r.resultados.find(r=>r.destino==='android').ok,true);assert.match(r.resultados.find(r=>r.destino==='windows').erro,/Não consegui alcançar/);
});
test('perfil desativado não é enviado e suas credenciais não são apagadas',async()=>{
  const cfg=dual();cfg.dispositivos.windows.ativado=false;const before=JSON.stringify(cfg),f=fixture(cfg);const r=await f.send();assert.equal(r.ok,true);assert.equal(f.calls.length,1);assert.equal(r.resultados[0].destino,'android');assert.equal(JSON.stringify(cfg),before);
});
test('teste específico envia somente para Android',async()=>{
  const f=fixture();const r=await f.send({comando:'teste',destino:'android'});assert.equal(r.ok,true);assert.equal(f.calls.length,1);assert.equal(r.resultados[0].destino,'android');assert.notEqual(JSON.parse(f.calls[0].opt.body).id,'event-1');
});
test('requisição específica não reenvia para o receptor já confirmado',async()=>{
  const f=fixture();await f.send({destino:'windows'});await f.send({destino:'android'});assert.equal(f.calls.length,2);assert.equal(JSON.parse(f.calls[0].opt.body).id,JSON.parse(f.calls[1].opt.body).id);
});
test('configuração legada continua funcionando antes de abrir as opções',async()=>{
  const f=fixture({ativadas:true,destino:'android',endereco:'http://100.70.0.2:8765',chave:keyA});const r=await f.send();assert.equal(r.ok,true);assert.equal(r.resultados[0].destino,'android');assert.equal(f.calls.length,1);
});
test('desativação global, nenhum perfil e teste de perfil desativado não enviam',async()=>{
  const cfg=dual();cfg.ativadas=false;let f=fixture(cfg);assert.match((await f.send()).erro,/Ative e salve/);assert.equal(f.calls.length,0);
  cfg.ativadas=true;cfg.dispositivos.windows.ativado=false;cfg.dispositivos.android.ativado=false;f=fixture(cfg);assert.equal((await f.send()).ok,false);assert.equal(f.calls.length,0);assert.match((await f.send({destino:'android'})).erro,/Ative e salve o envio/);
});
test('remetente, origem e destino inválidos não acionam receptores',async()=>{
  const f=fixture();assert.equal(await f.send({},{id:'other'}),undefined);assert.equal(await f.send({},{id:'own',tab:{id:1},url:'https://evil.example/'}),undefined);assert.equal((await f.send({destino:'other'})).ok,false);assert.equal(f.calls.length,0);
});
test('falha de validação de um perfil não bloqueia o outro',async()=>{
  const cfg=dual();cfg.dispositivos.windows.chave='bad';const f=fixture(cfg);const r=await f.send();assert.equal(r.resultados.find(r=>r.destino==='windows').ok,false);assert.equal(r.resultados.find(r=>r.destino==='android').ok,true);assert.equal(f.calls.length,1);
});
