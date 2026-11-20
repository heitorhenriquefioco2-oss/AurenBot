'use strict';
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.join(__dirname,'..');
(async()=>{
  // Uma janela de teste própria, sem o perfil ou as sessões do usuário.
  const browser=await chromium.launch({headless:false,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),
    ignoreDefaultArgs:['--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding'],args:['--start-minimized']});
  try {
    const context=await browser.newContext();
    const page=await context.newPage();
    await page.route('https://auren-online.com/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><nav><button id="huntNav">Caçada</button><button id="bossNav">Boss</button></nav><main></main>'}));
    await page.goto('https://auren-online.com/');
    await page.evaluate(()=>{
      window.game={hunts:0,boss:0,selected:'basic',hp:100,screen:'hunt',updates:0};
      window.render=()=>{
        if(document.hidden)return;
        const g=game;
        document.querySelector('main').innerHTML=g.screen==='hunt'?
          '<h1>Caçada</h1><button aria-pressed="true">Só o resultado</button><button aria-pressed="true">Eco errante</button><div class="hunt-vitality"><progress aria-label="Vigor de caçada" value="'+g.hp+'" max="100"></progress></div><button id="attack">Caçar</button>'+(g.result?'<div role="dialog"><h2>Caçada concluída</h2><button id="continue">Continuar</button></div>':''):
          '<div class="world-boss-screen"><h2 id="world-boss-name">Gorath</h2><span class="world-boss-status-active">Em combate</span><div class="world-boss-personal"><div><span>Suas investidas</span><strong>'+g.boss+'</strong></div></div><div class="world-boss-life-track" role="progressbar" aria-valuenow="10000"></div>'+
          '<fieldset>'+[['basic',100],['fire',1200]].map(([id,damage])=>'<label class="world-boss-attack-option"><input type="radio" name="world-boss-attack" value="'+id+'" '+(g.selected===id?'checked':'')+'><strong>'+id+'</strong><b>'+damage+'<small>dano</small></b></label>').join('')+'</fieldset><button class="world-boss-strike">Atacar boss</button></div>';
      };
      // A primeira tela já foi recebida antes de minimizar.
      game.screen='hunt';
      document.querySelector('main').innerHTML='<h1>Caçada</h1><button aria-pressed="true">Só o resultado</button><button aria-pressed="true">Eco errante</button><div class="hunt-vitality"><progress aria-label="Vigor de caçada" value="100" max="100"></progress></div><button id="attack">Caçar</button>';
      document.addEventListener('visibilitychange',()=>{if(!document.hidden){game.updates++;render();}});
      document.addEventListener('change',e=>{if(e.target.name==='world-boss-attack'){game.selected=e.target.value;render();}});
      document.addEventListener('click',e=>{
        const id=e.target.closest('button')?.id;
        if(id==='huntNav'){game.screen='hunt';render();}
        if(id==='bossNav'){game.screen='boss';render();}
        if(id==='attack'){
          game.hunts++;game.hp=71;game.result=true;
          document.querySelector('main').insertAdjacentHTML('beforeend','<div role="dialog"><h2>Caçada concluída</h2><button id="continue">Continuar</button></div>');
        }
        if(id==='continue'){game.result=false;render();}
        if(e.target.closest('.world-boss-strike')){game.boss++;render();}
      });
    });
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:false});
    const {windowId}=await cdp.send('Browser.getWindowForTarget');
    await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'minimized'}});
    assert.equal((await cdp.send('Browser.getWindowBounds',{windowId})).bounds.windowState,'minimized');
    const ocultoEmulado=!await page.evaluate(()=>document.hidden);
    if(ocultoEmulado)await page.evaluate(()=>{
      // Alguns ambientes de automação mantêm a visibilidade emulada mesmo com a janela minimizada.
      Object.defineProperties(Document.prototype,{
        hidden:{configurable:true,get:()=>true},
        visibilityState:{configurable:true,get:()=>'hidden'}
      });
    });
    await page.addScriptTag({path:path.join(root,'pagina-segundo-plano.js')});
    const frame=(await cdp.send('Page.getFrameTree')).frameTree.frame.id;
    const {executionContextId}=await cdp.send('Page.createIsolatedWorld',{frameId:frame,worldName:'auren-extension-test'});
    async function evaluate(expression) {
      const result=await cdp.send('Runtime.evaluate',{contextId:executionContextId,expression,returnByValue:true,awaitPromise:true});
      if(result.exceptionDetails)throw Error(result.exceptionDetails.text+' '+result.exceptionDetails.exception?.description);
      return result.result.value;
    }
    if(ocultoEmulado)await evaluate(`Object.defineProperties(Document.prototype,{
      hidden:{configurable:true,get:()=>true},
      visibilityState:{configurable:true,get:()=>'hidden'}
    });true;`);
    await evaluate(`window.registros=[];window.receptores=[];
      window.chrome={runtime:{id:'test',sendMessage:async msg=>{registros.push(msg);return {ok:true};},onMessage:{addListener:fn=>receptores.push(fn)}},
      storage:{local:{get:async key=>key==='aurenNotificacoesV1'?{aurenNotificacoesV1:{ativadas:false}}:{aurenPreferenciasV33:{criatura:'Eco errante',modo:'natural',atacar:'80',limiteAlivio:'70',economizar:false,margem:'5',continuarOculta:true}},set:async()=>{}}}};
      window.timers=0;window.setInterval=()=>++timers;window.clearInterval=()=>{};
    `);
    for(const file of ['segundo-plano.js','avisos.js','content.js','boss.js'])await evaluate(fs.readFileSync(path.join(root,file),'utf8'));
    await evaluate('Promise.resolve().then(()=>!!window.aurenCacada)');
    assert.equal(await evaluate('!!window.aurenCacada'),true);
    await evaluate('aurenCacada.iniciar()');
    assert.equal(await evaluate('document.hidden'),true);
    assert.equal(await page.evaluate(()=>document.hidden),false);
    assert.equal(await evaluate('aurenSegundoPlano.prazo(8000)'),120000);
    const pulse=()=>evaluate(`(()=>{let resposta;for(const fn of receptores)fn({origem:'auren-segundo-plano',comando:'pulso'},{id:'test'},value=>resposta=value);return resposta;})()`);
    for(let i=0;i<3;i++)await pulse();
    assert.equal(await page.evaluate(()=>game.hunts),1);
    await evaluate(`window.esperaConcluida=false;{
      const original=window.setTimeout;window.setTimeout=()=>-1;
      aurenSegundoPlano.esperar(200).then(()=>window.esperaConcluida=true);
      window.setTimeout=original;
    }`);
    await new Promise(resolve=>setTimeout(resolve,250));
    await pulse();
    assert.equal(await evaluate('window.esperaConcluida'),true);
    await evaluate('aurenBoss.iniciar()');
    for(let i=0;i<5;i++){
      await new Promise(resolve=>setTimeout(resolve,250));
      await pulse();
    }
    assert.equal(await page.evaluate(()=>game.boss),1);
    assert.equal(await page.evaluate(()=>game.screen),'hunt');
    assert.equal(await evaluate('aurenBoss.ativo()'),true);
    console.log('PASS: janela minimizada executa caçada e Boss por pulsos, sem setInterval da página'+(ocultoEmulado?' (estado oculto simulado)':''));
    await evaluate('aurenBoss.pausar();aurenCacada.pausar()');
    await page.waitForFunction(()=>document.hidden,{},{polling:100,timeout:5000});
    assert.equal(await evaluate('document.documentElement.hasAttribute("data-auren-segundo-plano")'),false);
    const before=await page.evaluate(()=>game.hunts+game.boss);
    await pulse();
    assert.equal(await page.evaluate(()=>game.hunts+game.boss),before);
    console.log('PASS: parar ambos restaura a visibilidade real e pulsos não iniciam novas ações');
    await evaluate('aurenBoss.iniciar();document.getElementById("auren-cacada-v3").shadowRoot.getElementById("continuarOculta").checked=false;aurenSegundoPlano.atualizar();document.dispatchEvent(new Event("visibilitychange"));');
    assert.equal(await evaluate('aurenBoss.ativo()'),false);
    assert.equal(await evaluate('aurenSegundoPlano.prazo(8000)'),8000);
    assert.equal(await page.evaluate(()=>document.hidden),true);
    console.log('PASS: opção de segundo plano desligada é respeitada na janela minimizada');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
