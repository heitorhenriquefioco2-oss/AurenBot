const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});
 const errors=[];
 async function test(name,run,options={}){
  const p=await browser.newPage({viewport:{width:1280,height:1000}});p.on('pageerror',e=>errors.push(e.message));
  await p.route('http://expedition.test/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><header class="hero-header"></header><aside><nav><button id="navHunt" title="Caçada (Alt + C)">Caçada</button><button id="navExp" title="Expedição (Alt + E)">Expedição</button></nav></aside><main></main>'}));
  await p.addInitScript(options=>{
   window.game={screen:'hunt',exp:options.active?'active':options.paused?'paused':'idle',minutes:60,mode:true,inFlight:false,flags:{...options.flags},counts:{starts:[],resumes:0,pauses:0,abandons:0,attacks:0,closes:0,durations:[],modes:0,nav:[]}};
   const initial={criatura:'Eco errante',modo:'natural',atacar:'80',limite:'30',limiteAlivio:'70',economizar:true,margem:'5',continuarOculta:true,reiniciarAutomaticamente:false,manterExpedicao:!!options.keep,duracaoExpedicao:options.duration||'60',...options.prefs};
   window.chrome={storage:{local:{get:async()=>({aurenPreferenciasV33:JSON.parse(localStorage.getItem('prefs')||'null')||initial}),set:async values=>localStorage.setItem('prefs',JSON.stringify(values.aurenPreferenciasV33))}},runtime:{id:'test',onMessage:{addListener(){}}}};
   window.result=()=>{if(document.getElementById('result'))return;const r=document.createElement('div');r.id='result';r.setAttribute('role','dialog');r.innerHTML='<h2>Caçada concluída</h2><p>Vitória</p><button id="continue">Continuar</button>';document.body.appendChild(r);};
   window.guard=()=>{const r=document.createElement('dialog');r.id='guard';r.innerHTML='<h2>A guarda pede um sinal</h2><div class="challenge-widget"></div><button id="present">Apresentar o selo</button>';document.body.appendChild(r);r.showModal();};
   window.render=()=>{
    const g=game;document.querySelector('header').innerHTML=g.exp==='active'?'<button class="hero-header-status is-expedition" title="Em expedição" aria-label="Acompanhar em expedição"><span>Em expedição</span><strong>1h</strong></button>':'';
    if(g.screen==='hunt')document.querySelector('main').innerHTML=`<h1>Caçada</h1><div class="hunt-vitality"><progress aria-label="Vigor de caçada" value="1" max="1"></progress></div><button id="mode" aria-pressed="${g.mode}">Só o resultado</button><button id="monster" aria-pressed="true">Eco errante</button><button id="attack">Caçar</button>`;
    else {
     const fmt=m=>m===15?'15 min':m===60?'1 h':'4 h';
     let durations=[15,60,240].map(m=>`<button class="duration-option" data-minutes="${m}" aria-label="${fmt(m)}" aria-pressed="${g.minutes===m}"><strong class="duration-value">${fmt(m)}</strong><span>combates programados</span></button>`).join('');
     if(g.flags.duplicateDuration)durations+=`<button class="duration-option" aria-label="4 h" aria-pressed="false">4 h</button>`;
     document.querySelector('main').innerHTML=`<h1>Expedição</h1>${g.exp!=='idle'?`<section class="journey-ledger ${g.exp}"><span>${g.exp==='active'?'Seu herói está em jornada':'Expedição pausada'}</span><button id="${g.exp==='active'?'pause':'resume'}">${g.exp==='active'?'Pausar expedição':'Retomar expedição'}</button><button id="abandon">Abandonar expedição</button></section>`:''}<section class="expedition-preparation"><div class="duration-options" role="group" aria-label="Duração da expedição">${durations}</div><div class="dispatch-action"><button id="dispatch" class="primary destination-go" ${g.exp!=='idle'||g.flags.disabledStart?'disabled':''}>${g.exp==='active'?'Expedição em andamento':g.exp==='paused'?'Expedição pausada':'Explorar por '+fmt(g.flags.staleStartLabel?60:g.minutes)}</button></div></section>`;
    }
   };
   document.addEventListener('DOMContentLoaded',()=>{
    render();document.addEventListener('click',e=>{
     const b=e.target.closest('button');if(!b||b.disabled)return;const g=game;
     if(b.id==='navExp'){g.counts.nav.push({screen:'exp',during:g.inFlight});g.screen='exp';render();}
     if(b.id==='navHunt'){g.counts.nav.push({screen:'hunt',during:g.inFlight});if(!g.flags.blockReturn){g.screen='hunt';g.mode=false;render();}}
     if(b.dataset.minutes){const minutes=Number(b.dataset.minutes);g.counts.durations.push(minutes);if(!g.flags.noDurationConfirmation){g.minutes=minutes;render();}}
     if(b.id==='dispatch'){
      g.counts.starts.push(g.minutes);
      if(g.flags.challengeOnStart)guard();
      else if(!g.flags.noStartConfirmation){g.exp='active';render();}
     }
     if(b.id==='resume'){g.counts.resumes++;if(!g.flags.noStartConfirmation){g.exp='active';render();}}
     if(b.id==='pause'){g.counts.pauses++;g.exp='paused';render();}
     if(b.id==='abandon'){g.counts.abandons++;g.exp='idle';render();}
     if(b.id==='mode'){g.counts.modes++;g.mode=true;render();}
     if(b.id==='attack'){g.counts.attacks++;g.inFlight=true;if(!g.flags.noResult)setTimeout(result,1000);}
     if(b.id==='continue'){g.counts.closes++;g.inFlight=false;document.getElementById('result')?.remove();}
     if(b.id==='present'&&e.isTrusted){document.getElementById('guard').remove();g.exp='active';g.flags.challengeOnStart=false;render();}
    });
   });
  },options);
  await p.goto('http://expedition.test/');await p.clock.install();
  async function load(){await p.addScriptTag({path:path.join(__dirname,'../avisos.js')});await p.addScriptTag({path:path.join(__dirname,'../content.js')});await p.waitForFunction(()=>window.aurenCacada);}
  await load();const t={p,load,ticks:n=>p.clock.runFor(n),start:()=>p.evaluate(()=>aurenCacada.iniciar()),counts:()=>p.evaluate(()=>game.counts),status:()=>p.locator('#status').textContent(),expStatus:()=>p.locator('#statusExpedicao').textContent(),finish:()=>p.evaluate(()=>{game.exp='idle';render();})};
  try{await run(t);console.log('PASS:',name);}finally{await p.close();}
 }
 try{
 const pausas={pausasAleatorias:true,intervaloPausaMin:'1',intervaloPausaMax:'1',duracaoPausaMin:'1',duracaoPausaMax:'1'};
 await test('pausa mantém a jornada ativa sem pausar ou abandonar no jogo',async t=>{await t.start();await t.ticks(65000);assert.ok((await t.p.evaluate(()=>aurenCacada.diagnostico())).pausas.retomarEm);const before=await t.counts();await t.ticks(40000);const after=await t.counts();assert.equal(after.attacks,before.attacks);assert.equal(after.pauses,0);assert.equal(after.abandons,0);assert.deepEqual(after.starts,[]);assert.equal(await t.p.evaluate(()=>game.exp),'active');},{keep:true,active:true,prefs:pausas});
 await test('jornada encerrada no descanso só é renovada depois da pausa',async t=>{await t.p.locator('#iniciar').click();await t.ticks(65000);assert.ok((await t.p.evaluate(()=>aurenCacada.diagnostico())).pausas.retomarEm);const before=await t.counts();assert.equal(before.starts.length,1);await t.finish();await t.ticks(50000);assert.equal((await t.counts()).starts.length,1);await t.ticks(15000);const after=await t.counts();assert.equal(after.starts.length,2);assert.equal(after.pauses,0);assert.equal(after.abandons,0);assert.equal(await t.p.evaluate(()=>game.screen),'hunt');assert.ok(after.nav.every(n=>!n.during));},{keep:true,prefs:pausas});
 await test('retomada do descanso volta à Caçada e confirma Só o resultado',async t=>{await t.start();await t.ticks(65000);await t.p.evaluate(()=>{game.screen='exp';game.mode=false;render();});const before=await t.counts();await t.ticks(40000);assert.equal((await t.counts()).nav.length,before.nav.length);await t.ticks(25000);assert.equal(await t.p.evaluate(()=>game.screen),'hunt');assert.equal(await t.p.evaluate(()=>game.mode),true);assert.ok((await t.counts()).modes>before.modes);},{active:true,prefs:pausas});
 await test('preparação de jornada termina antes de começar a contar o intervalo',async t=>{await t.p.locator('#iniciar').click();await t.ticks(10000);assert.equal((await t.p.evaluate(()=>aurenCacada.diagnostico())).pausas,null);await t.ticks(10000);const plan=(await t.p.evaluate(()=>aurenCacada.diagnostico())).pausas;assert.ok(plan);assert.ok(plan.proximaEm-await t.p.evaluate(()=>Date.now())>50000);},{keep:true,flags:{noStartConfirmation:true},prefs:pausas});
 console.log('TOTAL 4');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
