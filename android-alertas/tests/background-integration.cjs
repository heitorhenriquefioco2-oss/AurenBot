'use strict';
// Run against ProtocolTest serve on 127.0.0.1:18766; fixture key is not a real user key.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 let cfg={ativadas:true,endereco:'http://127.0.0.1:18766',chave:'a'.repeat(64)},allowed=true,listener,requests=[];
 const sandbox={console,URL,AbortController,setTimeout,clearTimeout,TypeError,crypto,fetch:async(url,options)=>{requests.push(JSON.parse(options.body));return fetch(url,options)},chrome:{action:{onClicked:{addListener(){}}},runtime:{id:'test-extension',onMessage:{addListener(fn){listener=fn}},openOptionsPage:async()=>{}},permissions:{contains:async()=>allowed},storage:{local:{get:async()=>({aurenNotificacoesV1:cfg})}}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../background.js'),'utf8'),sandbox);
 const send=(msg,sender={id:'test-extension'})=>new Promise(resolve=>{if(listener(msg,sender,resolve)!==true)resolve(undefined)});
 const test={origem:'auren-avisos-windows',comando:'teste'};
 let result=await send(test);assert.equal(result.ok,true,result.erro);assert.deepEqual(Object.keys(requests[0]).sort(),['id','tipo']);console.log('PASS: extensão envia metadados e recebe confirmação do receptor Java');
 cfg.chave='b'.repeat(64);result=await send(test);assert.match(result.erro,/chave foi recusada/);cfg.chave='a'.repeat(64);console.log('PASS: chave incorreta retorna erro à extensão');
 result=await send(test);assert.match(result.erro,/aguardar/);console.log('PASS: limite de frequência retorna erro compreensível');
 allowed=false;const before=requests.length;result=await send(test);assert.match(result.erro,/autorizar/);assert.equal(requests.length,before);allowed=true;console.log('PASS: permissão de host ausente impede envio');
 cfg.ativadas=false;result=await send(test);assert.match(result.erro,/Ative e salve/);assert.equal(requests.length,before);console.log('PASS: desativar avisos impede envio');
 console.log('TOTAL 5');
})().catch(e=>{console.error(e);process.exitCode=1});
