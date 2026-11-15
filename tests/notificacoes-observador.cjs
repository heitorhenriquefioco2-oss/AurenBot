const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});let count=0;
async function test(name,run,cfg={ativadas:true,repetir:true}){
 const p=await browser.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('https://auren-online.com/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><main><h1>Caçada</h1></main>'}));
 await p.addInitScript(cfg=>{window.calls=[];window.fail=false;window.failures={};window.configListener=null;window.chrome={storage:{local:{get:async()=>({aurenNotificacoesV1:cfg})},onChanged:{addListener:fn=>window.configListener=fn}},runtime:{sendMessage:async msg=>{calls.push(msg);return (fail||failures[msg.destino])?{ok:false,erro:'Offline'}:{ok:true};}}};},cfg);
 await p.goto('https://auren-online.com/');await p.clock.install();await p.addScriptTag({path:path.join(__dirname,'../avisos.js')});
 const t={p,tick:n=>p.clock.runFor(n),calls:()=>p.evaluate(()=>calls),show:async(kind='cloudflare',role=true)=>{await p.evaluate(({kind,role})=>{const s=document.createElement('section');s.id='challenge';if(role)s.setAttribute('role','dialog');s.innerHTML='<h2>'+(kind==='sombra'?'De quem é esta sombra?':'A guarda pede um sinal')+'</h2><button id="manual">'+(kind==='sombra'?'Outra sombra':'Apresentar o selo')+'</button>';s.querySelector('button').onclick=()=>{window.clicked=true};document.body.append(s);aurenAvisos.verificar();},{kind,role});await p.waitForTimeout(10);},hide:async()=>{await p.locator('#challenge').evaluate(e=>e.remove());await p.evaluate(()=>aurenAvisos.verificar());},change:cfg=>p.evaluate(cfg=>configListener({aurenNotificacoesV1:{newValue:cfg}},'local'),cfg)};
 try{await run(t);assert.deepEqual(errors,[]);count++;console.log('PASS:',name);}finally{await p.close();}
}
try{
 await test('sem desafio não envia',async t=>{await t.tick(90000);assert.equal((await t.calls()).length,0);});
 await test('desativado não envia mesmo com desafio',async t=>{await t.show();await t.tick(90000);assert.equal((await t.calls()).length,0);},{ativadas:false});
 for(const kind of ['cloudflare','sombra']) await test('detecta '+kind+' sem interagir com desafio',async t=>{await t.show(kind);const c=await t.calls();assert.equal(c.length,1);assert.equal(c[0].tipo,kind);assert.deepEqual(Object.keys(c[0]).sort(),['comando','destino','eventoId','origem','tipo']);assert.equal(await t.p.evaluate(()=>window.clicked),undefined);await t.tick(15000);assert.equal((await t.calls()).length,1);});
 await test('sombra sem role de dialogo também avisa',async t=>{await t.show('sombra',false);assert.equal((await t.calls())[0].tipo,'sombra');});
 await test('repete após um minuto com novo id',async t=>{await t.show();await t.tick(59000);assert.equal((await t.calls()).length,1);await t.tick(2100);const c=await t.calls();assert.equal(c.length,2);assert.notEqual(c[0].eventoId,c[1].eventoId);});
 await test('repetição pode ser desativada',async t=>{await t.show();await t.tick(180000);assert.equal((await t.calls()).length,1);},{ativadas:true,repetir:false});
 await test('falha tenta depois de 30s com mesmo id',async t=>{await t.p.evaluate(()=>fail=true);await t.show();await t.tick(29000);assert.equal((await t.calls()).length,1);await t.tick(2100);const c=await t.calls();assert.equal(c.length,2);assert.equal(c[0].eventoId,c[1].eventoId);});
 await test('falha em lembrete conserva id na nova tentativa',async t=>{await t.show();await t.p.evaluate(()=>fail=true);await t.tick(61000);await t.tick(31000);const c=await t.calls();assert.equal(c.length,3);assert.notEqual(c[0].eventoId,c[1].eventoId);assert.equal(c[1].eventoId,c[2].eventoId);});
 await test('fechar desafio cancela lembretes e novo desafio cria novo aviso',async t=>{await t.show();await t.hide();await t.tick(120000);assert.equal((await t.calls()).length,1);await t.show('sombra');const c=await t.calls();assert.equal(c.length,2);assert.notEqual(c[0].eventoId,c[1].eventoId);});
 await test('desativação em tempo real cancela futuros avisos',async t=>{await t.show();await t.change({ativadas:false});await t.tick(180000);assert.equal((await t.calls()).length,1);});
 await test('ativação em tempo real detecta desafio existente',async t=>{await t.show();assert.equal((await t.calls()).length,0);await t.change({ativadas:true});await t.tick(1000);assert.equal((await t.calls()).length,1);},{ativadas:false});
 await test('parar observador encerra novos avisos',async t=>{await t.show();await t.p.evaluate(()=>aurenAvisos.parar());await t.tick(180000);assert.equal((await t.calls()).length,1);});
 const dual={versao:2,ativadas:true,repetir:true,dispositivos:{windows:{ativado:true},android:{ativado:true}}};
 await test('dois dispositivos recebem avisos sem compartilhar estado de confirmação',async t=>{await t.show();const c=await t.calls();assert.deepEqual(c.map(m=>m.destino).sort(),['android','windows']);assert.notEqual(c[0].eventoId,c[1].eventoId);},dual);
 await test('Windows continua lembrando a cada minuto com Android offline',async t=>{await t.p.evaluate(()=>failures.android=true);await t.show();await t.tick(62000);const c=await t.calls(),w=c.filter(m=>m.destino==='windows'),a=c.filter(m=>m.destino==='android');assert.equal(w.length,2);assert.equal(a.length,3);assert.notEqual(w[0].eventoId,w[1].eventoId);assert.equal(new Set(a.map(m=>m.eventoId)).size,1);},dual);
 await test('falha no Windows não interrompe lembretes Android',async t=>{await t.p.evaluate(()=>failures.windows=true);await t.show();await t.tick(62000);const c=await t.calls();assert.equal(c.filter(m=>m.destino==='android').length,2);assert.equal(c.filter(m=>m.destino==='windows').length,3);},dual);
 await test('sem repetição receptor confirmado não é reenviado durante tentativas do outro',async t=>{await t.p.evaluate(()=>failures.android=true);await t.show();await t.tick(92000);const c=await t.calls();assert.equal(c.filter(m=>m.destino==='windows').length,1);assert.equal(c.filter(m=>m.destino==='android').length,4);},{...dual,repetir:false});
 await test('receptor que volta online confirma tentativa pendente com mesmo id',async t=>{await t.p.evaluate(()=>failures.android=true);await t.show();await t.tick(29000);await t.p.evaluate(()=>failures.android=false);await t.tick(3100);const a=(await t.calls()).filter(m=>m.destino==='android');assert.equal(a.length,2);assert.equal(a[0].eventoId,a[1].eventoId);await t.tick(62000);const all=(await t.calls()).filter(m=>m.destino==='android');assert.equal(all.length,3);assert.notEqual(all[1].eventoId,all[2].eventoId);},dual);
 await test('perfil desmarcado não recebe nem tentativas',async t=>{await t.show();await t.tick(62000);assert.ok((await t.calls()).every(m=>m.destino==='windows'));},{...dual,dispositivos:{windows:{ativado:true},android:{ativado:false}}});
 await test('nenhum perfil ativado não envia',async t=>{await t.show();await t.tick(62000);assert.equal((await t.calls()).length,0);},{...dual,dispositivos:{windows:{ativado:false},android:{ativado:false}}});
 await test('fechar CAPTCHA cancela lembretes nos dois receptores',async t=>{await t.show();await t.hide();await t.tick(120000);assert.equal((await t.calls()).length,2);},dual);
 console.log('TOTAL',count);
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
