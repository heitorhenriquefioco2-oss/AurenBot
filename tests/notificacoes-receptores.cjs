'use strict';
// Integration with Windows receiver protocol on Linux and the Android Java protocol fixture.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.join(__dirname,'..');
 if(!process.env.WINDOWS_TEST_CONFIG)throw Error('Informe WINDOWS_TEST_CONFIG do receptor de teste na porta 18765.');
 const token=JSON.parse(fs.readFileSync(process.env.WINDOWS_TEST_CONFIG,'utf8')).token;
 const cfg={versao:2,ativadas:true,repetir:true,dispositivos:{windows:{ativado:true,endereco:'http://127.0.0.1:18765',chave:token},android:{ativado:true,endereco:'http://127.0.0.1:18766',chave:'a'.repeat(64)}}};
 let listener;
 const sandbox={console,URL,AbortController,TypeError,crypto,setTimeout,clearTimeout,fetch,chrome:{action:{onClicked:{addListener(){}}},runtime:{id:'test',onMessage:{addListener(fn){listener=fn}}},storage:{local:{get:async()=>({aurenNotificacoesV1:cfg})}},permissions:{contains:async()=>true}}};
 vm.createContext(sandbox);sandbox.importScripts=(...names)=>names.forEach(name=>vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),sandbox));vm.runInContext(fs.readFileSync(path.join(root,'background.js'),'utf8'),sandbox);
 const id=crypto.randomUUID();const send=()=>new Promise(resolve=>listener({origem:'auren-avisos-windows',comando:'captcha',eventoId:id,tipo:'sombra'},{id:'test',tab:{id:1},url:'https://auren-online.com/'},resolve));
 const r=await send();assert.equal(r.ok,true,r.erro);assert.equal(r.resultados.length,2);console.log('PASS: mesmo aviso confirmado pelos dois servidores HTTP reais');
 for(const p of Object.values(cfg.dispositivos)) {
  const response=await fetch(p.endereco+'/api/notify',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+p.chave},body:JSON.stringify({id,tipo:'sombra'})});
  assert.equal((await response.json()).duplicado,true);
 }
 console.log('PASS: ambos reconhecem o evento recebido e deduplicam reenvio');
 cfg.dispositivos.android.chave='b'.repeat(64);const partial=await send();assert.equal(partial.ok,false);assert.equal(partial.resultados.find(r=>r.destino==='windows').ok,true);assert.match(partial.resultados.find(r=>r.destino==='android').erro,/chave foi recusada/);console.log('PASS: chave Android incorreta não cancela confirmação Windows');
})().catch(e=>{console.error(e);process.exitCode=1});
