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
    if (root) root.getElementById('iniciarBoss').disabled = false;
    informar(text);
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
    const recarga = todos('.world-boss-cooldown, .guild-countdown-recharge[data-state="active"]', tela).length > 0;
    return {tela, tipo, boss, ataques, ativo, recarga};
  }
  function ciclo() {
    if (!timer) return;
    try {
      if (document.hidden && !root.getElementById('continuarOculta').checked) { pausar('Você saiu da aba do jogo. Boss pausado.'); return; }
      if (window.aurenAvisos?.verificar() || window.aurenAvisos?.verificacaoHumana) { informar('Responda à verificação do jogo para continuar o Boss.'); return; }
      if (todos('dialog[open], [role="dialog"], [aria-modal="true"], .item-detail-popover').length) { informar('Feche a janela do jogo para continuar o Boss.'); return; }
      const combate = lerCombate();
      if (!combate) {
        if (root.getElementById('bossDestino')?.value === 'guilda') {
          informar('Abra Guildas → Boss no jogo para acompanhar o Boss da guilda.'); return;
        }
        if (navegou) { informar('Abra a tela Boss para continuar.'); return; }
        const botao = unico(todos('nav button, nav a, aside button, aside a, [role="navigation"] button, [role="navigation"] a').filter(el=>
          normal(el.getAttribute('aria-label') || el.textContent) === 'boss'));
        if (!habilitado(botao)) { informar('Não encontrei o botão Boss. Abra o Boss do servidor no jogo.'); return; }
        navegou = true; botao.click();
        informar('Abrindo o Boss do servidor…'); return;
      }
      const {tela, tipo, boss, ataques, ativo, recarga} = combate;
      const estado = estados[tipo];
      if (estado?.pendente) {
        if (boss === estado.boss && ataques !== null && ataques > estado.ataques) {
          salvar(tipo, {...estado, pendente:false, enviadoEm:Date.now()});
          informar('Investida confirmada. Aguardando o próximo ataque.');
        } else if (Date.now() - estado.enviadoEm > 45000) {
          pausar('O jogo ainda não confirmou a investida. Confira suas investidas na tela Boss antes de continuar.');
        } else informar('Aguardando a confirmação da investida…');
        return;
      }
      if (todos('.world-boss-error', tela).length) { pausar('O jogo exibiu um erro no Boss. Confira a mensagem e clique em Iniciar Boss.'); return; }
      if (!ativo) { informar(`Aguardando um Boss ${tipo === 'guilda' ? 'da guilda' : 'do mundo'} ativo.`); return; }
      if (!boss || ataques === null) { informar('Aguardando o nome do Boss e a contagem das suas investidas.'); return; }
      if (ataques >= 8) { informar('Limite de 8 ataques por pessoa atingido neste encontro. Aguardando o próximo Boss.'); return; }
      const vida = unico(todos('.world-boss-life-track[role="progressbar"]', tela));
      if (!(Number(vida?.getAttribute('aria-valuenow')) > 0)) { informar('O Boss não tem vida disponível para atacar.'); return; }
      if (estado && Date.now() - estado.enviadoEm < 15 * 60000) { informar('Aguardando o intervalo de 15 minutos entre investidas.'); return; }
      if (recarga) { informar('Aguardando o jogo liberar a próxima investida.'); return; }
      const opcoes = todos('.world-boss-attack-option', tela).filter(el=>!el.classList.contains('is-used')).map(el=>{
        const input = unico(todos(`input[type="radio"][name="${tipo === 'guilda' ? 'guild' : 'world'}-boss-attack"]`, el));
        const dano = el.querySelector('b');
        const valor = dano && [...dano.childNodes].filter(node=>node.nodeType === Node.TEXT_NODE).map(node=>node.textContent).join('');
        return {el, input, dano:inteiro(valor)};
      }).filter(opcao=>habilitado(opcao.input));
      if (!opcoes.length) { informar('Aguardando um ataque disponível.'); return; }
      if (opcoes.some(opcao=>opcao.dano === null)) { pausar('Não consegui comparar o dano dos ataques do Boss. Confira a tela.'); return; }
      const melhor = opcoes.reduce((a,b)=>b.dano > a.dano ? b : a);
      if (!melhor.input.checked) { melhor.input.click(); informar('Selecionando o ataque com maior dano disponível…'); return; }
      const atacar = unico(todos('button.world-boss-strike', tela));
      if (!habilitado(atacar)) { informar('Aguardando o jogo liberar o ataque escolhido.'); return; }
      const nome = melhor.el.querySelector('strong')?.textContent || 'Ataque';
      salvar(tipo, {boss, ataques, enviadoEm:Date.now(), pendente:true});
      atacar.click();
      informar(`Usando ${nome} (${melhor.dano} de dano). Aguardando confirmação…`);
    } catch (error) { pausar(`Não consegui continuar o Boss: ${error.message}`); }
  }
  function iniciar() {
    if (!root || timer) return;
    if (window.aurenCacada.ocupado()) { informar('Termine a ação pendente da caçada ou expedição antes de iniciar o Boss.'); return; }
    window.aurenCacada.pausar('Caçada pausada para acompanhar o Boss.');
    navegou = false;
    timer = setInterval(ciclo, 2200);
    root.getElementById('iniciarBoss').disabled = true;
    ciclo();
  }
  window.aurenBoss = {iniciar, pausar, ativo:()=>!!timer, temPendente:()=>Object.values(estados).some(estado=>estado.pendente)};
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
