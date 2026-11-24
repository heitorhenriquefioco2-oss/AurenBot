'use strict';
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
(async()=>{
  const browser = await chromium.launch({headless:true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {})});
  let count = 0;
  async function test(name, run, options = {}) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error=>errors.push(error.message));
    await page.route('https://boss.test/**', route=>route.fulfill({contentType:'text/html', body:'<!doctype html><nav><button aria-label="Boss" id="bossNav">Boss</button></nav><main></main>'}));
    await page.goto('https://boss.test/');
    await page.clock.install();
    await page.evaluate(options=>{
      window.game = {attacks:0, clicks:[], cooldown:false, active:true, hp:10000, used:[], selected:'basic', ...options};
      const host = document.createElement('div');
      host.id = 'auren-cacada-v3';
      host.attachShadow({mode:'open'}).innerHTML = '<select id="bossDestino"><option value="auto">Tela atual</option><option value="guilda">Guilda</option><option value="mundo">Mundo</option></select><button id="iniciarBoss">Iniciar Boss</button><button id="pausarBoss">Pausar Boss</button><input id="continuarOculta" type="checkbox" checked><output id="statusBoss"></output>';
      host.shadowRoot.getElementById('bossDestino').value=options.destino||'auto';
      document.body.append(host);
      window.aurenCacada = {ocupado:()=>!!game.occupied, pausar:()=>{game.huntPaused=true;window.aurenBoss?.pausar();}};
      window.aurenAvisos = {verificar:()=>false, verificacaoHumana:false};
      window.render = ()=>{
        document.querySelector('main').innerHTML = `<div class="world-boss-screen ${game.guild?'guild-boss-screen':''}">
          ${game.guild ? '<div class="world-boss-identity"><h3 id="guild-boss-name">Gorath</h3><span>'+ (game.active?'Em combate':'O boss escapou')+'</span></div>' : '<span class="world-boss-status-'+(game.active?'active':'defeated')+'">Estado</span><h2 id="world-boss-name">Gorath</h2>'}
          <div class="world-boss-life-track" role="progressbar" aria-valuenow="${game.hp}"></div>
          ${game.guild?'':'<div class="world-boss-personal"><div><span>Suas investidas</span><strong>'+game.attacks+'</strong></div></div>'}
          ${game.error?'<div class="world-boss-error" role="alert">Falha ao atualizar</div>':''}
          <section class="world-boss-assault">
          ${game.guild?'<h3>Sua investida</h3><p>'+game.attacks+'/8 investidas usadas</p>':''}
          ${game.cooldown?(game.guild?'<div class="guild-countdown guild-countdown-recharge" data-state="active" aria-label="Próximo ataque em"><time>09:16</time></div>':'<p class="world-boss-cooldown">Próximo ataque em <strong>15:00</strong></p>'):''}
          <fieldset class="world-boss-attacks" ${game.fieldsetDisabled?'disabled':''}>
            ${[['basic','Ataque simples',100],['fire','Fogo',1200],['ice','Gelo',800]].map(([id,name,damage])=>`
            <label class="world-boss-attack-option ${game.used.includes(id)?'is-used':''}">
              <input type="radio" name="${game.guild?'guild':'world'}-boss-attack" value="${id}" ${game.selected===id?'checked':''} ${game.used.includes(id)?'disabled':''}>
              <span><strong>${name}</strong><small>Disponível</small></span><b>${damage.toLocaleString('pt-BR')}<small>dano</small></b>
            </label>`).join('')}
          </fieldset>
          <button class="world-boss-strike" ${game.cooldown?'disabled':''}>Atacar boss</button></section></div>`;
      };
      document.getElementById('bossNav').onclick = render;
      document.addEventListener('change', event=>{if(['world-boss-attack','guild-boss-attack'].includes(event.target.name)){game.selected=event.target.value;render();}});
      document.addEventListener('click', event=>{
        if (!event.target.closest('.world-boss-strike')) return;
        game.clicks.push(game.selected);
        if(game.noConfirm) return;
        game.attacks++;game.cooldown=true;
        if(game.selected!=='basic')game.used.push(game.selected);
        game.selected='basic';render();
      });
      if (!game.offscreen) render();
    }, options);
    await page.addScriptTag({path:path.join(root,'boss.js')});
    const t = {
      page,
      start:()=>page.evaluate(()=>aurenBoss.iniciar()),
      tick:ms=>page.clock.runFor(ms),
      game:()=>page.evaluate(()=>game),
      set:value=>page.evaluate(value=>{Object.assign(game,value);render();}, value),
      status:()=>page.evaluate(()=>document.getElementById('auren-cacada-v3').shadowRoot.getElementById('statusBoss').textContent)
    };
    try {await run(t);assert.deepEqual(errors,[]);count++;console.log('PASS:',name);}
    finally {await page.close();}
  }
  try {
    await test('escolhe maior dano e confirma uma única investida',async t=>{
      await t.start();await t.tick(6600);
      assert.deepEqual((await t.game()).clicks,['fire']);
      assert.notEqual((await t.game()).huntPaused,true);
      assert.equal(await t.page.evaluate(()=>aurenBoss.temPendente()),false);
    });
    await test('espera 15 minutos e escolhe próxima habilidade disponível',async t=>{
      await t.start();await t.tick(6600);
      await t.tick(890000);assert.deepEqual((await t.game()).clicks,['fire']);
      await t.set({cooldown:false});
      await t.tick(20000);assert.deepEqual((await t.game()).clicks,['fire','ice']);
    });
    await test('repete ataque simples quando as habilidades estão em recarga',async t=>{
      await t.start();await t.tick(4400);assert.deepEqual((await t.game()).clicks,['basic']);
    },{used:['fire','ice']});
    for (const attacks of [8,9]) await test('respeita contagem já existente de investidas '+attacks,async t=>{
      await t.start();await t.tick(4400);
      assert.deepEqual((await t.game()).clicks,[]);
      assert.match(await t.status(),/Limite de 8 ataques/);
    },{attacks});
    await test('faz a oitava investida e impede a nona mesmo após 15 minutos',async t=>{
      await t.start();await t.tick(6600);
      assert.equal((await t.game()).attacks,8);
      assert.deepEqual((await t.game()).clicks,['fire']);
      await t.set({cooldown:false});
      await t.tick(16*60000);
      assert.deepEqual((await t.game()).clicks,['fire']);
      assert.match(await t.status(),/Limite de 8 ataques/);
    },{attacks:7});
    await test('contagem de um novo encontro libera novas investidas',async t=>{
      await t.start();await t.tick(4400);
      assert.deepEqual((await t.game()).clicks,[]);
      await t.set({attacks:0});
      await t.tick(6600);
      assert.deepEqual((await t.game()).clicks,['fire']);
    },{attacks:8});
    for(const options of [{active:false},{hp:0},{cooldown:true},{fieldsetDisabled:true},{occupied:true}]) {
      await test('respeita bloqueio do jogo '+JSON.stringify(options),async t=>{
        await t.start();await t.tick(8800);assert.deepEqual((await t.game()).clicks,[]);
      }, options);
    }
    await test('erro do jogo pausa os ataques',async t=>{
      await t.start();await t.tick(4400);assert.deepEqual((await t.game()).clicks,[]);
      assert.equal(await t.page.evaluate(()=>aurenBoss.ativo()),false);
    },{error:true});
    await test('verificação e diálogo bloqueiam ataques',async t=>{
      await t.page.evaluate(()=>aurenAvisos.verificacaoHumana=true);
      await t.start();await t.tick(4400);assert.deepEqual((await t.game()).clicks,[]);
      await t.page.evaluate(()=>{aurenAvisos.verificacaoHumana=false;document.body.insertAdjacentHTML('beforeend','<div role="dialog">Confirme</div>');});
      await t.tick(4400);assert.deepEqual((await t.game()).clicks,[]);
      await t.page.locator('[role=dialog]').evaluate(el=>el.remove());
      await t.tick(4400);assert.deepEqual((await t.game()).clicks,['fire']);
    });
    await test('pausa e retomada não repetem ataque sem confirmação',async t=>{
      await t.start();await t.tick(50000);
      assert.equal(await t.page.evaluate(()=>aurenBoss.ativo()),false);
      await t.start();await t.tick(6600);assert.deepEqual((await t.game()).clicks,['fire']);
      assert.equal(await t.page.evaluate(()=>JSON.parse(sessionStorage.getItem('aurenBossInvestidasV2')).mundo.pendente),true);
    },{noConfirm:true});
    await test('pausa antes do clique impede ataque',async t=>{
      await t.start();await t.page.evaluate(()=>aurenBoss.pausar());
      await t.tick(6600);assert.deepEqual((await t.game()).clicks,[]);
    });
    await test('abre Boss pela navegação do jogo',async t=>{
      await t.start();await t.tick(6600);assert.deepEqual((await t.game()).clicks,['fire']);
    },{offscreen:true});
    await test('reinicialização preserva confirmação pendente na aba',async t=>{
      await t.start();await t.tick(4400);
      await t.page.evaluate(()=>{aurenBoss.pausar();delete window.aurenBoss;});
      await t.page.addScriptTag({path:path.join(root,'boss.js')});
      await t.start();await t.tick(4400);
      assert.deepEqual((await t.game()).clicks,['fire']);
      await t.set({attacks:1,cooldown:true});await t.tick(4400);
      assert.equal(await t.page.evaluate(()=>aurenBoss.temPendente()),false);
    },{noConfirm:true});
    await test('dano desconhecido impede escolha arbitrária',async t=>{
      await t.page.locator('.world-boss-attack-option b').first().evaluate(el=>el.firstChild.textContent='?');
      await t.start();await t.tick(4400);
      assert.deepEqual((await t.game()).clicks,[]);
      assert.match(await t.status(),/comparar o dano/);
    });
    await test('guilda: reconhece combate e escolhe o maior dano com 3 de 8 usadas',async t=>{
      await t.start();await t.tick(6600);
      assert.deepEqual((await t.game()).clicks,['fire']);
      assert.equal((await t.game()).attacks,4);
      assert.equal(await t.page.evaluate(()=>aurenBoss.temPendente()),false);
    },{guild:true,attacks:3});
    await test('guilda: aguarda a recarga da imagem e ataca quando o jogo libera',async t=>{
      await t.start();await t.tick(4400);
      assert.deepEqual((await t.game()).clicks,[]);
      assert.match(await t.status(),/liberar a próxima/);
      await t.set({cooldown:false});await t.tick(6600);
      assert.deepEqual((await t.game()).clicks,['fire']);
    },{guild:true,attacks:3,cooldown:true});
    await test('guilda: respeita as 8 investidas usadas',async t=>{
      await t.start();await t.tick(4400);
      assert.deepEqual((await t.game()).clicks,[]);
      assert.match(await t.status(),/Limite de 8/);
    },{guild:true,attacks:8});
    await test('guilda: boss encerrado não é atacado',async t=>{
      await t.start();await t.tick(4400);
      assert.deepEqual((await t.game()).clicks,[]);
      assert.match(await t.status(),/da guilda ativo/);
    },{guild:true,active:false});
    await test('intervalos da guilda e do mundo são independentes mesmo com o mesmo nome',async t=>{
      await t.start();await t.tick(6600);
      assert.deepEqual((await t.game()).clicks,['fire']);
      await t.set({guild:true,attacks:0,selected:'basic',cooldown:false,used:[]});
      await t.tick(6600);
      assert.deepEqual((await t.game()).clicks,['fire','fire']);
      const estados=await t.page.evaluate(()=>JSON.parse(sessionStorage.getItem('aurenBossInvestidasV2')));
      assert.equal(estados.mundo.pendente,false);
      assert.equal(estados.guilda.pendente,false);
    });
    await test('destino guilda não ataca o boss do mundo',async t=>{
      await t.start();await t.tick(4400);
      assert.deepEqual((await t.game()).clicks,[]);
      assert.match(await t.status(),/Abra a tela/);
    },{destino:'guilda'});
    await test('guilda: reinicialização preserva uma investida sem confirmação',async t=>{
      await t.start();await t.tick(4400);
      await t.page.evaluate(()=>{aurenBoss.pausar();delete window.aurenBoss;});
      await t.page.addScriptTag({path:path.join(root,'boss.js')});
      await t.start();await t.tick(4400);
      assert.deepEqual((await t.game()).clicks,['fire']);
      await t.set({attacks:4,cooldown:true});await t.tick(4400);
      assert.equal(await t.page.evaluate(()=>aurenBoss.temPendente()),false);
    },{guild:true,attacks:3,noConfirm:true});
    await test('migra confirmação pendente da versão anterior como Boss do mundo',async t=>{
      await t.page.evaluate(()=>{
        aurenBoss.pausar();delete window.aurenBoss;
        sessionStorage.setItem('aurenBossInvestidaV1',JSON.stringify({boss:'gorath',ataques:3,enviadoEm:Date.now(),pendente:true}));
      });
      await t.page.addScriptTag({path:path.join(root,'boss.js')});
      await t.start();await t.tick(4400);
      assert.deepEqual((await t.game()).clicks,[]);
      await t.set({attacks:4,cooldown:true});await t.tick(4400);
      const estado=await t.page.evaluate(()=>JSON.parse(sessionStorage.getItem('aurenBossInvestidasV2')));
      assert.equal(estado.mundo.pendente,false);
    },{attacks:3});
    for(const guild of [false,true])await test('primeiro ataque liberado não espera intervalo salvo de outro encontro '+guild,async t=>{
      await t.page.evaluate(guild=>{
        aurenBoss.pausar();delete window.aurenBoss;
        const tipo=guild?'guilda':'mundo';
        sessionStorage.setItem('aurenBossInvestidasV2',JSON.stringify({[tipo]:{boss:'gorath',ataques:7,enviadoEm:Date.now(),pendente:false}}));
      },guild);
      await t.page.addScriptTag({path:path.join(root,'boss.js')});
      await t.start();await t.tick(6600);
      assert.deepEqual((await t.game()).clicks,['fire']);
    },{guild});
    await test('reage à seleção e confirma a investida em menos de um ciclo periódico',async t=>{
      await t.start();await t.tick(500);
      assert.deepEqual((await t.game()).clicks,['fire']);
      assert.equal(await t.page.evaluate(()=>aurenBoss.temPendente()),false);
    });
    await test('mensagem de espera estável não reescreve o painel',async t=>{
      await t.start();await t.tick(3000);
      await t.page.evaluate(()=>{
        const status=document.getElementById('auren-cacada-v3').shadowRoot.getElementById('statusBoss');
        window.statusWrites=0;
        new MutationObserver(records=>{window.statusWrites+=records.length;}).observe(status,{childList:true,subtree:true,characterData:true});
      });
      await t.tick(10000);
      assert.equal(await t.page.evaluate(()=>window.statusWrites),0);
      assert.deepEqual((await t.game()).clicks,['fire']);
    });
    await test('alterar o painel não dispara leitura extra do jogo',async t=>{
      await t.start();
      await t.page.evaluate(()=>{
        const original=document.querySelectorAll.bind(document);
        window.gameQueries=0;
        document.querySelectorAll=selector=>{window.gameQueries++;return original(selector);};
        document.getElementById('auren-cacada-v3').classList.add('painel-em-teste');
      });
      await t.tick(500);
      assert.equal(await t.page.evaluate(()=>window.gameQueries),0);
      assert.deepEqual((await t.game()).clicks,[]);
    },{occupied:true});
    console.log('TOTAL',count);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
