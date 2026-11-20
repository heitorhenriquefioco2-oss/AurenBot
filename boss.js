(() => {
  'use strict';
  if (window.aurenBoss) return;
  const normal = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const visivel = el => !!el?.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const habilitado = el => visivel(el) && !el.matches(':disabled') && el.getAttribute('aria-disabled') !== 'true' && el.getAttribute('aria-busy') !== 'true';
  const todos = (selector, scope = document) => [...scope.querySelectorAll(selector)].filter(visivel);
  const unico = list => list.length === 1 ? list[0] : null;
  const inteiro = value => {
    const text = String(value || '').trim();
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(text)) return null;
    const result = Number(text.replaceAll('.', ''));
    return Number.isSafeInteger(result) ? result : null;
  };
  const chave = 'aurenBossInvestidasV2';
  let timer = null, root = null, navegou = false, estados = {};
  let controle = false, devolvendo = false, proximaConsulta = 0, tipoAcompanhado = null, inicioNavegacao = 0;
  try {
    const salvos = JSON.parse(sessionStorage.getItem(chave) || 'null') ||
      {mundo:JSON.parse(sessionStorage.getItem('aurenBossInvestidaV1') || 'null')};
    for (const tipo of ['mundo', 'guilda']) {
      const saved = salvos[tipo];
      if (saved && typeof saved.boss === 'string' && Number.isSafeInteger(saved.ataques) &&
          Number.isFinite(saved.enviadoEm) && typeof saved.pendente === 'boolean') estados[tipo] = saved;
    }
  } catch { /* Uma nova sessão começa pausada. */ }
  const informar = text => { if (root) root.getElementById('statusBoss').textContent = text; };
  function pausar(text = 'Boss pausado. Clique em Iniciar Boss para continuar.') {
    clearInterval(timer); timer = null;
    window.aurenSegundoPlano?.remover('boss');
    if (root) root.getElementById('iniciarBoss').disabled = false;
    encerrarVisita(text);
  }
  function encerrarVisita(text, espera = 60000) {
    informar(text);
    proximaConsulta = Date.now() + espera;
    navegou = false;
    if (!controle || devolvendo) return;
    devolvendo = true;
    Promise.resolve(window.aurenCacada.retornarDoBoss?.()).catch(error=>{
      informar(`Confira a volta à Caçada: ${error.message}`);
    }).finally(()=>{
      window.aurenCacada.liberarBoss?.();
      controle = false; devolvendo = false;
    });
  }
  function reservar() {
    if (controle) return true;
    const api = window.aurenCacada;
    if (api.reservarBoss ? !api.reservarBoss() : api.ocupado()) return false;
    controle = true; inicioNavegacao = Date.now();
    return true;
  }
  function abrirCombate() {
    if (Date.now() - inicioNavegacao > (window.aurenSegundoPlano?.prazo(15000) ?? 15000)) {
      encerrarVisita('Não consegui abrir o combate. Vou conferir novamente em 1 minuto.'); return;
    }
    const destino = root.getElementById('bossDestino')?.value || 'auto';
    const tipo = destino === 'auto' ? tipoAcompanhado || 'mundo' : destino;
    const rotulo = el => normal(el.getAttribute('aria-label') || el.textContent);
    const menuGuilda = unico(todos('.guild-hub-nav button').filter(el=>rotulo(el) === 'boss'));
    if (tipo === 'guilda' && menuGuilda) {
      if (menuGuilda.getAttribute('aria-pressed') !== 'true' && habilitado(menuGuilda)) menuGuilda.click();
      informar('Abrindo o Boss da guilda…'); return;
    }
    if (navegou) { informar('Aguardando a tela do Boss carregar…'); return; }
    const botao = unico(todos('nav button, nav a, aside button, aside a, [role="navigation"] button, [role="navigation"] a')
      .filter(el=>!el.closest('.guild-hub-nav') && rotulo(el) === (tipo === 'guilda' ? 'guildas' : 'boss')));
    if (!habilitado(botao)) { encerrarVisita('Abra a tela do Boss escolhido no jogo. Vou conferir novamente em 1 minuto.'); return; }
    navegou = true; botao.click();
    informar(tipo === 'guilda' ? 'Abrindo Guildas para conferir o Boss…' : 'Abrindo o Boss do mundo…');
  }
  function salvar(tipo, next) {
    // Grava antes de clicar para preservar a confirmação mesmo após uma recarga.
    const proximos = {...estados, [tipo]:next};
    sessionStorage.setItem(chave, JSON.stringify(proximos));
    estados = proximos;
  }
  function lerCombate() {
    const destino = root.getElementById('bossDestino')?.value || 'auto';
    const telas = todos('.world-boss-screen, .guild-boss-screen');
    const tela = unico(telas.filter(el=>destino === 'auto' ||
      (destino === 'guilda' ? el.matches('.guild-boss-screen') : !el.matches('.guild-boss-screen'))));
    if (!tela) return null;
    const tipo = tela.matches('.guild-boss-screen') ? 'guilda' : 'mundo';
    const boss = normal(tela.querySelector(tipo === 'guilda' ? '#guild-boss-name' : '#world-boss-name')?.textContent);
    const pessoal = unico(todos('.world-boss-personal', tela));
    const contador = pessoal && unico([...pessoal.children].filter(el=>normal(el.querySelector('span')?.textContent) === 'suas investidas'));
    const usadas = unico(todos('.world-boss-assault > p', tela).filter(el=>/^\d+\s*\/\s*8 investidas usadas$/.test(normal(el.textContent))));
    const ataques = tipo === 'guilda' ? inteiro(normal(usadas?.textContent).split('/')[0]) : inteiro(contador?.querySelector('strong')?.textContent);
    const identidade = unico(todos('.world-boss-identity', tela));
    const ativo = tipo === 'guilda' ? !!identidade && [...identidade.querySelectorAll('span')].some(el=>normal(el.textContent) === 'em combate') :
      !!unico(todos('.world-boss-status-active', tela));
    const recarga = unico(todos('.world-boss-cooldown, .guild-countdown-recharge[data-state="active"]', tela));
    const duracao = recarga?.querySelector('time')?.getAttribute('datetime')?.match(/^PT(\d+)S$/);
    const relogio = normal(recarga?.querySelector('strong, time')?.textContent).match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
    const segundos = duracao ? Number(duracao[1]) : relogio ? relogio[3] === undefined ?
      Number(relogio[1])*60+Number(relogio[2]) : Number(relogio[1])*3600+Number(relogio[2])*60+Number(relogio[3]) : null;
    return {tela, tipo, boss, ataques, ativo, recarga:!!recarga, esperaRecarga:segundos === null ? 30000 : Math.max(2200,segundos*1000)};
  }
  function ciclo() {
    if (!timer || devolvendo) return;
    try {
      if (document.hidden && !root.getElementById('continuarOculta').checked) { pausar('Você saiu da aba do jogo. Boss pausado.'); return; }
      if (window.aurenAvisos?.verificar() || window.aurenAvisos?.verificacaoHumana) { informar('Responda à verificação do jogo para continuar o Boss.'); return; }
      if (todos('dialog[open], [role="dialog"], [aria-modal="true"], .item-detail-popover').length) { informar('Feche a janela do jogo para continuar o Boss.'); return; }
      const combate = lerCombate();
      if (!combate) {
        if (Date.now() < proximaConsulta) return;
        if (!reservar()) { informar('A caçada está concluindo uma ação. Vou conferir o Boss em seguida.'); return; }
        abrirCombate(); return;
      }
      if (!reservar()) { informar('A caçada está concluindo uma ação. Vou conferir o Boss em seguida.'); return; }
      const {tela, tipo, boss, ataques, ativo, recarga, esperaRecarga} = combate;
      tipoAcompanhado = tipo;
      const estado = estados[tipo];
      if (estado?.pendente) {
        if (boss === estado.boss && ataques !== null && ataques > estado.ataques) {
          salvar(tipo, {...estado, pendente:false});
          encerrarVisita('Investida confirmada. A caçada pode continuar enquanto aguardo o próximo ataque.', recarga ? esperaRecarga : 15*60000);
        } else if (Date.now() - estado.enviadoEm > (window.aurenSegundoPlano?.prazo(45000) ?? 45000)) {
          pausar('O jogo ainda não confirmou a investida. Confira suas investidas na tela Boss antes de continuar.');
        } else informar('Aguardando a confirmação da investida…');
        return;
      }
      if (todos('.world-boss-error', tela).length) { pausar('O jogo exibiu um erro no Boss. Confira a mensagem e clique em Iniciar Boss.'); return; }
      if (!ativo) { encerrarVisita(`Aguardando um Boss ${tipo === 'guilda' ? 'da guilda' : 'do mundo'} ativo.`); return; }
      if (!boss || ataques === null) { encerrarVisita('Aguardando o nome do Boss e a contagem das suas investidas.', 30000); return; }
      if (ataques >= 8) { encerrarVisita('Limite de 8 ataques por pessoa atingido neste encontro. Aguardando o próximo Boss.'); return; }
      const vida = unico(todos('.world-boss-life-track[role="progressbar"]', tela));
      if (!(Number(vida?.getAttribute('aria-valuenow')) > 0)) { encerrarVisita('O Boss não tem vida disponível para atacar.'); return; }
      if (recarga) { encerrarVisita('Aguardando o jogo liberar a próxima investida.', esperaRecarga); return; }
      const opcoes = todos('.world-boss-attack-option', tela).filter(el=>!el.classList.contains('is-used')).map(el=>{
        const input = unico(todos(`input[type="radio"][name="${tipo === 'guilda' ? 'guild' : 'world'}-boss-attack"]`, el));
        const dano = el.querySelector('b');
        const valor = dano && [...dano.childNodes].filter(node=>node.nodeType === Node.TEXT_NODE).map(node=>node.textContent).join('');
        return {el, input, dano:inteiro(valor)};
      }).filter(opcao=>habilitado(opcao.input));
      if (!opcoes.length) { encerrarVisita('Aguardando um ataque disponível.', 30000); return; }
      if (opcoes.some(opcao=>opcao.dano === null)) { pausar('Não consegui comparar o dano dos ataques do Boss. Confira a tela.'); return; }
      const melhor = opcoes.reduce((a,b)=>b.dano > a.dano ? b : a);
      if (!melhor.input.checked) { melhor.input.click(); informar('Selecionando o ataque com maior dano disponível…'); return; }
      const atacar = unico(todos('button.world-boss-strike', tela));
      if (!habilitado(atacar)) { encerrarVisita('Aguardando o jogo liberar o ataque escolhido.', 30000); return; }
      const nome = melhor.el.querySelector('strong')?.textContent || 'Ataque';
      salvar(tipo, {boss, ataques, enviadoEm:Date.now(), pendente:true});
      atacar.click();
      informar(`Usando ${nome} (${melhor.dano} de dano). Aguardando confirmação…`);
    } catch (error) { pausar(`Não consegui continuar o Boss: ${error.message}`); }
  }
  function iniciar() {
    if (!root || timer || devolvendo) return;
    proximaConsulta = 0; tipoAcompanhado = null;
    navegou = false;
    timer = setInterval(ciclo, 2200);
    window.aurenSegundoPlano?.registrar('boss',ciclo);
    root.getElementById('iniciarBoss').disabled = true;
    ciclo();
  }
  window.aurenBoss = {iniciar, pausar, ativo:()=>!!timer, temPendente:()=>Object.values(estados).some(estado=>estado.pendente)};
  document.addEventListener('visibilitychange',()=>{
    if (timer && document.hidden && !root.getElementById('continuarOculta').checked) pausar('Você saiu da aba do jogo. Boss pausado.');
  });
  // O painel principal aguarda o jogo carregar antes de criar seus controles.
  const conectar = () => {
    root = document.getElementById('auren-cacada-v3')?.shadowRoot;
    if (!window.aurenCacada || !root?.getElementById('iniciarBoss')) return false;
    root.getElementById('iniciarBoss').onclick = iniciar;
    root.getElementById('pausarBoss').onclick = () => pausar();
    return true;
  };
  if (!conectar()) {
    const observer = new MutationObserver(()=>{if (conectar()) observer.disconnect();});
    observer.observe(document.documentElement, {childList:true, subtree:true});
  }
})();
