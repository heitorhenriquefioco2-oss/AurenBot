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
      host.attachShadow({mode:'open'}).innerHTML = '<button id="iniciarBoss">Iniciar Boss</button><button id="pausarBoss">Pausar Boss</button><input id="continuarOculta" type="checkbox" checked><output id="statusBoss"></output>';
      document.body.append(host);
      window.aurenCacada = {ocupado:()=>!!game.occupied, pausar:()=>{game.huntPaused=true;window.aurenBoss?.pausar();}};
      window.aurenAvisos = {verificar:()=>false, verificacaoHumana:false};
      window.render = ()=>{
        document.querySelector('main').innerHTML = `<div class="world-boss-screen">
          <span class="world-boss-status-${game.active?'active':'defeated'}">Estado</span><h2 id="world-boss-name">Gorath</h2>
          <div class="world-boss-life-track" role="progressbar" aria-valuenow="${game.hp}"></div>
          <div class="world-boss-personal"><div><span>Suas investidas</span><strong>${game.attacks}</strong></div></div>
          ${game.error?'<div class="world-boss-error" role="alert">Falha ao atualizar</div>':''}
          ${game.cooldown?'<p class="world-boss-cooldown">Próximo ataque em <strong>15:00</strong></p>':''}
          <fieldset class="world-boss-attacks" ${game.fieldsetDisabled?'disabled':''}>
            ${[['basic','Ataque simples',100],['fire','Fogo',1200],['ice','Gelo',800]].map(([id,name,damage])=>`
            <label class="world-boss-attack-option ${game.used.includes(id)?'is-used':''}">
              <input type="radio" name="world-boss-attack" value="${id}" ${game.selected===id?'checked':''} ${game.used.includes(id)?'disabled':''}>
              <span><strong>${name}</strong><small>Disponível</small></span><b>${damage.toLocaleString('pt-BR')}<small>dano</small></b>
            </label>`).join('')}
          </fieldset>
          <button class="world-boss-strike" ${game.cooldown?'disabled':''}>Atacar boss</button></div>`;
      };
      document.getElementById('bossNav').onclick = render;
      document.addEventListener('change', event=>{if(event.target.name==='world-boss-attack'){game.selected=event.target.value;render();}});
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
      assert.equal((await t.game()).huntPaused,true);
      assert.equal(await t.page.evaluate(()=>aurenBoss.temPendente()),false);
    });
    await test('espera 15 minutos e escolhe próxima habilidade disponível',async t=>{
      await t.start();await t.tick(6600);await t.set({cooldown:false});
      await t.tick(890000);assert.deepEqual((await t.game()).clicks,['fire']);
      await t.tick(20000);assert.deepEqual((await t.game()).clicks,['fire','ice']);
    });
    await test('repete ataque simples quando as habilidades estão em recarga',async t=>{
      await t.start();await t.tick(4400);assert.deepEqual((await t.game()).clicks,['basic']);
    },{used:['fire','ice']});
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
      assert.equal(await t.page.evaluate(()=>JSON.parse(sessionStorage.getItem('aurenBossInvestidaV1')).pendente),true);
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
    console.log('TOTAL',count);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
