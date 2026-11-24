(() => {
  'use strict';
  if (window.aurenBoss) return;
  const normal = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const visivel = el => !!el?.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const liberado = el => !!el && !el.matches(':disabled') && el.getAttribute('aria-disabled') !== 'true' && el.getAttribute('aria-busy') !== 'true';
  const habilitado = el => visivel(el) && liberado(el);
  const todos = (selector, scope = document) => [...scope.querySelectorAll(selector)].filter(visivel);
  const unico = list => list.length === 1 ? list[0] : null;
  const inteiro = value => {
    const text = String(value || '').trim();
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(text)) return null;
    const result = Number(text.replaceAll('.', ''));
    return Number.isSafeInteger(result) ? result : null;
  };
  const chave = 'aurenBossInvestidasV2';
  let timer = null, cicloAgendado = null, controles = null, navegou = false, estados = {};
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
  function informar(text) {
    if (controles && controles.status.textContent !== text) controles.status.textContent = text;
  }
  function pausar(text = 'Boss pausado.') {
    clearInterval(timer);
    clearTimeout(cicloAgendado);
    timer = null;
    cicloAgendado = null;
    observar.disconnect();
    window.aurenSegundoPlano?.remover('boss');
    if (controles) controles.iniciar.disabled = false;
    encerrarVisita(text);
  }
  function encerrarVisita(text, espera = 60000) {
    informar(text);
    proximaConsulta = Date.now() + espera;
    navegou = false;
    if (!controle || devolvendo) return;
    devolvendo = true;
    Promise.resolve(window.aurenCacada.retornarDoBoss?.()).catch(error=>{
      informar(`Falha ao voltar à Caçada: ${error.message}`);
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
      encerrarVisita('Não consegui abrir o combate. Nova tentativa em 1 min.'); return;
    }
    const destino = controles.destino?.value || 'auto';
    const tipo = destino === 'auto' ? tipoAcompanhado || 'mundo' : destino;
    const rotulo = el => normal(el.getAttribute('aria-label') || el.textContent);
    const menuGuilda = unico(todos('.guild-hub-nav button').filter(el=>rotulo(el) === 'boss'));
    if (tipo === 'guilda' && menuGuilda) {
      if (menuGuilda.getAttribute('aria-pressed') !== 'true' && habilitado(menuGuilda)) menuGuilda.click();
      informar('Abrindo o Boss da guilda…'); return;
    }
    if (navegou) { informar('Carregando o Boss…'); return; }
    const botao = unico(todos('nav button, nav a, aside button, aside a, [role="navigation"] button, [role="navigation"] a')
      .filter(el=>!el.closest('.guild-hub-nav') && rotulo(el) === (tipo === 'guilda' ? 'guildas' : 'boss')));
    if (!habilitado(botao)) { encerrarVisita('Abra a tela do Boss escolhido. Nova tentativa em 1 min.'); return; }
    navegou = true; botao.click();
    informar(tipo === 'guilda' ? 'Abrindo Guildas…' : 'Abrindo o Boss do mundo…');
  }
  function salvar(tipo, next) {
    // Grava antes de clicar para preservar a confirmação mesmo após uma recarga.
    const proximos = {...estados, [tipo]:next};
    sessionStorage.setItem(chave, JSON.stringify(proximos));
    estados = proximos;
  }
  function esperaRecarga(recarga) {
    const duracao = recarga?.querySelector('time')?.getAttribute('datetime')?.match(/^PT(\d+)S$/);
    if (duracao) return Math.max(2200, Number(duracao[1]) * 1000);
    const relogio = normal(recarga?.querySelector('strong, time')?.textContent).match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
    if (!relogio) return 30000;
    const [, primeiro, segundo, terceiro] = relogio;
    const segundos = terceiro === undefined
      ? Number(primeiro) * 60 + Number(segundo)
      : Number(primeiro) * 3600 + Number(segundo) * 60 + Number(terceiro);
    return Math.max(2200, segundos * 1000);
  }
  function lerCombate() {
    const destino = controles.destino?.value || 'auto';
    const seletor = destino === 'guilda' ? '.guild-boss-screen'
      : destino === 'mundo' ? '.world-boss-screen:not(.guild-boss-screen)'
      : '.world-boss-screen, .guild-boss-screen';
    const tela = unico(todos(seletor));
    if (!tela) return null;
    const tipo = tela.matches('.guild-boss-screen') ? 'guilda' : 'mundo';
    const boss = normal(tela.querySelector(tipo === 'guilda' ? '#guild-boss-name' : '#world-boss-name')?.textContent);
    let ataques, ativo;
    if (tipo === 'guilda') {
      const usadas = unico(todos('.world-boss-assault > p', tela).filter(el=>/^\d+\s*\/\s*8 investidas usadas$/.test(normal(el.textContent))));
      const identidade = unico(todos('.world-boss-identity', tela));
      ataques = inteiro(normal(usadas?.textContent).split('/')[0]);
      ativo = !!identidade && [...identidade.querySelectorAll('span')].some(el=>normal(el.textContent) === 'em combate');
    } else {
      const pessoal = unico(todos('.world-boss-personal', tela));
      const contador = pessoal && unico([...pessoal.children].filter(el=>normal(el.querySelector('span')?.textContent) === 'suas investidas'));
      ataques = inteiro(contador?.querySelector('strong')?.textContent);
      ativo = !!unico(todos('.world-boss-status-active', tela));
    }
    const recarga = unico(todos('.world-boss-cooldown, .guild-countdown-recharge[data-state="active"]', tela));
    return {tela, tipo, boss, ataques, ativo, recarga:!!recarga, esperaRecarga:esperaRecarga(recarga)};
  }
  function ciclo() {
    if (!timer || devolvendo) return;
    try {
      if (document.hidden && !controles.continuarOculta.checked) { pausar('Aba oculta. Boss pausado.'); return; }
      if (window.aurenAvisos?.verificar() || window.aurenAvisos?.verificacaoHumana) { informar('Responda à verificação do jogo.'); return; }
      if (todos('dialog[open], [role="dialog"], [aria-modal="true"], .item-detail-popover').length) { informar('Feche a janela do jogo.'); return; }
      const combate = lerCombate();
      if (!combate) {
        if (Date.now() < proximaConsulta) return;
        if (!reservar()) { informar('Aguardando a ação da caçada.'); return; }
        abrirCombate(); return;
      }
      if (!reservar()) { informar('Aguardando a ação da caçada.'); return; }
      const {tela, tipo, boss, ataques, ativo, recarga, esperaRecarga} = combate;
      tipoAcompanhado = tipo;
      const estado = estados[tipo];
      if (estado?.pendente) {
        if (boss === estado.boss && ataques !== null && ataques > estado.ataques) {
          salvar(tipo, {...estado, pendente:false});
          encerrarVisita('Investida confirmada. Aguardando a próxima.', recarga ? esperaRecarga : 15*60000);
        } else if (Date.now() - estado.enviadoEm > (window.aurenSegundoPlano?.prazo(45000) ?? 45000)) {
          pausar('Investida sem confirmação. Confira a contagem no Boss.');
        } else informar('Aguardando a confirmação da investida…');
        return;
      }
      if (todos('.world-boss-error', tela).length) { pausar('Erro no Boss. Confira a mensagem do jogo.'); return; }
      if (!ativo) { encerrarVisita(`Aguardando um Boss ${tipo === 'guilda' ? 'da guilda' : 'do mundo'} ativo.`); return; }
      if (!boss || ataques === null) { encerrarVisita('Aguardando nome e contagem de investidas.', 30000); return; }
      if (ataques >= 8) { encerrarVisita('Limite de 8 ataques atingido. Aguardando o próximo Boss.'); return; }
      const vida = unico(todos('.world-boss-life-track[role="progressbar"]', tela));
      if (!(Number(vida?.getAttribute('aria-valuenow')) > 0)) { encerrarVisita('Boss sem vida para atacar.'); return; }
      if (recarga) { encerrarVisita('Aguardando o jogo liberar a próxima investida.', esperaRecarga); return; }
      const opcoes = todos('.world-boss-attack-option', tela).filter(el=>!el.classList.contains('is-used')).map(el=>{
        const input = unico(todos(`input[type="radio"][name="${tipo === 'guilda' ? 'guild' : 'world'}-boss-attack"]`, el));
        const dano = el.querySelector('b');
        const valor = dano && [...dano.childNodes].filter(node=>node.nodeType === Node.TEXT_NODE).map(node=>node.textContent).join('');
        return {el, input, dano:inteiro(valor)};
      }).filter(opcao=>liberado(opcao.input));
      if (!opcoes.length) { encerrarVisita('Aguardando um ataque disponível.', 30000); return; }
      if (opcoes.some(opcao=>opcao.dano === null)) { pausar('Não consegui comparar o dano. Confira os ataques do Boss.'); return; }
      const melhor = opcoes.reduce((a,b)=>b.dano > a.dano ? b : a);
      if (!melhor.input.checked) { melhor.input.click(); informar('Selecionando o maior dano…'); return; }
      const atacar = unico(todos('button.world-boss-strike', tela));
      if (!habilitado(atacar)) { encerrarVisita('Aguardando o jogo liberar o ataque escolhido.', 30000); return; }
      const nome = melhor.el.querySelector('strong')?.textContent || 'Ataque';
      salvar(tipo, {boss, ataques, enviadoEm:Date.now(), pendente:true});
      atacar.click();
      informar(`${nome}: ${melhor.dano} de dano. Aguardando confirmação…`);
    } catch (error) { pausar(`Não consegui continuar o Boss: ${error.message}`); }
  }
  const observar = new MutationObserver(registros=>{
    if (!timer || devolvendo || cicloAgendado !== null) return;
    const mudouJogo = registros.some(registro=>{
      const alvo = registro.target.nodeType === Node.ELEMENT_NODE ? registro.target : registro.target.parentElement;
      return alvo && !alvo.closest('#auren-cacada-v3');
    });
    if (!mudouJogo) return;
    cicloAgendado = setTimeout(()=>{
      cicloAgendado = null;
      ciclo();
    },150);
  });
  function iniciar() {
    if (!controles || timer || devolvendo) return;
    proximaConsulta = 0; tipoAcompanhado = null;
    navegou = false;
    timer = setInterval(ciclo, 2200);
    observar.observe(document.documentElement,{
      subtree:true,childList:true,characterData:true,attributes:true,
      attributeFilter:['disabled','aria-disabled','aria-busy','aria-pressed','aria-selected','aria-checked','aria-valuenow','checked','class','hidden']
    });
    window.aurenSegundoPlano?.registrar('boss',ciclo);
    controles.iniciar.disabled = true;
    ciclo();
  }
  window.aurenBoss = {iniciar, pausar, ativo:()=>!!timer, temPendente:()=>Object.values(estados).some(estado=>estado.pendente)};
  document.addEventListener('visibilitychange',()=>{
    if (timer && document.hidden && !controles.continuarOculta.checked) pausar('Aba oculta. Boss pausado.');
  });
  // O painel principal aguarda o jogo carregar antes de criar seus controles.
  const conectar = () => {
    const root = document.getElementById('auren-cacada-v3')?.shadowRoot;
    if (!window.aurenCacada || !root?.getElementById('iniciarBoss')) return false;
    controles = {
      destino:root.getElementById('bossDestino'),
      continuarOculta:root.getElementById('continuarOculta'),
      iniciar:root.getElementById('iniciarBoss'),
      status:root.getElementById('statusBoss')
    };
    controles.iniciar.onclick = iniciar;
    root.getElementById('pausarBoss').onclick = () => pausar();
    return true;
  };
  if (!conectar()) {
    const observer = new MutationObserver(()=>{if (conectar()) observer.disconnect();});
    observer.observe(document.documentElement, {childList:true, subtree:true});
  }
})();
