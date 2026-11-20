'use strict';
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
(async()=>{
  const browser = await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  let total = 0;
  async function test(name, tipo, run) {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('https://boss-hunt.test/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><nav><button id="huntNav" aria-label="Caçada">Caçada</button><button id="worldNav" aria-label="Boss">Boss</button><button id="guildNav" aria-label="Guildas">Guildas</button></nav><main></main>'}));
    await page.addInitScript(tipo=>{
      window.game={screen:'hunt',hp:100,hunts:0,bossAttacks:0,nextAt:0,selected:'basic',tipo,nav:[],huntPending:false,overlap:false};
      const prefs={criatura:'Eco errante',modo:'natural',atacar:'80',limiteAlivio:'70',economizar:false,margem:'5',continuarOculta:true,controlarFadiga:false,manterExpedicao:false};
      window.chrome={storage:{local:{get:async key=>key==='aurenNotificacoesV1'?{aurenNotificacoesV1:{ativadas:false}}:{aurenPreferenciasV33:prefs},set:async()=>{}}},runtime:{id:'test',onMessage:{addListener(){}}}};
      window.render=()=>{
        const g=game;
        if(g.screen==='hunt'){
          document.querySelector('main').innerHTML='<h1>Caçada</h1><button aria-pressed="true" id="mode">Só o resultado</button><button id="monster" aria-pressed="true">Eco errante</button><div class="hunt-vitality"><progress aria-label="Vigor de caçada" max="100" value="'+g.hp+'"></progress></div><button id="attack">Caçar</button>';
          return;
        }
        if(g.screen==='guild'){
          document.querySelector('main').innerHTML='<nav class="guild-hub-nav"><button aria-label="Boss" id="guildBossNav" aria-pressed="false">Boss</button></nav>';
          return;
        }
        const guild=g.screen==='guildBoss',remaining=Math.max(0,Math.ceil((g.nextAt-Date.now())/1000));
        document.querySelector('main').innerHTML=`<div class="world-boss-screen ${guild?'guild-boss-screen':''}">
          ${guild?'<div class="world-boss-identity"><h3 id="guild-boss-name">Azhur</h3><span>Em combate</span></div>':'<h2 id="world-boss-name">Azhur</h2><span class="world-boss-status-active">Em combate</span>'}
          <div class="world-boss-life-track" role="progressbar" aria-valuenow="100000"></div>
          ${guild?'':'<div class="world-boss-personal"><div><span>Suas investidas</span><strong>'+g.bossAttacks+'</strong></div></div>'}
          <section class="world-boss-assault">${guild?'<p>'+g.bossAttacks+'/8 investidas usadas</p>':''}
          ${remaining?(guild?'<div class="guild-countdown-recharge" data-state="active"><time datetime="PT'+remaining+'S">15:00</time></div>':'<p class="world-boss-cooldown"><strong>'+Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0')+'</strong></p>'):''}
          <fieldset><label class="world-boss-attack-option"><input type="radio" name="${guild?'guild':'world'}-boss-attack" value="basic" ${g.selected==='basic'?'checked':''}><strong>Ataque simples</strong><b>100<small>dano</small></b></label>
          <label class="world-boss-attack-option"><input type="radio" name="${guild?'guild':'world'}-boss-attack" value="fire" ${g.selected==='fire'?'checked':''}><strong>Fogo</strong><b>1.200<small>dano</small></b></label></fieldset>
          <button class="world-boss-strike" ${remaining?'disabled':''}>Atacar boss</button></section></div>`;
      };
      window.navigate=screen=>{
        if(game.huntPending)game.overlap=true;
        game.screen=screen;game.nav.push(screen);render();
      };
      document.addEventListener('DOMContentLoaded',()=>{
        render();setInterval(()=>{if(['worldBoss','guildBoss'].includes(game.screen))render();},1000);
        document.addEventListener('change',e=>{if(e.target.type==='radio'){game.selected=e.target.value;render();}});
        document.addEventListener('click',e=>{
          const id=e.target.closest('button')?.id;
          if(id==='huntNav')navigate('hunt');
          if(id==='worldNav')navigate('worldBoss');
          if(id==='guildNav')navigate('guild');
          if(id==='guildBossNav')navigate('guildBoss');
          if(id==='attack'){
            game.hunts++;game.huntPending=true;
            setTimeout(()=>{
              game.hp=71;
              document.querySelector('main').insertAdjacentHTML('beforeend','<div role="dialog" id="result"><h2>Caçada concluída</h2><button id="continue">Continuar</button></div>');
            },1000);
          }
          if(id==='continue'){game.huntPending=false;render();}
          if(e.target.closest('.world-boss-strike')){
            if(game.huntPending)game.overlap=true;
            if(Date.now()<game.nextAt)throw Error('Boss atacado antes do intervalo do jogo');
            if(game.selected!=='fire')throw Error('Não escolheu o maior dano');
            game.bossAttacks++;game.nextAt=Date.now()+15*60000;game.selected='basic';render();
          }
        });
      });
    },tipo);
    await page.clock.install();
    await page.goto('https://boss-hunt.test/');
    await page.addScriptTag({path:path.join(root,'avisos.js')});
    await page.addScriptTag({path:path.join(root,'content.js')});
    await page.waitForFunction(()=>window.aurenCacada);
    await page.addScriptTag({path:path.join(root,'boss.js')});
    await page.locator('#tabBoss').click();
    await page.locator('#bossDestino').selectOption(tipo);
    const t={page,tick:ms=>page.clock.runFor(ms),game:()=>page.evaluate(()=>game),startHunt:()=>page.locator('#iniciar').click(),startBoss:()=>page.locator('#iniciarBoss').click()};
    try{await run(t);assert.deepEqual(errors,[]);total++;console.log('PASS:',name);}
    finally{await page.close();}
  }
  try {
    for(const tipo of ['guilda','mundo']){
      await test('extra '+tipo+' mantém caçada ativa e volta para a próxima investida',tipo,async t=>{
        await t.startHunt();await t.tick(2200);assert.equal((await t.game()).hunts,1);
        await t.startBoss();await t.tick(30000);
        let g=await t.game();
        assert.equal(g.bossAttacks,1);assert.equal(g.screen,'hunt');assert.equal(g.overlap,false);
        assert.equal(await t.page.locator('#iniciar').isDisabled(),true);
        await t.page.evaluate(()=>{game.hp=100;render();});await t.tick(10000);
        assert.equal((await t.game()).hunts,2);
        await t.tick(15*60000);
        g=await t.game();assert.equal(g.bossAttacks,2);assert.equal(g.screen,'hunt');assert.equal(g.overlap,false);
        assert.equal(await t.page.evaluate(()=>aurenBoss.ativo()),true);
        await t.page.locator('#pausarBoss').click();
        assert.equal(await t.page.locator('#iniciar').isDisabled(),true);
        await t.page.evaluate(()=>{game.hp=100;render();});await t.tick(10000);
        assert.equal((await t.game()).hunts,3);
      });
      await test('extra '+tipo+' ataca com caçada parada e permanece ativo após Pausar caçada',tipo,async t=>{
        await t.startBoss();await t.tick(15000);
        assert.equal((await t.game()).bossAttacks,1);assert.equal((await t.game()).hunts,0);
        await t.page.locator('#pausar').click();
        assert.equal(await t.page.evaluate(()=>aurenBoss.ativo()),true);
        await t.tick(15*60000);
        assert.equal((await t.game()).bossAttacks,2);assert.equal((await t.game()).hunts,0);
      });
      await test('iniciar caçada durante a investida do extra '+tipo+' aguarda confirmação e mantém ambos ativos',tipo,async t=>{
        await t.startBoss();await t.tick(6600);
        await t.startHunt();await t.tick(20000);
        assert.equal((await t.game()).bossAttacks,1);
        assert.equal((await t.game()).hunts,1);
        assert.equal((await t.game()).overlap,false);
        assert.equal(await t.page.evaluate(()=>aurenBoss.ativo()),true);
        assert.equal(await t.page.locator('#iniciar').isDisabled(),true);
      });
    }
    console.log('TOTAL',total);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
