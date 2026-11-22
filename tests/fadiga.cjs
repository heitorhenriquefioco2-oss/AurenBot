'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});let count=0;
 async function test(name,run,options={}) {
  if(process.env.TEST_FILTER && !name.includes(process.env.TEST_FILTER))return;
  const p=await browser.newPage({viewport:{width:1280,height:1050}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('https://fadiga.test/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><main><h1>Caçada</h1><button aria-pressed="true" id="mode">Só Resultado</button><button id="monster" aria-pressed="true">Eco errante</button><div class="hunt-vitality"><progress aria-label="Vigor de caçada" max="100" value="60"></progress></div><button id="info" class="item-detail-trigger" aria-label="Detalhes do Vigor" aria-controls="details" popovertarget="details">Detalhes do Vigor</button><div id="details" class="item-detail-popover hunt-health-details" role="dialog" popover="auto"><h3>Vigor nas caçadas</h3><button id="closeInfo" class="item-detail-close" aria-label="Fechar detalhes do Vigor">Fechar</button><dl><dt>Vigor necessário</dt><dd>29%</dd><dt>Custo em Vigor</dt><dd>29%</dd></dl><div id="fatigue" class="hunt-fatigue"></div><p>Cada vitória soma 1 ponto de fadiga.</p><p id="wins">380 caçadas hoje.</p></div><section class="hunt-supplies"><button id="minor" class="hunt-potion-use" aria-label="Usar poção de vigor">+40%</button><button id="major" class="hunt-potion-use" aria-label="Usar poção de vigor maior">+100%</button></section><button id="attack">Caçar</button></main>`}));
  await p.addInitScript(options=>{
   window.game={hp:options.hp??60,f:options.f??40,major:options.major??1000,minor:options.minor??1000,counts:{attack:0,major:0,minor:0,close:0},maxF:options.f??40,flags:{...options.flags}};
   const prefs={criatura:'Eco errante',modo:'pocao',atacar:'80',limite:'30',limiteAlivio:'100',economizar:false,margem:'5',continuarOculta:true,controlarFadiga:true,limiteFadiga:'100',...options.prefs};
   window.chrome={storage:{local:{get:async key=>key==='aurenNotificacoesV1'?{aurenNotificacoesV1:{ativadas:false}}:{aurenPreferenciasV33:JSON.parse(localStorage.getItem('prefs')||'null')||prefs},set:async value=>{if(value.aurenPreferenciasV33)localStorage.setItem('prefs',JSON.stringify(value.aurenPreferenciasV33));}}},runtime:{id:'test',onMessage:{addListener(){}}}};
   window.render=()=>{
    const g=game,fmt=n=>n.toLocaleString('pt-BR'),after=Math.max(0,g.f-15),card=document.getElementById('fatigue');
    document.querySelector('progress').value=g.hp;
    document.getElementById('minor').disabled=g.minor===0||g.hp>=100;document.getElementById('major').disabled=g.major===0||g.hp>=100||g.flags.majorDisabled;
    document.getElementById('major').title=g.hp>=100?'Seu Vigor já está completo':g.major===0?'Sem poções na mochila':'Poção de vigor maior';
    for(const id of ['minor','major']){
     const botao=document.getElementById(id);
     botao.querySelector('.hunt-potion-quantity')?.remove();
     botao.insertAdjacentHTML('beforeend',`<span class="hunt-potion-quantity">×${g[id]}</span>`);
    }
    card.innerHTML=`<div role="img" aria-label="Fadiga: ${g.f>=300?'Exausto':g.f>=100?'Cansado':'Descansado'}"><div class="hunt-fatigue-heading"><strong>Fadiga</strong><span>${g.f>=100?'Cansado':'Descansado'}</span></div><div class="hunt-fatigue-track" style="--hunt-fatigue-current:${g.f===0?0:Math.max(.01,g.f/Math.max(200,g.f+480)*100)}%"></div></div>${g.f>0?`<div class="hunt-fatigue-preview"><span class="hunt-fatigue-relief">−${fmt(g.f-after)} com a poção maior</span><strong><span aria-hidden="true">${fmt(g.f)} → ${fmt(after)}</span><span class="realm-sr-only">Fadiga de ${fmt(g.f)} para ${fmt(after)}</span></strong></div>`:''}<small class="hunt-fatigue-cost">Custo deste alvo segue em 29 de Vigor</small>`;
   };
   window.result=()=>{const r=document.createElement('div');r.id='result';r.setAttribute('role','dialog');r.innerHTML='<h2>Caçada concluída</h2><p>Vitória</p><button id="continue">Continuar</button>';r.querySelector('button').onclick=()=>{game.counts.close++;r.remove();if(game.flags.directResult)document.getElementById('mode').disabled=false;};document.body.append(r);};
   document.addEventListener('DOMContentLoaded',()=>{render();document.addEventListener('click',e=>{
    const id=e.target.closest('button')?.id,g=game;
    if(id==='mode'&&!g.flags.directResult){g.modeClicks=(g.modeClicks||0)+1;document.getElementById('mode').setAttribute('aria-pressed','true');}
    if(id==='closeInfo')document.getElementById('details').hidePopover();
    if(id==='minor'){g.counts.minor++;g.minor--;if(g.flags.apply!==false)g.hp=Math.min(100,g.hp+40);render();}
    if(id==='major'){(g.usosMaior??=[]).push({hp:g.hp,f:g.f});g.counts.major++;g.major--;if(g.flags.apply!==false){g.hp=100;if(!g.flags.onlyVigor)g.f=Math.max(0,g.f-15);}render();}
    if(id==='attack'||(id==='mode'&&g.flags.directResult)){g.counts.attack++;if(g.flags.directResult)document.getElementById('mode').disabled=true;if(g.flags.autoResult)setTimeout(()=>{g.hp=Math.max(0,g.hp-29);g.f++;g.maxF=Math.max(g.maxF,g.f);render();result();},1000);}
   });});
  },options);
  await p.goto('https://fadiga.test/');await p.clock.install();
  if(options.flags?.directResult)await p.evaluate(()=>{
   document.getElementById('mode').outerHTML='<div class="hunt-actions"><button id="watch" class="hunt-watch">Assistir combate</button><button id="mode" class="hunt-result"><svg aria-hidden="true"><path d="M0 0"></path></svg><span>Só resultado</span></button><button id="spot" class="hunt-spot-open">Preparar spot</button></div>';
   document.getElementById('attack').remove();
   for(const id of ['watch','spot'])document.getElementById(id).onclick=()=>{throw Error('Ação incorreta de caçada');};
  });
  const load=async()=>{await p.addScriptTag({path:path.join(root,'avisos.js')});await p.addScriptTag({path:path.join(root,'content.js')});await p.waitForFunction(()=>window.aurenCacada);};await load();
  const t={p,load,start:()=>p.evaluate(()=>aurenCacada.iniciar()),tick:n=>p.clock.runFor(n),diag:()=>p.evaluate(()=>aurenCacada.diagnostico()),counts:()=>p.evaluate(()=>game.counts),set:fields=>p.evaluate(fields=>{Object.assign(game,fields);render();},fields),open:()=>p.locator('#info').click(),status:()=>p.locator('#status').textContent()};
  try{await run(t);assert.deepEqual(errors,[]);count++;console.log('PASS:',name);}finally{await p.close();}
 }
 try{
 await test('recupera vigor baixo apenas com a comum, sem gastar maior',async t=>{await t.start();await t.tick(2200);assert.equal((await t.counts()).minor,1);assert.equal((await t.counts()).major,0);},{hp:20});
 await test('com vigor suficiente ataca sem gastar poções quando fadiga está segura',async t=>{await t.start();await t.tick(2200);assert.deepEqual(await t.counts(),{attack:1,major:0,minor:0,close:0});},{hp:100,f:98});
 await test('separa fadiga atual, previsão, custo e total de caçadas do exemplo',async t=>{await t.open();const d=await t.diag();assert.equal(d.fadiga,122);assert.deepEqual(d.previsaoFadiga,{atual:122,depoisMaior:107});assert.equal(d.decisao,'reduzirFadiga');},{f:122,prefs:{limiteFadiga:'120'}});
 await test('aceita pontos de fadiga acima de 100 e milhares no formato brasileiro',async t=>{await t.open();assert.equal((await t.diag()).fadiga,1234);await t.start();await t.tick(2200);assert.equal((await t.counts()).major,1);},{f:1234,prefs:{limiteFadiga:'1200'}});
 await test('reduz antes que a próxima vitória alcance exatamente o limite',async t=>{await t.start();await t.tick(2200);assert.equal((await t.counts()).major,1);assert.equal((await t.counts()).attack,0);assert.equal((await t.counts()).minor,0);},{f:99,hp:60});
 await test('fadiga tem prioridade sobre economia de poções e regeneração natural',async t=>{await t.start();await t.tick(2200);assert.equal((await t.counts()).major,1);},{f:99,hp:79,prefs:{modo:'natural',economizar:true,margem:'5'}});
 await test('aguarda redução da fadiga mesmo se a maior já encheu o vigor',async t=>{await t.start();await t.tick(2200);assert.equal((await t.counts()).major,1);await t.tick(6600);assert.equal((await t.diag()).pendente,'restauradora');assert.equal((await t.counts()).attack,0);await t.set({f:120});await t.tick(2200);assert.equal((await t.diag()).pendente,'restauradora');await t.set({f:107});await t.tick(4400);assert.equal((await t.counts()).major,1);assert.equal((await t.counts()).attack,1);},{f:122,hp:60,flags:{onlyVigor:true},prefs:{limiteFadiga:'120'}});
 await test('sem confirmação não repete maior nem deixa a caçada passar',async t=>{await t.start();await t.tick(52000);assert.equal((await t.counts()).major,1);assert.equal((await t.counts()).attack,0);assert.equal((await t.diag()).pendente,'restauradora');assert.equal(await t.p.locator('#iniciar').isDisabled(),false);},{f:99,flags:{onlyVigor:true}});
 await test('maior esgotada não é substituída pela comum para baixar fadiga',async t=>{await t.start();await t.tick(15000);assert.equal((await t.counts()).major,0);assert.equal((await t.counts()).minor,0);assert.equal((await t.counts()).attack,0);assert.match(await t.status(),/não está disponível/);},{f:99,major:0,prefs:{substituirMaior:true}});
 await test('sem poção comum não gasta maior só para recuperar vigor',async t=>{await t.start();await t.tick(8800);assert.deepEqual(await t.counts(),{attack:0,major:0,minor:0,close:0});},{f:40,hp:20,minor:0});
 for(const minor of [0,3])await test('uma luta libera a maior com vigor cheio e estoque de comuns '+minor,async t=>{
  await t.start();await t.tick(2200);
  assert.deepEqual(await t.counts(),{attack:1,major:0,minor:0,close:0});
  await t.tick(6600);
  assert.deepEqual(await t.counts(),{attack:1,major:1,minor:0,close:1});
  assert.equal(await t.p.evaluate(()=>game.f),85);
 },{f:99,hp:100,minor,major:1,flags:{autoResult:true}});
 for(const fields of [{f:100,major:1},{f:110,major:1},{f:99,major:0}])await test('gasta vigor cheio mesmo sem margem ou sem poção maior '+JSON.stringify(fields),async t=>{
  await t.start();await t.tick(8800);
  assert.deepEqual(await t.counts(),{attack:1,major:0,minor:0,close:0});
 },{...fields,hp:100,minor:0});
 await test('uma redução insuficiente libera uma luta com vigor cheio e aguarda o resultado',async t=>{await t.start();await t.tick(15000);assert.equal((await t.counts()).major,1);assert.equal((await t.counts()).minor,0);assert.equal((await t.counts()).attack,1);assert.equal((await t.diag()).pendente,'ataque');},{f:150,hp:60});
 await test('fadiga zerada usa a barra de fadiga, não a contagem diária',async t=>{await t.open();assert.equal((await t.diag()).fadiga,0);await t.start();await t.tick(2200);assert.equal((await t.counts()).minor,1);assert.equal((await t.counts()).major,0);},{f:0,hp:20});
 await test('categoria Descansado não é confundida com zero',async t=>{await t.open();assert.equal((await t.diag()).fadiga,45);},{f:45});
 await test('menor limite permitido funciona com redução até zero',async t=>{await t.start();await t.tick(6600);assert.equal((await t.counts()).major,1);assert.equal((await t.counts()).attack,1);},{f:1,hp:60,prefs:{limiteFadiga:'2'}});
 await test('sem leitura exata não usa custo, porcentagem ou caçadas como fadiga',async t=>{await t.open();await t.p.locator('.hunt-fatigue-preview').evaluate(el=>el.remove());await t.start();await t.tick(8800);assert.equal((await t.diag()).fadiga,null);assert.deepEqual(await t.counts(),{attack:0,major:0,minor:0,close:0});},{f:122});
 await test('previsões conflitantes não autorizam gastar poção',async t=>{await t.open();await t.p.locator('.realm-sr-only').evaluate(el=>el.textContent='Fadiga de 123 para 108');await t.start();await t.tick(4400);assert.equal((await t.diag()).fadiga,null);assert.equal((await t.counts()).major,0);assert.equal((await t.counts()).attack,0);},{f:122});
 await test('sem botão para abrir detalhes espera sem adivinhar',async t=>{await t.p.locator('#info').evaluate(el=>el.remove());await t.start();await t.tick(8800);assert.deepEqual(await t.counts(),{attack:0,major:0,minor:0,close:0});},{f:99});
 await test('janela desconhecida aberta bloqueia consulta e ações',async t=>{await t.p.evaluate(()=>document.body.insertAdjacentHTML('beforeend','<div role="dialog"><h2>Escolha uma opção</h2><button id="other">Confirmar compra</button></div>'));await t.start();await t.tick(4400);assert.deepEqual(await t.counts(),{attack:0,major:0,minor:0,close:0});},{f:99});
 await test('botão duplicado da maior não gera escolha arbitrária',async t=>{await t.p.locator('#major').evaluate(el=>el.after(el.cloneNode(true)));await t.start();await t.tick(4400);assert.equal((await t.counts()).major,0);assert.equal((await t.counts()).attack,0);},{f:99});
 for(const value of ['0','1','-1','1.5','','9007199254740992'])await test('recusa limite inválido '+JSON.stringify(value),async t=>{await t.p.locator('#limiteFadiga').fill(value);await t.start();assert.equal(await t.p.locator('#iniciar').isDisabled(),false);assert.match(await t.status(),/número inteiro de 2 ou mais/);assert.deepEqual(await t.counts(),{attack:0,major:0,minor:0,close:0});});
 await test('desligar fadiga recupera vigor só com a comum mesmo com preferências antigas',async t=>{await t.start();await t.tick(2200);assert.equal((await t.counts()).major,0);assert.equal((await t.counts()).minor,1);},{f:40,hp:20,prefs:{controlarFadiga:false,limiteFadiga:'bad',limite:'90',substituirMaior:true}});
 await test('limite antigo da maior não interfere no controle de fadiga',async t=>{await t.start();await t.tick(2200);assert.equal((await t.counts()).minor,1);assert.equal((await t.counts()).major,0);assert.equal(await t.p.locator('#limite').count(),0);assert.equal(await t.p.locator('#substituirMaior').count(),0);},{hp:20,f:40,prefs:{limite:'90',limiteAlivio:'70',substituirMaior:true}});
 await test('campo antigo da maior desativado não bloqueia o novo controle',async t=>{await t.start();await t.tick(2200);assert.equal((await t.counts()).minor,1);assert.equal((await t.counts()).major,0);},{f:40,hp:20,prefs:{limite:'campo antigo incompleto'}});
 await test('dados ficam salvos e recarga comum não inicia a caçada',async t=>{await t.p.locator('#limiteFadiga').fill('250');await t.p.reload();await t.load();assert.equal(await t.p.locator('#controlarFadiga').isChecked(),true);assert.equal(await t.p.locator('#limiteFadiga').inputValue(),'250');await t.tick(10000);assert.deepEqual(await t.counts(),{attack:0,major:0,minor:0,close:0});});
 await test('desligar controle durante uma poção pendente não libera confirmação pelo vigor',async t=>{await t.start();await t.tick(2200);await t.p.locator('#controlarFadiga').uncheck();await t.start();await t.tick(6600);assert.equal((await t.diag()).pendente,'restauradora');assert.equal((await t.counts()).major,1);assert.equal((await t.counts()).attack,0);},{f:99,flags:{onlyVigor:true}});
 await test('atualização preserva o motivo e a redução esperada sem repetir a poção',async t=>{await t.start();await t.tick(2200);await t.p.evaluate(()=>aurenCacada.prepararAtualizacao());await t.p.reload();await t.load();await t.tick(4400);assert.equal((await t.diag()).pendente,'restauradora');assert.equal((await t.counts()).major,0);await t.set({f:84,hp:100});await t.tick(4400);assert.equal((await t.counts()).attack,1);},{f:99,flags:{onlyVigor:true}});
 await test('zerar fadiga no novo dia não causa uso duplicado da maior',async t=>{await t.start();await t.tick(2200);await t.set({f:0,hp:100});await t.tick(4400);assert.equal((await t.counts()).major,1);assert.equal((await t.counts()).attack,1);},{f:99,flags:{onlyVigor:true}});
 await test('pausa marcada espera a redução da fadiga ser confirmada',async t=>{await t.start();await t.tick(44000);await t.set({f:99,hp:60});await t.tick(2200);assert.equal((await t.counts()).major,1);await t.tick(18000);assert.equal((await t.diag()).pausas.retomarEm,null);await t.set({f:84,hp:100});await t.tick(4400);assert.ok((await t.diag()).pausas.retomarEm);assert.equal((await t.counts()).attack,0);},{f:40,hp:70,flags:{onlyVigor:true},prefs:{modo:'natural',pausasAleatorias:true,intervaloPausaMin:'1',intervaloPausaMax:'1',duracaoPausaMin:'1',duracaoPausaMax:'1'}});
 await test('fim do descanso relê a fadiga e não usa o valor anterior para atacar',async t=>{await t.start();await t.tick(62000);assert.ok((await t.diag()).pausas.retomarEm);await t.set({f:99,hp:90,major:0});await t.tick(65000);assert.equal((await t.diag()).pausas.retomarEm,null);assert.deepEqual(await t.counts(),{attack:0,major:0,minor:0,close:0});},{f:40,hp:70,prefs:{modo:'natural',pausasAleatorias:true,intervaloPausaMin:'1',intervaloPausaMax:'1',duracaoPausaMin:'1',duracaoPausaMax:'1'}});
 await test('várias lutas mantêm fadiga abaixo do limite e poupam a maior para fadiga',async t=>{await t.start();await t.tick(300000);const c=await t.counts();assert.ok(c.attack>10);assert.ok(c.minor>5);assert.ok(c.major>=2);assert.ok(await t.p.evaluate(()=>game.maxF<100));if(process.env.SCREENSHOT_PATH){await t.p.evaluate(()=>aurenCacada.pausar());await t.p.locator('#auren-cacada-v3').locator('section').evaluate(el=>el.scrollTop=280);await t.p.locator('#auren-cacada-v3').screenshot({path:process.env.SCREENSHOT_PATH});}},{f:98,hp:100,flags:{autoResult:true}});
 await test('sem comum e sem controle de fadiga espera sem gastar a maior',async t=>{await t.start();await t.tick(8800);assert.deepEqual(await t.counts(),{attack:0,major:0,minor:0,close:0});},{hp:20,minor:0,prefs:{controlarFadiga:false}});
 await test('preferência antiga inválida da maior não bloqueia a recuperação comum',async t=>{await t.start();await t.tick(2200);assert.equal((await t.counts()).minor,1);assert.equal((await t.counts()).major,0);},{hp:20,prefs:{controlarFadiga:false,limite:'inválido'}});
 await test('fadiga alta com controle desligado não usa a maior para vigor nem fadiga',async t=>{await t.start();await t.tick(2200);assert.equal((await t.counts()).major,0);assert.equal((await t.counts()).minor,1);},{f:500,hp:20,prefs:{controlarFadiga:false}});
 const aproveitar={aproveitarMaior:true,folgaFadiga:'5',vigorMaior:'30'};
 await test('aproveita vigor antes da maior mesmo abaixo do mínimo habitual de caçar',async t=>{
  await t.start();await t.tick(2200);
  assert.deepEqual(await t.counts(),{attack:1,major:0,minor:0,close:0});
 },{f:100,hp:71,prefs:aproveitar});
 await test('usa maior com vigor baixo após três caçadas e mantém margem configurada',async t=>{
  await t.start();await t.tick(26000);
  const g=await t.p.evaluate(()=>game);
  assert.deepEqual(g.usosMaior,[{hp:13,f:102}]);
  assert.equal(g.counts.minor,0);
  assert.ok(g.maxF<=105);
 },{f:99,hp:100,flags:{autoResult:true},prefs:aproveitar});
 for(const [f,hp,acao] of [[104,71,'attack'],[105,71,'major'],[100,30,'major'],[100,29,'major'],[100,31,'attack']]) {
  await test('respeita fronteira da margem e vigor '+JSON.stringify({f,hp}),async t=>{
   await t.start();await t.tick(2200);
   assert.equal((await t.counts())[acao],1);
   assert.equal((await t.counts()).minor,0);
  },{f,hp,prefs:aproveitar});
 }
 await test('opção desligada mantém uso da maior no limite original',async t=>{
  await t.start();await t.tick(2200);
  assert.equal((await t.counts()).major,1);assert.equal((await t.counts()).attack,0);
 },{f:99,hp:71,prefs:{...aproveitar,aproveitarMaior:false}});
 await test('configurações da margem ficam salvas e desativam junto com a fadiga',async t=>{
  await t.p.locator('#aproveitarMaior').check();
  await t.p.locator('#folgaFadiga').fill('7');
  await t.p.locator('#vigorMaior').fill('40');
  await t.p.reload();await t.load();
  assert.equal(await t.p.locator('#aproveitarMaior').isChecked(),true);
  assert.equal(await t.p.locator('#folgaFadiga').inputValue(),'7');
  assert.equal(await t.p.locator('#vigorMaior').inputValue(),'40');
  await t.p.locator('#controlarFadiga').uncheck();
  assert.equal(await t.p.locator('#aproveitarMaior').isDisabled(),true);
  assert.equal(await t.p.locator('#folgaFadiga').isDisabled(),true);
 });
 for(const folgaFadiga of ['-1','1.5','', '9007199254740992'])await test('recusa margem de fadiga inválida '+JSON.stringify(folgaFadiga),async t=>{
  await t.start();assert.match(await t.status(),/Fadiga extra/);
  assert.equal((await t.counts()).attack,0);assert.equal((await t.counts()).major,0);
 },{f:99,prefs:{...aproveitar,folgaFadiga}});
 await test('controle desligado ignora campos antigos ou inválidos da margem',async t=>{
  await t.start();await t.tick(2200);
  assert.equal((await t.counts()).minor,1);assert.equal((await t.counts()).major,0);
 },{f:100,hp:20,prefs:{...aproveitar,controlarFadiga:false,folgaFadiga:'bad',vigorMaior:'bad'}});
 for(const rotulo of ['Só Resultado','Só o resultado'])await test('seleciona a modalidade ao iniciar com o rótulo '+rotulo,async t=>{
  await t.p.locator('#mode').evaluate((el,rotulo)=>{
   el.textContent=rotulo;el.setAttribute('aria-pressed','false');
  },rotulo);
  await t.start();await t.tick(2200);
  assert.equal(await t.p.locator('#mode').getAttribute('aria-pressed'),'true');
  assert.equal(await t.p.evaluate(()=>game.modeClicks),1);
  assert.equal((await t.counts()).attack,1);
 },{hp:100,f:40});
 await test('botão direto Só resultado não é clicado durante preparação',async t=>{
  await t.start();
  assert.equal((await t.counts()).attack,0);
  assert.equal(await t.p.locator('#iniciar').isDisabled(),true);
  await t.tick(2200);
  assert.equal((await t.counts()).attack,1);
  await t.tick(8800);
  assert.equal((await t.counts()).attack,1);
  assert.equal((await t.diag()).pendente,'ataque');
 },{hp:100,f:40,flags:{directResult:true}});
 await test('botão direto aguarda seleção da criatura antes de atacar',async t=>{
  await t.p.locator('#monster').evaluate(el=>{
   el.setAttribute('aria-pressed','false');el.onclick=()=>el.setAttribute('aria-pressed','true');
  });
  await t.start();await t.tick(2200);
  assert.equal((await t.counts()).attack,0);
  await t.tick(2200);
  assert.equal((await t.counts()).attack,1);
 },{hp:100,f:40,flags:{directResult:true}});
 await test('botão direto respeita redução de fadiga antes da luta',async t=>{
  await t.start();await t.tick(2200);
  assert.equal((await t.counts()).attack,0);assert.equal((await t.counts()).major,1);
  await t.tick(4400);assert.equal((await t.counts()).attack,1);
 },{hp:60,f:99,flags:{directResult:true}});
 await test('botão direto não luta com vigor abaixo da configuração',async t=>{
  await t.start();await t.tick(10000);
  assert.deepEqual(await t.counts(),{attack:0,major:0,minor:0,close:0});
 },{hp:20,f:40,flags:{directResult:true},prefs:{modo:'natural'}});
 await test('botão direto fecha resultado e repete o ciclo com confirmação',async t=>{
  await t.start();await t.tick(30000);
  const counts=await t.counts();
  assert.ok(counts.attack>=2);assert.ok(counts.close>=2);
 },{hp:100,f:40,flags:{directResult:true,autoResult:true}});
 console.log('TOTAL',count);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
