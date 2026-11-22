(async () => {
  'use strict';
  // Interage somente com a interface visível; não chama APIs privadas.
  if (document.getElementById('auren-cacada-v3') || document.getElementById('auren-bot-panel')) {
    console.warn('Recarregue a página para encerrar o bot antigo antes de executar esta versão.');
    return;
  }
  let preferencias = {};
  let erroArmazenamento = false;

  const normal = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const texto = el => normal(el && [el.textContent, el.getAttribute('aria-label'), el.getAttribute('title')].filter(Boolean).join(' '));
  const visivel = el => !!el && el.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';
  const habilitado = el => visivel(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true' && el.getAttribute('aria-busy') !== 'true';
  const todos = (sel, scope = document) => [...scope.querySelectorAll(sel)].filter(visivel);
  const unico = xs => xs.length === 1 ? xs[0] : null;
  const numero = v => Number(String(v).replace(',', '.'));
  const agoraAtivo = () => Date.now() - (window.aurenAvisos?.tempoVerificacaoHumana || 0);
  const prazoInterface = ms => window.aurenSegundoPlano?.prazo(ms) ?? ms;
  const esperarInterface = () => window.aurenSegundoPlano?.esperar(200) ?? new Promise(resolve=>setTimeout(resolve,200));
  function avisosBloqueando(reportar = status) {
    const bloqueado = window.aurenAvisos?.verificar();
    if (window.aurenAvisos?.verificacaoHumana) reportar(window.aurenAvisos.tipoVerificacao === 'sombra' ? 'O jogo pediu uma resposta. Resolva o desafio de sombra para continuar.' : window.aurenAvisos.seloPronto ? 'A verificação está pronta. Clique em Apresentar o selo no jogo.' : 'Responda à verificação no jogo e clique em Apresentar o selo.');
    return !!bloqueado || !!window.aurenAvisos?.verificacaoHumana;
  }
  function percentual(valor, campo) {
    const texto = String(valor ?? '').trim().replace(/\s*%\s*$/, '').trim();
    if (!/^\d+(?:[.,]\d+)?$/.test(texto)) {
      throw Error(`${campo}: digite um número de 0 a 100. Exemplo: 80 ou 80,5.`);
    }
    const n = Number(texto.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 100) throw Error(`${campo}: digite um número de 0 a 100.`);
    return n;
  }
  const seletores = {
    // Mantém a chave legada da API; a leitura agora é do Vigor de caçada.
    vida: '.hunt-vitality progress, progress[aria-label="Vigor de caçada" i], .hero-header-status[aria-label*="Vigor" i] progress, .hunt-health-value > strong, .sanctum-vitals',
    criaturas: 'button, [role="button"], .monster-card, .hunt-monster-card',
    // Opcional: preencher pelo console se o jogo usar classes diferentes.
    selecionada: '', atacar: '', alivio: '', restauradora: '', resultado: ''
  };

  function decidir(c, hp, fadiga = null, ignorarFadiga = false) {
    if (!Number.isFinite(hp) || hp < 0 || hp > 100) return 'pausar';
    if (c.controlarFadiga && !ignorarFadiga) {
      if (!Number.isSafeInteger(fadiga) || fadiga < 0) return 'aguardarFadiga';
      if (fadiga + 1 >= c.limiteFadiga) {
        const aproveitar = c.aproveitarMaior && hp >= 30 && hp > c.vigorMaior &&
          fadiga + 1 <= c.limiteFadiga + c.folgaFadiga;
        return aproveitar ? 'atacar' : 'reduzirFadiga';
      }
    }
    if (hp >= c.atacar) return 'atacar';
    if (c.modo === 'natural' || (c.economizar && c.atacar - hp <= c.margem + 1e-9)) return 'regenerar';
    return hp <= c.limiteAlivio ? 'alivio' : 'regenerar';
  }

  function lerVigor() {
    const candidatos = todos(seletores.vida);
    // A barra da caçada mantém o valor preciso, mesmo quando o cabeçalho exibe outra atividade.
    candidatos.sort((a, b) => Number(b.matches('.hunt-vitality progress')) - Number(a.matches('.hunt-vitality progress')));
    for (const el of candidatos) {
      // Prioriza valores reais sobre percentuais arredondados da interface.
      const value = el.getAttribute('value'), max = el.getAttribute('max');
      if (value !== null && max !== null && numero(max) > 0) {
        const hp = numero(value) / numero(max) * 100;
        if (Number.isFinite(hp) && hp >= 0 && hp <= 100) return hp;
      }
      const t = el.getAttribute('aria-valuetext') || el.textContent || '';
      const fracao = t.match(/(\d+)\s*\/\s*(\d+)/);
      if (fracao && Number(fracao[2]) > 0 && Number(fracao[1]) <= Number(fracao[2])) return Number(fracao[1]) / Number(fracao[2]) * 100;
      const pct = t.match(/(\d+(?:[.,]\d+)?)\s*%/);
      if (pct && numero(pct[1]) <= 100) return numero(pct[1]);
    }
    return null;
  }

  function lerFadiga() {
    const paineis = todos('.hunt-fatigue');
    if (paineis.length !== 1) return null;
    const painel = paineis[0];
    const ponto = valor => {
      const s = String(valor).trim();
      if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(s)) return null;
      const n = Number(s.replace(/\./g, ''));
      return Number.isSafeInteger(n) && n >= 0 ? n : null;
    };
    const leituras = [];
    for (const el of painel.querySelectorAll('.hunt-fatigue-preview .realm-sr-only, .hunt-fatigue-preview [aria-hidden="true"]')) {
      const t = normal(el.textContent);
      const m = t.match(/^fadiga de ([\d.]+) para ([\d.]+)$/) || t.match(/^([\d.]+)\s*(?:→|->)\s*([\d.]+)$/);
      if (!m) continue;
      const atual = ponto(m[1]), depoisMaior = ponto(m[2]);
      if (atual === null || depoisMaior === null || depoisMaior >= atual) return null;
      leituras.push({atual, depoisMaior});
    }
    if (leituras.length) {
      const primeira = leituras[0];
      return leituras.every(l=>l.atual === primeira.atual && l.depoisMaior === primeira.depoisMaior) ? primeira : null;
    }
    // Em zero o jogo omite a previsão numérica. "Descansado" sozinho não serve: essa faixa também inclui 1–99.
    if (painel.querySelector('.hunt-fatigue-preview')) return null;
    const faixa = painel.querySelector('.hunt-fatigue-track');
    if (faixa && /^0(?:\.0+)?%$/.test(faixa.style.getPropertyValue('--hunt-fatigue-current').trim())) return {atual:0, depoisMaior:0};
    return null;
  }
  function consultarFadiga() {
    if (todos('dialog[open], [role="dialog"], [aria-modal="true"], .item-detail-popover').some(el=>!el.matches('.hunt-health-details') && !el.closest('.hunt-health-details'))) return null;
    const leitura = lerFadiga();
    if (leitura) return leitura;
    if (todos('dialog[open], [role="dialog"], [aria-modal="true"], .item-detail-popover').length) return null;
    const botao = unico(todos('button.item-detail-trigger').filter(el=>/^(detalhes do vigor|vigor details)$/.test(normal(el.getAttribute('aria-label') || el.getAttribute('title')))));
    const painel = botao && document.getElementById(botao.getAttribute('aria-controls'));
    if (!painel?.matches('.hunt-health-details') || !telaCacada()) return null;
    if (clicar(botao)) detalhesFadigaDoBot = painel;
    return lerFadiga();
  }
  function fecharDetalhesFadiga() {
    const paineis = todos('.hunt-health-details');
    if (!paineis.length) { detalhesFadigaDoBot = null; return true; }
    if (paineis.length !== 1) return false;
    const painel = paineis[0], fechar = unico(todos('button.item-detail-close', painel));
    if (!clicar(fechar)) return false;
    if (visivel(painel)) return false;
    detalhesFadigaDoBot = null;
    return true;
  }

  function nomeExato(el, nome) {
    if (normal(el.getAttribute('aria-label')) === nome) return true;
    if (normal(el.textContent) === nome) return true;
    return [...el.querySelectorAll('h2,h3,h4,strong,span,p,[class*="name"],[class*="title"]')].some(child => normal(child.textContent) === nome);
  }
  function localizarCriatura(nome) {
    const xs = todos(seletores.criaturas).filter(el => nomeExato(el, normal(nome)));
    // Descarta contêineres maiores que contenham outro candidato mais específico.
    return unico(xs.filter(el => !xs.some(other => other !== el && el.contains(other))));
  }
  function selecionada(el) {
    if (!el) return false;
    if (seletores.selecionada) return el.matches(seletores.selecionada) || !!el.querySelector(seletores.selecionada);
    return el.matches('[aria-pressed="true"],[aria-selected="true"],[data-selected="true"]') ||
      /(^|\s)(selected|is-selected|active|is-active)(\s|$)/.test(el.className || '');
  }
  function botoes() { return todos('button, [role="button"]', document.querySelector('main') || document); }
  function botaoAtacar() {
    if (seletores.atacar) return unico(todos(seletores.atacar));
    return unico(botoes().filter(el => /^(cacar e ver resultado|cacar|atacar|batalhar|enfrentar monstro)$/.test(rotuloControle(el))));
  }
  function rotuloControle(el) {
    const copia = el.cloneNode(true);
    copia.querySelectorAll('svg, img, [aria-hidden="true"], kbd, script, style').forEach(no => no.remove());
    return normal(copia.textContent);
  }
  function botaoSoResultado() {
    const alvo = v => /^so(?: o)? resultado$/.test(normal(v));
    const acionaveis = 'button,a,label,[role="button"],[role="tab"],[role="radio"],[tabindex]';
    const candidatos = new Set();
    for (const el of todos(acionaveis + ',span,strong,div')) {
      const direto = alvo(el.getAttribute('aria-label')) || alvo(el.getAttribute('title')) || alvo(el.textContent);
      if (!direto && !(el.matches(acionaveis) && el.textContent.length < 300 && alvo(rotuloControle(el)))) continue;
      // Também aceita rótulos clicáveis sem role; o clique propaga ao componente.
      const componente = el.closest('[class*="mode"],[class*="option"],[class*="toggle"],[class*="tab"]');
      const controle = el.closest(acionaveis) || (componente && alvo(rotuloControle(componente)) ? componente : el);
      if (controle && visivel(controle)) candidatos.add(controle);
    }
    const xs = [...candidatos];
    return unico(xs.filter(el => !xs.some(outro => outro !== el && el.contains(outro))));
  }
  function telaExpedicao() {
    return todos('h1,h2,[role="heading"]').some(el => normal(el.textContent) === 'expedicao');
  }
  function telaCacada() {
    return !telaExpedicao() && (!!botaoSoResultado() || todos('h1,h2,[role="heading"]').some(el => normal(el.textContent) === 'cacada'));
  }
  function menuCacada() {
    const peloTitulo = todos('[title="Caçada (Alt + C)"]');
    if (peloTitulo.length) {
      const controles = [...new Set(peloTitulo.map(el => el.closest('a,button,[role="button"],[role="link"]') || el))];
      const laterais = controles.filter(el => el.closest('aside,nav,[role="navigation"]'));
      return unico(laterais.length ? laterais : controles);
    }
    const controles = todos('a,button,[role="button"],[role="link"]').filter(el =>
      nomeExato(el, 'cacada') || rotuloControle(el) === 'cacada');
    const laterais = controles.filter(el => el.closest('aside,nav,[role="navigation"]'));
    return unico(laterais.length ? laterais : controles);
  }
  async function navegarCacada(valido, reportar = status, prazo = 8000) {
    const inicio = agoraAtivo();
    let clicado = false;
    while (valido()) {
      if (telaCacada()) return true;
      if (agoraAtivo() - inicio > prazoInterface(prazo)) throw Error('Não consegui abrir a Caçada. Abra essa tela no jogo e tente de novo.');
      if (!avisosBloqueando(reportar) && !clicado) {
        const botao = menuCacada();
        if (botao && clicar(botao)) {
          clicado = true;
          reportar('Abrindo a Caçada…');
        }
      }
      await esperarInterface();
    }
    return false;
  }
  function estadoExpedicao() {
    const retomar = unico(botoes().filter(el => rotuloControle(el) === 'retomar expedicao'));
    const pausada = !!retomar || todos('.journey-ledger.paused').length > 0;
    const cabecalhoAtivo = todos('.hero-header-status').some(el => /em expedicao/.test(texto(el)) && !/concluida|pausada/.test(texto(el)));
    const ativa = !pausada && (cabecalhoAtivo || todos('.journey-ledger.active').length > 0 ||
      botoes().some(el => rotuloControle(el) === 'expedicao em andamento'));
    return { ativa, pausada, retomar };
  }
  function menuExpedicao() {
    const controles = todos('a,button,[role="button"],[role="link"]').filter(el =>
      /^expedicao(?: \(alt[^)]*\))?$/.test(normal(el.getAttribute('title'))) || nomeExato(el, 'expedicao') || rotuloControle(el) === 'expedicao');
    const laterais = controles.filter(el => el.closest('aside,nav,[role="navigation"]'));
    return unico(laterais.length ? laterais : controles);
  }
  async function navegarExpedicao(token) {
    const inicio = agoraAtivo();
    let clicou = false;
    while (preparacao === token && !removido) {
      if (telaExpedicao()) return true;
      if (agoraAtivo() - inicio > prazoInterface(8000)) throw Error('Não consegui abrir a Expedição. Abra essa tela no jogo e tente de novo.');
      if (!avisosBloqueando() && !clicou && clicar(menuExpedicao())) {
        clicou = true; status('Abrindo a Expedição…');
      }
      await esperarInterface();
    }
    return false;
  }
  function opcaoDuracao(minutos) {
    const nomes = { 15: /^15 min(?:utos)?$/, 60: /^1 h(?:ora)?$/, 240: /^4 h(?:oras)?$/ };
    return unico(todos('.duration-options button, [role="group"][aria-label="Duração da expedição"] button')
      .filter(el => nomes[minutos]?.test(normal(el.getAttribute('aria-label') || el.querySelector('.duration-value,strong')?.textContent || el.textContent))));
  }
  function statusExpedicao(msg) {
    ui('statusExpedicao').textContent = msg;
  }
  async function prepararExpedicao(token) {
    if (!config.manterExpedicao) return true;
    let erro = '';
    try {
      if (estadoExpedicao().ativa) {
        expedicaoPendente = null;
        statusExpedicao('Sua expedição está em andamento. A caçada continua.');
        return true;
      }
      if (expedicaoPendente) {
        statusExpedicao('Esperando a expedição começar. Se demorar, confira a tela Expedição no jogo.');
        return true;
      }
      if (!(await navegarExpedicao(token))) return false;
      const inicio = agoraAtivo();
      let selecionouDuracao = false;
      while (preparacao === token && !removido) {
        if (avisosBloqueando()) { await esperarInterface(); continue; }
        const estado = estadoExpedicao();
        if (estado.ativa) {
          expedicaoPendente = null;
          statusExpedicao('Expedição iniciada. Voltando à Caçada.');
          break;
        }
        if (agoraAtivo() - inicio > 15000) throw Error(expedicaoPendente ? 'A expedição ainda não foi confirmada. Vou continuar caçando sem tentar iniciá-la de novo.' : 'Não consegui iniciar a expedição. Confira o tempo, o território e a estratégia no jogo.');
        if (!expedicaoPendente) {
          if (estado.pausada) {
            if (clicar(estado.retomar)) {
              expedicaoPendente = { acao: 'retomar' };
              statusExpedicao('Esperando o jogo retomar sua expedição…');
            }
          } else {
            const duracao = opcaoDuracao(config.duracaoExpedicao);
            if (!duracao) throw Error('Não consegui escolher esse tempo. Confira a duração na tela Expedição do jogo.');
            if (!selecionada(duracao)) {
              if (!selecionouDuracao && clicar(duracao)) selecionouDuracao = true;
            } else {
              const duracaoEsperada = { 15: '15 min', 60: '1 h', 240: '4 h' }[config.duracaoExpedicao];
              const iniciarExpedicao = unico(botoes().filter(el => rotuloControle(el) === `explorar por ${duracaoEsperada}`));
              if (clicar(iniciarExpedicao)) {
                expedicaoPendente = { acao: 'iniciar', minutos: config.duracaoExpedicao };
                statusExpedicao('Esperando a expedição começar…');
              }
            }
          }
        }
        await esperarInterface();
      }
    } catch (e) { erro = e.message; statusExpedicao(erro); }
    if (preparacao !== token || removido) return false;
    if (!(await navegarCacada(() => preparacao === token && !removido))) return false;
    if (!(await prepararModalidade(token))) return false;
    if (erro) status(erro);
    return true;
  }
  async function manutencaoExpedicao() {
    const token = {};
    preparacao = token;
    try {
      await prepararExpedicao(token);
    } catch (e) {
      if (preparacao === token) pausar(`Não consegui voltar à Caçada: ${e.message}`, true);
    } finally {
      if (preparacao === token) preparacao = null;
    }
  }
  function modoResultadoConfirmado(botao) {
    if (!botao) return false;
    const marcas = ['aria-selected', 'aria-pressed', 'aria-checked', 'data-selected'];
    const radio = botao.matches('label') ? (botao.control || botao.querySelector('input[type="radio"]')) : botao.querySelector('input[type="radio"]');
    if (radio?.checked) return true;
    if (marcas.some(a => botao.getAttribute(a) === 'true') || botao.getAttribute('data-state') === 'active' ||
        /(^|[\s_-])(selected|active|checked)($|[\s_-])/.test(botao.className || '')) return true;
    if (marcas.some(a => botao.getAttribute(a) === 'false')) return false;
    // Algumas versões indicam a modalidade apenas pelo texto do botão de caçar.
    return todos('button, [role="button"]', document.querySelector('main') || document)
      .some(el => normal(el.textContent) === 'cacar e ver resultado');
  }
  async function prepararModalidade(token) {
    const inicio = agoraAtivo();
    let clicado = false;
    while (preparacao === token && !removido) {
      if (agoraAtivo() - inicio > prazoInterface(8000)) throw Error('Não consegui marcar Só Resultado. Marque essa opção no jogo e tente de novo.');
      if (!avisosBloqueando()) {
        const botao = botaoSoResultado();
        if (botao && modoResultadoConfirmado(botao)) return true;
        if (botao && !clicado && clicar(botao)) {
          clicado = true;
          status('Marcando Só Resultado para pular a animação da luta…');
        }
      }
      await esperarInterface();
    }
    return false;
  }
  function botaoPocao(tipo) {
    if (seletores[tipo]) return unico(todos(seletores[tipo]));
    const daCacada = todos('button.hunt-potion-use, [role="button"].hunt-potion-use');
    const lista = (daCacada.length ? daCacada : todos('button, [role="button"]'))
      .filter(el => !/comprar|fabricar|receita|ouro|cristais/.test(texto(el)));
    function classificar(el) {
      const t = texto(el);
      // Os tipos internos são preservados para configurações e ações pendentes antigas.
      const menor = /\bpocao de vigor\b(?! maior)|\balivio\b/.test(t);
      const maior = /\bpocao de vigor maior\b|\brestauradora\b/.test(t);
      if (menor && maior) return 'ambigua';
      return menor ? 'alivio' : maior ? 'restauradora' : null;
    }
    const especificos = lista.filter(el => classificar(el) === tipo);
    if (especificos.length) return unico(especificos);
    // Algumas telas apresentam as poções apenas pelo efeito (+40% / +100%).
    const efeito = tipo === 'alivio' ? /\+\s*40\s*%/ : /\+\s*100\s*%/;
    const outroEfeito = tipo === 'alivio' ? /\+\s*100\s*%/ : /\+\s*40\s*%/;
    return unico(lista.filter(el => classificar(el) === null && efeito.test(texto(el)) && !outroEfeito.test(texto(el))));
  }
  // Estoque zero precisa ser explícito: botão desativado também pode significar vigor cheio.
  function estoqueMaior() {
    const botao = botaoPocao('restauradora');
    const quantidade = botao && unico(todos('.hunt-potion-quantity', botao));
    return quantidade ? inteiroOficina(quantidade.textContent.replace(/^\s*[×x]\s*/, '')) : null;
  }
  function inteiroOficina(valor) {
    const s = String(valor ?? '').trim();
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(s)) return null;
    const n = Number(s.replace(/\./g, ''));
    return Number.isSafeInteger(n) && n >= 0 ? n : null;
  }
  function estoqueParteOficina(el) {
    const estoque = normal(el.querySelector('small')?.textContent).match(/^([\d.]+) na mochila$/);
    return estoque ? inteiroOficina(estoque[1]) : null;
  }
  function receitaMaior() {
    const quantidade = unico(todos('.forge-stage-center .forge-jewel-quantity select'));
    const bancada = unico(todos('.forge-potion-workbench'));
    const resultado = bancada?.querySelector('.forge-potion-result strong');
    const custos = bancada ? todos('.forge-cost > div', bancada) : [];
    const ouro = unico(custos.filter(el=>normal(el.querySelector('dt')?.textContent) === 'ouro'));
    const custo = inteiroOficina(ouro?.querySelector('dd strong')?.textContent);
    const bolsa = normal(ouro?.querySelector('dd small')?.textContent).match(/^de ([\d.]+)$/);
    const disponivel = bolsa ? inteiroOficina(bolsa[1]) : null;
    // Não aceita outro custo, nem mesmo outro recurso adicional.
    if (!quantidade || quantidade.value !== '1' || normal(resultado?.textContent) !== '1 pocao de vigor maior' || custo !== config.craft.ouro || disponivel === null || custos.some(el=>el !== ouro && inteiroOficina(el.querySelector('dd strong')?.textContent) !== 0)) return null;
    const slots = todos('.forge-material-socket');
    const partes = slots.filter(el=>normal(el.querySelector('strong')?.textContent) !== 'ouro');
    if (slots.length !== 2 || partes.length !== 1) return null;
    const lerSlot = el => {
      const m = el.querySelector('.forge-gem-frame b')?.textContent.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
      return m ? {inserido:Number(m[1]), necessario:Number(m[2])} : null;
    };
    const parte = partes[0], slot = lerSlot(parte), slotOuro = lerSlot(slots.find(el=>el !== parte));
    if (!slot || slot.necessario !== config.craft.quantidade || !slotOuro || slotOuro.necessario !== config.craft.ouro) return null;
    return {bancada, disponivel, slot, slotOuro,
      ingrediente:normal(parte.querySelector('strong')?.textContent),
      estoque:estoqueParteOficina(parte)};
  }
  async function fabricarPocaoMaior() {
    if (preparacao || pendente) return;
    const materiais = config.craft;
    const token = {}; preparacao = token; faltaRecursosMaior = null;
    const valido = () => preparacao === token && !removido;
    const esperar = async (ler, mensagem, prazo = 8000) => {
      const inicio = agoraAtivo();
      while (valido()) {
        if (!avisosBloqueando()) { const valor = ler(); if (valor) return valor; }
        if (agoraAtivo() - inicio > prazoInterface(prazo)) throw Error(mensagem);
        await esperarInterface();
      }
      return null;
    };
    const acionar = async (ler, mensagem) => esperar(()=>clicar(ler()), mensagem);
    const voltar = async () => {
      if (!await navegarCacada(valido)) return false;
      if (!await prepararModalidade(token)) return false;
      return valido();
    };
    try {
      if (!fecharDetalhesFadiga()) throw Error('Feche os detalhes do Vigor antes de fabricar a poção.');
      status('A poção maior acabou. Conferindo os ingredientes na oficina…');
      await acionar(()=>unico(todos('nav a,nav button,aside a,aside button,[role="navigation"] a,[role="navigation"] button').filter(el=>nomeExato(el, 'oficina'))), 'Não consegui abrir a Oficina.');
      if (!valido()) return;
      await acionar(()=>unico(todos('.workshop-stations button[data-station="cauldron"]')), 'Não encontrei o Caldeirão.');
      if (!valido()) return;
      await acionar(()=>unico(botoes().filter(el=>rotuloControle(el) === 'pocoes')), 'Não encontrei as Poções no Caldeirão.');
      if (!valido()) return;
      const receita = () => unico(todos('.workshop-recipe-grid button').filter(el=>/^pocao de vigor maior, [\d.]+ na mochila$/.test(normal(el.getAttribute('aria-label')))));
      // O estoque também pode ter mudado durante o caminho.
      const escolha = await esperar(receita, 'Não encontrei a receita da poção maior.');
      if (!valido()) return;
      const estoque = inteiroOficina(normal(escolha.getAttribute('aria-label')).match(/, ([\d.]+) na mochila$/)?.[1]);
      if (estoque === null) throw Error('Não consegui conferir quantas poções maiores você tem.');
      if (estoque > 0) { await voltar(); return; }
      if (!clicar(escolha)) throw Error('Não consegui selecionar a poção maior.');
      const seletor = await esperar(()=>unico(todos('.forge-stage-center .forge-jewel-quantity select')), 'Não consegui conferir a quantidade de poções.');
      if (!valido()) return;
      if (seletor.value !== '1') {
        if (!habilitado(seletor) || ![...seletor.options].some(o=>o.value === '1')) throw Error('Não consegui escolher uma única poção.');
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(seletor, '1');
        seletor.dispatchEvent(new Event('change', {bubbles:true}));
      }
      const r = await esperar(receitaMaior, 'A receita mudou. Confira o ingrediente, a quantidade e o ouro configurados para o craft.');
      if (!valido()) return;
      let ingrediente = r.ingrediente;
      let semRecursos = r.disponivel < materiais.ouro;
      if (!semRecursos && (!materiais.ingredientes.includes(ingrediente) || !(r.slot.inserido === materiais.quantidade || r.estoque >= materiais.quantidade))) {
        await acionar(()=>unico(todos('.forge-potion-swap-button')), 'Não consegui abrir a escolha de ingredientes.');
        const cartao = nome => unico(todos('.forge-potion-ingredient-card').filter(el=>normal(el.querySelector('strong')?.textContent) === nome));
        const escolhaParte = await esperar(()=>{
          const opcoes = materiais.ingredientes.map(nome=>{
            const parte = cartao(nome);
            return {nome, estoque:parte ? estoqueParteOficina(parte) : null};
          });
          const disponivel = opcoes.find(opcao=>opcao.estoque >= materiais.quantidade);
          return disponivel || (opcoes.every(opcao=>opcao.estoque !== null) && {nome:null});
        }, 'Não consegui conferir os ingredientes configurados na mochila.');
        if (!valido()) return;
        ingrediente = escolhaParte.nome;
        semRecursos = !ingrediente;
        if (!semRecursos) {
          const campos = () => todos('.forge-potion-ingredient-stepper input');
          const desejado = campo => normal(campo.getAttribute('aria-label')) === ingrediente;
          const selecaoCorreta = () => {
            const lista = campos();
            return unico(lista.filter(desejado))?.value === String(materiais.quantidade) && lista.every(campo=>desejado(campo) || campo.value === '0');
          };
          const ajustar = (campo, valor) => {
            if (!habilitado(campo) || campo.value === valor) return;
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(campo, valor);
            campo.dispatchEvent(new Event('input', {bubbles:true}));
            campo.dispatchEvent(new Event('change', {bubbles:true}));
          };
          await esperar(()=>{
            const lista = campos();
            const alvo = unico(lista.filter(desejado));
            if (!alvo) return false;
            const outro = lista.find(campo=>!desejado(campo) && campo.value !== '0');
            if (outro) ajustar(outro, '0');
            else ajustar(alvo, String(materiais.quantidade));
            return selecaoCorreta();
          }, 'Não consegui selecionar a quantidade configurada do ingrediente.');
          const encaixar = () => todos('.forge-potion-ingredient-apply');
          await acionar(()=>selecaoCorreta() && unico(encaixar()), 'Não consegui encaixar a parte da poção maior.');
          await esperar(()=>!encaixar().length && receitaMaior()?.ingrediente === ingrediente, 'Não consegui confirmar a parte escolhida.');
        } else await acionar(()=>unico(todos('.forge-potion-ingredient-cancel')), 'Feche a escolha de ingredientes para continuar.');
      }
      if (!valido()) return;
      if (semRecursos) {
        if (!await voltar()) return;
        faltaRecursosMaior = {conferidoEm:agoraAtivo()};
        status('Falta ingrediente configurado ou ouro para fabricar. Vou caçar sem limite de fadiga e conferir os recursos de novo em 1 minuto.');
        return;
      }
      const receitaPronta = atual => atual?.ingrediente === ingrediente && atual.disponivel >= materiais.ouro && atual.slot.inserido === materiais.quantidade && atual.slotOuro.inserido === materiais.ouro;
      if (!receitaPronta(receitaMaior())) {
        await acionar(()=>{
          const atual = receitaMaior();
          if (atual?.ingrediente !== ingrediente || atual.disponivel < materiais.ouro || !(atual.slot.inserido === materiais.quantidade || atual.estoque >= materiais.quantidade)) return null;
          return unico(todos('button.forge-fill-recipe'));
        }, 'Não consegui preencher a receita da poção maior.');
      }
      await esperar(()=>receitaPronta(receitaMaior()), 'Não consegui confirmar os ingredientes nos encaixes.');
      if (!valido()) return;
      await esperar(()=>{
        const final = receitaMaior(), botao = final && unico(todos('button.forge-potion-craft-button', final.bancada));
        if (!receitaPronta(final) || !botao || rotuloControle(botao) !== 'preparar pocao de vigor maior') throw Error('A receita mudou antes da confirmação. Confira a Oficina.');
        if (!habilitado(botao)) return false;
        pendente = {tipo:'fabricacao', inicio:agoraAtivo(), estoqueAntes:0};
        if (!clicar(botao)) { pendente = null; throw Error('Não consegui confirmar a fabricação.'); }
        return true;
      }, 'A Oficina ainda não liberou a fabricação.');
      if (!valido()) return;
      status('Fabricando uma poção maior. Esperando o jogo confirmar…');
      await esperar(()=> {
        const sucesso = unico(todos('.workshop-craft-result').filter(el=>todos('h1,h2,h3',el).some(h=>normal(h.textContent) === 'pocao de vigor maior fabricada')));
        const total = normal(receita()?.getAttribute('aria-label')).match(/, ([\d.]+) na mochila$/);
        if (sucesso || (total && inteiroOficina(total[1]) > 0)) {
          pendente = null;
          if (sucesso && !clicar(unico(todos('.workshop-craft-result-continue', sucesso)))) return false;
          return true;
        }
        return false;
      }, 'O jogo não confirmou a fabricação. Confira a Oficina antes de continuar; não vou fabricar outra poção.', 45000);
      if (!valido()) return;
      if (!await voltar()) return;
      status('Poção maior fabricada. Voltei à Caçada e vou conferir a fadiga.');
    } catch (e) {
      if (valido()) pausar(e.message, true);
    } finally { if (preparacao === token) preparacao = null; }
  }

  function resultado() {
    if (seletores.resultado) return unico(todos(seletores.resultado));
    const dialogs = todos('dialog[open], [role="dialog"]').filter(el => /cacada concluida/.test(texto(el)));
    const candidatos = [...dialogs];
    // O resultado pode ser um painel sem role="dialog". Procura seu menor
    // contêiner a partir de Continuar, exigindo os textos da caçada concluída.
    for (const btn of todos('button').filter(b => normal(b.textContent) === 'continuar')) {
      let el = btn.parentElement;
      for (let nivel = 0; el && nivel < 8 && el !== document.body && el !== document.documentElement; nivel++, el = el.parentElement) {
        const t = texto(el);
        if (/\b(vitoria|derrota)\b/.test(t) && /cacada concluida/.test(t)) {
          candidatos.push(el); break;
        }
      }
    }
    const distintos = [...new Set(candidatos)];
    return unico(distintos.filter(el => !distintos.some(outro => outro !== el && el.contains(outro))));
  }
  function fecharResultado(el) {
    const btns = todos('button', el);
    // A tela tem Continuar e um X: preferir Continuar evita ambiguidade.
    const continuar = btns.filter(b => normal(b.textContent) === 'continuar');
    if (continuar.length) return unico(continuar);
    return unico(btns.filter(b => /^(fechar|voltar|voltar a cacada|concluir)$/.test(normal(b.textContent)) || /^(fechar|fechar resultado)$/.test(normal(b.getAttribute('aria-label')))));
  }
  function clicar(el) {
    if (!habilitado(el)) return false;
    el.click(); return true;
  }
  function resumo(el) {
    return el ? { tag: el.tagName, texto: texto(el).slice(0, 140), habilitado: habilitado(el), selecionada: selecionada(el) } : null;
  }

  // A navegação inicial termina antes de criar/exibir a interface do bot.
  let erroNavegacaoInicial = '';
  let descansoAoCarregar = false;
  try {
    const salvo = JSON.parse(sessionStorage.getItem('aurenRetomadaAtualizacaoV1') || 'null');
    const idade = salvo ? Date.now() - salvo.criadoEm : -1;
    const maximo = salvo?.config?.duracaoPausaMax;
    descansoAoCarregar = salvo?.versao === 1 && idade >= 0 && idade <= 120000 && salvo.config?.pausasAleatorias === true && !salvo.pendente &&
      Number.isInteger(maximo) && maximo >= 1 && maximo <= 1440 && Number.isFinite(salvo.pausas?.retomarEm) &&
      salvo.pausas.retomarEm > Date.now() && salvo.pausas.retomarEm <= Date.now() + maximo * 60000;
  } catch { /* Sem uma retomada válida, mantém a abertura normal da Caçada. */ }
  try {
    if (!descansoAoCarregar) await navegarCacada(() => true, msg => console.info('[Auren início]', msg), 15000);
  } catch (error) { erroNavegacaoInicial = error.message; }
  try {
    const salvo = await chrome.storage.local.get('aurenPreferenciasV33');
    if (salvo.aurenPreferenciasV33 && typeof salvo.aurenPreferenciasV33 === 'object') preferencias = salvo.aurenPreferenciasV33;
  } catch { erroArmazenamento = true; }

  const host = document.createElement('div');
  host.id = 'auren-cacada-v3';
  host.style.cssText = 'position:fixed;right:16px;top:70px;width:min(390px,calc(100vw - 32px));z-index:2147483647';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    :host{all:initial;color-scheme:dark}*{box-sizing:border-box}section{background:#141d24;color:#f2eee4;border:1px solid #b99b60;border-radius:10px;padding:15px;font:13px/1.45 system-ui;box-shadow:0 8px 32px #0008;max-height:calc(100vh - 90px);overflow:auto}h2{font-size:17px;margin:0 0 8px}p{color:#d6c399}label{display:block;margin:8px 0}input,select{display:block;width:100%;background:#25323d;border:1px solid #65727b;border-radius:4px;color:white;font:inherit;padding:6px}input[type=checkbox]{display:inline;width:auto}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}nav{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}button{font:inherit;border:0;border-radius:4px;padding:8px;cursor:pointer;background:#c0a269;color:#101820}output{display:block;background:#25323d;padding:9px;white-space:pre-wrap}pre{font:11px/1.5 monospace;white-space:pre-wrap;max-height:160px;overflow:auto}small{color:#bcc9d2}
    #moverPainel{cursor:grab;touch-action:none;user-select:none;margin-bottom:12px}#moverPainel[data-arrastando]{cursor:grabbing}#moverPainel small{display:block}
    [role=tab][aria-selected=false]{background:#25323d;color:#d6c399;border:1px solid #65727b}[role=tab]:focus-visible{outline:2px solid #f2eee4;outline-offset:2px}#statusExpedicao{margin-top:12px}
    </style><section><header id="moverPainel" title="Arraste para mover o painel"><h2>Auren • Assistente de caçada v3.3.39</h2><small>Arraste este título para mover o painel.</small></header>
    <p>Escolha como caçar e recuperar o vigor. Se quiser, faça expedições ao mesmo tempo. Depois, clique em Iniciar.</p>
    <nav role="tablist" aria-label="Opções de caçada, expedição, extras e pausas"><button id="tabCacada" role="tab" aria-selected="true" aria-controls="abaCacada">Caçada</button><button id="tabExpedicao" role="tab" aria-selected="false" aria-controls="abaExpedicao" tabindex="-1">Expedição</button><button id="tabBoss" role="tab" aria-selected="false" aria-controls="abaBoss" tabindex="-1">Extras</button><button id="tabPausas" role="tab" aria-selected="false" aria-controls="abaPausas" tabindex="-1">Pausas</button></nav>
    <div id="abaCacada" role="tabpanel" aria-labelledby="tabCacada">
    <label>Criatura que você quer caçar<input id="criatura" placeholder="Ex.: Corvo do eclipse" maxlength="100"></label>
    <small>Digite o nome igual ao do jogo e deixe a região da criatura aberta.</small>
    <label>Como recuperar o vigor?<select id="modo"><option value="pocao">Usar poções quando precisar</option><option value="natural">Esperar o vigor voltar sozinho</option></select></label>
    <label>Vigor mínimo para caçar (%)<input id="atacar" type="text" inputmode="decimal" value="80"></label>
    <label>Usar a poção comum até (%)<input id="limiteAlivio" type="text" inputmode="decimal" value="70"></label>
    <small>Para recuperar vigor, usa apenas a poção comum até o valor escolhido. Depois, espera o vigor voltar. A poção maior só é usada para baixar a fadiga quando o controle abaixo estiver ligado.</small>
    <label><input id="economizar" type="checkbox" checked> Esperar um pouco e poupar poções</label>
    <label>Esperar quando faltar até (%)<input id="margem" type="text" inputmode="decimal" value="5"></label>
    <small>Exemplo: se você caça com 80% e escolhe 5, o bot espera o vigor subir de 75% para 80% sem gastar poção. Essa espera vale para recuperar vigor. Se o controle de fadiga estiver ligado, o limite de fadiga vem primeiro.</small>
    <label><input id="controlarFadiga" type="checkbox"> Manter a fadiga abaixo do limite</label>
    <label>Limite de fadiga, em pontos<input id="limiteFadiga" type="text" inputmode="numeric" value="100" disabled></label>
    <label><input id="aproveitarMaior" type="checkbox" disabled> Gastar mais vigor antes de usar a poção maior</label>
    <label>Fadiga extra permitida, em pontos<input id="folgaFadiga" type="text" inputmode="numeric" value="5" disabled></label>
    <label>Usar a maior quando o vigor chegar a (%)<input id="vigorMaior" type="text" inputmode="decimal" value="30" disabled></label>
    <small>Com esta opção ligada, ao atingir o limite de fadiga continua caçando para aproveitar a recuperação da maior, mesmo abaixo do vigor mínimo habitual. Usa a maior quando o vigor chega ao valor escolhido, fica abaixo de 30% ou a próxima vitória ultrapassaria a margem de fadiga. Exemplo: limite 100 e margem 5 permitem chegar a 105 pontos.</small>
    <small>Use um número inteiro de 2 ou mais. Cada vitória soma 1 ponto. Sem a opção de gastar mais vigor, usa a maior antes que a próxima vitória chegue ao limite. Exemplo: limite 100 significa ficar em até 99 pontos.</small>
    <p>Só a poção comum é escolhida para recuperar vigor. Com este controle ligado, a maior é usada para baixar a fadiga, mesmo se você escolheu esperar o vigor voltar sozinho. Ela também enche o vigor.</p>
    <small>O bot abre os detalhes do Vigor para conferir a fadiga. Com vigor cheio e a poção maior indisponível, faz uma caçada para gastar vigor, mesmo se a fadiga já estiver no limite. Após o resultado, volta a conferir a fadiga. Se a maior acabar, só tenta fabricá-la quando a opção abaixo estiver marcada.</small>
    <label><input id="fabricarMaior" type="checkbox" disabled> Fabricar poções de vigor maior se necessário</label>
    <small>Fabrica uma poção por vez com a receita configurada abaixo e retorna à Caçada. Se faltar ingrediente ou ouro, continua caçando sem limite de fadiga e confere os recursos novamente a cada minuto.</small>
    <details><summary>Configurar craft da poção maior</summary>
      <label>Ingrediente(s) aceito(s)<input id="craftIngredientes" value="Olho de corvo; Coração de serpente" maxlength="500" disabled></label>
      <small>Use o nome exato do jogo. Para permitir ingredientes alternativos, separe os nomes por ponto e vírgula. Usa apenas um desses tipos por poção.</small>
      <label>Quantidade do ingrediente por poção<input id="craftQuantidade" type="text" inputmode="numeric" value="1" disabled></label>
      <label>Ouro por poção<input id="craftOuro" type="text" inputmode="numeric" value="1900" disabled></label>
      <small>Atualize estes valores quando o jogo mudar a receita. Confere as quantidades e o custo na Oficina antes de gastar.</small>
    </details>
    </div>
    <div id="abaExpedicao" role="tabpanel" aria-labelledby="tabExpedicao" hidden>
      <label><input id="manterExpedicao" type="checkbox"> Iniciar outra expedição quando a atual terminar</label>
      <label>Tempo de cada nova expedição<select id="duracaoExpedicao" disabled><option value="15">15 minutos</option><option value="60" selected>1 hora</option><option value="240">4 horas</option></select></label>
      <small>Antes de ativar, escolha o território, o grau e a estratégia na tela Expedição do jogo. O bot inicia a viagem e volta à Caçada. Se já houver uma viagem em andamento, espera ela terminar. O tempo escolhido vale para a próxima.</small>
      <output id="statusExpedicao" aria-live="polite">Ative se quiser manter uma expedição enquanto caça.</output>
    </div>
    <div id="abaBoss" role="tabpanel" aria-labelledby="tabBoss" hidden>
      <label>Qual Boss atacar?<select id="bossDestino"><option value="auto">Boss da tela atual</option><option value="guilda">Boss da guilda</option><option value="mundo">Boss do mundo</option></select></label>
      <p>Escolhe o maior dano disponível contra o Boss da guilda ou do mundo.</p>
      <small>O Boss funciona sozinho ou junto com a caçada. Iniciar Boss e Pausar Boss controlam apenas este extra.</small>
      <small>Respeita o limite de 8 ataques por pessoa em cada encontro e o intervalo de 15 minutos. Escolhe o maior dano entre os ataques disponíveis no jogo. Entre as investidas, a caçada continua. O extra confere o Boss entre as ações da caçada e retorna depois.</small>
      <nav><button id="iniciarBoss">Iniciar Boss</button><button id="pausarBoss">Pausar Boss</button></nav>
      <output id="statusBoss" aria-live="polite">Clique em Iniciar Boss para abrir o combate e acompanhar as investidas.</output>
    </div>
    <div id="abaPausas" role="tabpanel" aria-labelledby="tabPausas" hidden>
      <label><input id="pausasAleatorias" type="checkbox"> Fazer pausas automáticas</label>
      <p>Escolha duas faixas. O bot sorteia quando vai pausar e quanto tempo vai descansar.</p>
      <div class="grid"><label>Pausar depois de, no mínimo (min)<input id="intervaloPausaMin" type="text" inputmode="numeric" value="20" disabled></label><label>E, no máximo (min)<input id="intervaloPausaMax" type="text" inputmode="numeric" value="40" disabled></label></div>
      <div class="grid"><label>Descansar por, no mínimo (min)<input id="duracaoPausaMin" type="text" inputmode="numeric" value="2" disabled></label><label>E, no máximo (min)<input id="duracaoPausaMax" type="text" inputmode="numeric" value="5" disabled></label></div>
      <small>Exemplo: pausar a cada 20 a 40 minutos e descansar por 2 a 5 minutos. Use minutos inteiros de 1 a 1440. Para um tempo fixo, coloque o mesmo número nos dois campos.</small>
      <p>O bot termina a ação em andamento antes de pausar. Durante o descanso, não luta, não usa poções e não inicia expedições. Os avisos ativados continuam funcionando, e uma expedição já iniciada continua no jogo.</p>
      <small>Ao terminar a pausa, volta à Caçada e confere o jogo antes de continuar. Pausar, ocultar o painel ou mudar uma opção cancela as pausas marcadas. Clique em Iniciar para sortear de novo. O Chrome pode atrasar os horários se a aba ficar lenta ou suspensa.</small>
      <output id="statusPausas" aria-live="polite">Pausas desligadas.</output>
    </div>
    <label><input id="continuarOculta" type="checkbox" aria-describedby="ajudaContinuarOculta"> Continuar mesmo sem olhar a aba do jogo</label>
    <small id="ajudaContinuarOculta">Permite caçar e atacar bosses com o Chrome minimizado ou outra aba aberta. Mantenha o jogo, o Chrome e o computador ligados. Em segundo plano, as ações podem demorar mais.</small>
    <label><input id="reiniciarAutomaticamente" type="checkbox" aria-describedby="ajudaReinicio">Tentar continuar sozinho após um erro</label>
    <small id="ajudaReinicio">Se um erro parar a caçada, tenta continuar a cada 10 segundos. Primeiro, confere o vigor e espera a resposta do jogo. Pausar, ocultar o painel ou mudar uma opção cancela essas tentativas.</small>
    <nav><button id="configurarAvisos">Configurar avisos</button></nav><small id="statusAvisos" aria-live="polite">Avisos desligados.</small>
    <nav><button id="diagnostico">Pausar e conferir</button><button id="iniciar">Iniciar</button><button id="pausar">Pausar</button><button id="fechar">Ocultar painel</button></nav>
    <small>Ocultar interrompe a caçada e os extras. Para abrir o painel de novo, clique no ícone da extensão. O bot continua fechando os avisos do jogo que reconhece.</small>
    <output id="status" aria-live="polite">Escolha suas opções e clique em Iniciar para começar.</output><pre id="log"></pre></section>`;
  document.documentElement.appendChild(host);
  const ui = id => root.getElementById(id);
  window.aurenAvisos?.ouvirAvisosWindows?.(texto=>{ui('statusAvisos').textContent=texto;});
  ui('configurarAvisos').onclick = async () => {
    try {
      const result = await chrome.runtime.sendMessage({origem:'auren-avisos-windows', comando:'configurar'});
      if (!result?.ok) throw Error(result?.erro || 'Não consegui abrir os avisos. Tente de novo.');
    } catch(error) { ui('statusAvisos').textContent=error.message; }
  };
  function abrirAba(id) {
    for (const nome of ['Cacada', 'Expedicao', 'Boss', 'Pausas']) {
      const ativa = nome === id;
      ui('tab' + nome).setAttribute('aria-selected', String(ativa));
      ui('tab' + nome).tabIndex = ativa ? 0 : -1;
      ui('aba' + nome).hidden = !ativa;
    }
  }
  const abas = ['Cacada', 'Expedicao', 'Boss', 'Pausas'];
  for (const nome of abas) {
    ui('tab' + nome).onclick = () => abrirAba(nome);
    ui('tab' + nome).onkeydown = event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const destino = event.key === 'Home' ? abas[0] : event.key === 'End' ? abas[abas.length - 1] : abas[(abas.indexOf(nome) + (event.key === 'ArrowRight' ? 1 : abas.length - 1)) % abas.length];
      abrirAba(destino); ui('tab' + destino).focus();
    };
  }
  const cabecalho = ui('moverPainel');
  let arrasto = null;
  function posicionarPainel(x, y) {
    const margem = 8;
    const largura = host.getBoundingClientRect().width;
    const alturaTitulo = cabecalho.getBoundingClientRect().height + 30;
    const esquerda = Math.max(margem, Math.min(x, innerWidth - largura - margem));
    const topo = Math.max(margem, Math.min(y, innerHeight - alturaTitulo - margem));
    host.style.right = 'auto';
    host.style.left = esquerda + 'px';
    host.style.top = topo + 'px';
    root.querySelector('section').style.maxHeight = Math.max(alturaTitulo, innerHeight - topo - margem) + 'px';
  }
  cabecalho.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    const caixa = host.getBoundingClientRect();
    arrasto = { id: event.pointerId, x: event.clientX - caixa.left, y: event.clientY - caixa.top };
    cabecalho.setPointerCapture(event.pointerId);
    cabecalho.setAttribute('data-arrastando', '');
    event.preventDefault();
  });
  cabecalho.addEventListener('pointermove', event => {
    if (arrasto?.id === event.pointerId) posicionarPainel(event.clientX - arrasto.x, event.clientY - arrasto.y);
  });
  function terminarArrasto(event) {
    if (arrasto?.id !== event.pointerId) return;
    arrasto = null;
    cabecalho.removeAttribute('data-arrastando');
    if (cabecalho.hasPointerCapture(event.pointerId)) cabecalho.releasePointerCapture(event.pointerId);
  }
  cabecalho.addEventListener('pointerup', terminarArrasto);
  cabecalho.addEventListener('pointercancel', terminarArrasto);
  cabecalho.addEventListener('lostpointercapture', terminarArrasto);
  window.addEventListener('resize', () => {
    if (host.hidden || !host.style.left) return;
    const caixa = host.getBoundingClientRect();
    posicionarPainel(caixa.left, caixa.top);
  });
  let timer = null, pendente = null, removido = false, config = null, selecionando = null, preparacao = null;
  let timerReinicio = null, reinicioArmado = false;
  let faltaRecursosMaior = null;
  let planoPausas = null;
  let detalhesFadigaDoBot = null;
  let ataquePronto = null, motivoRecuperacao = '';
  let expedicaoPendente = null, proximaVerificacaoExpedicao = 0;
  let vezBoss = false, iniciarDepoisBoss = false;
  function reservarBoss() {
    if (pendente || preparacao || expedicaoPendente || planoPausas?.retomarEm) return false;
    vezBoss = true;
    return true;
  }
  async function retornarDoBoss() {
    const token = {};
    try {
      if (timer && vezBoss) {
        preparacao = token;
        if (!await navegarCacada(()=>vezBoss && preparacao === token && !!timer)) return;
        if (!await prepararModalidade(token)) return;
      }
    } catch (error) {
      pausar(`Não consegui voltar do Boss à Caçada: ${error.message}`, true);
    } finally {
      if (preparacao === token) preparacao = null;
      vezBoss = false;
      if (iniciarDepoisBoss) { iniciarDepoisBoss = false; void iniciar(); }
    }
  }
  const observarProntidao = new MutationObserver(registros => {
    if (!ataquePronto) return;
    const { botao, criatura, modo } = ataquePronto;
    if (!botao.isConnected || !criatura.isConnected || !modo.isConnected || window.aurenAvisos?.verificacaoHumana ||
        todos('dialog[open], [role="dialog"], [aria-modal="true"]').length ||
        registros.some(r => r.type === 'attributes' &&
          [botao, criatura, modo].some(el => r.target === el || r.target.contains(el)))) ataquePronto = null;
  });
  observarProntidao.observe(document.documentElement, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['disabled', 'aria-disabled', 'aria-busy', 'aria-pressed', 'aria-selected', 'data-selected', 'class', 'hidden', 'style']
  });
  const linhas = [];
  function status(msg) {
    ui('status').textContent = `${timer ? (planoPausas?.retomarEm ? 'Em pausa' : 'Ativo') : 'Pausado'} • ${msg}`;
    if (linhas[0] && linhas[0].endsWith(msg)) return;
    linhas.unshift(`${new Date().toLocaleTimeString()} ${msg}`);
    linhas.length = Math.min(linhas.length, 35);
    ui('log').textContent = linhas.join('\n');
  }
  function lerConfig() {
    const c = { criatura: ui('criatura').value.trim(), modo: ui('modo').value, atacar: percentual(ui('atacar').value, 'Vigor mínimo para caçar'), limiteAlivio: percentual(ui('limiteAlivio').value, 'Limite da poção comum'), economizar: ui('economizar').checked, margem: percentual(ui('margem').value, 'Quanto falta para caçar'), continuarOculta: ui('continuarOculta').checked, reiniciarAutomaticamente: ui('reiniciarAutomaticamente').checked, manterExpedicao: ui('manterExpedicao').checked, duracaoExpedicao: Number(ui('duracaoExpedicao').value) };
    if (![15, 60, 240].includes(c.duracaoExpedicao)) throw Error('Escolha 15 minutos, 1 hora ou 4 horas para a expedição.');
    if (!c.criatura) throw Error('Digite o nome da criatura igual ao do jogo.');
    if (c.atacar < 30) throw Error('O vigor mínimo para caçar deve ser de pelo menos 30%.');
    c.controlarFadiga = ui('controlarFadiga').checked;
    c.bossDestino = ui('bossDestino').value;
    c.fabricarMaior = c.controlarFadiga && ui('fabricarMaior').checked;
    c.craft = null;
    c.craftIngredientes = ui('craftIngredientes').value.trim();
    c.craftQuantidade = ui('craftQuantidade').value.trim();
    c.craftOuro = ui('craftOuro').value.trim();
    if (c.fabricarMaior) {
      const ingredientes = [...new Set(c.craftIngredientes.split(';').map(normal).filter(Boolean))];
      const quantidade = inteiroOficina(c.craftQuantidade), ouro = inteiroOficina(c.craftOuro);
      if (!ingredientes.length) throw Error('Craft: informe o nome de pelo menos um ingrediente.');
      if (quantidade === null || quantidade < 1) throw Error('Craft: a quantidade do ingrediente deve ser um inteiro de 1 ou mais.');
      if (ouro === null) throw Error('Craft: informe uma quantidade inteira de ouro de 0 ou mais.');
      c.craft = {ingredientes, quantidade, ouro};
    }
    c.aproveitarMaior = c.controlarFadiga && ui('aproveitarMaior').checked;
    c.folgaFadiga = 0;
    c.vigorMaior = null;
    c.limiteFadiga = null;
    if (c.controlarFadiga) {
      const valor = ui('limiteFadiga').value.trim();
      if (!/^\d+$/.test(valor) || !Number.isSafeInteger(Number(valor)) || Number(valor) < 2) throw Error('Limite de fadiga: digite um número inteiro de 2 ou mais. Cada vitória soma 1 ponto.');
      c.limiteFadiga = Number(valor);
    }
    if (c.aproveitarMaior) {
      const folga = ui('folgaFadiga').value.trim();
      if (!/^\d+$/.test(folga) || !Number.isSafeInteger(Number(folga)) ||
          !Number.isSafeInteger(c.limiteFadiga + Number(folga))) throw Error('Fadiga extra: digite um número inteiro de 0 ou mais, dentro do limite numérico.');
      c.folgaFadiga = Number(folga);
      c.vigorMaior = percentual(ui('vigorMaior').value, 'Vigor para usar a maior');
    }
    c.pausasAleatorias = ui('pausasAleatorias').checked;
    for (const [id, nome] of [['intervaloPausaMin','Tempo mínimo antes de pausar'], ['intervaloPausaMax','Tempo máximo antes de pausar'], ['duracaoPausaMin','Descanso mínimo'], ['duracaoPausaMax','Descanso máximo']]) {
      c[id] = null;
      if (!c.pausasAleatorias) continue;
      const valor = ui(id).value.trim();
      if (!/^\d+$/.test(valor) || Number(valor) < 1 || Number(valor) > 1440) throw Error(`${nome}: digite minutos inteiros de 1 a 1440.`);
      c[id] = Number(valor);
    }
    if (c.pausasAleatorias && c.intervaloPausaMin > c.intervaloPausaMax) throw Error('O tempo mínimo antes de pausar não pode ser maior que o máximo.');
    if (c.pausasAleatorias && c.duracaoPausaMin > c.duracaoPausaMax) throw Error('O descanso mínimo não pode ser maior que o máximo.');
    return c;
  }
  function sortearMinutos(minimo, maximo) {
    return minimo + Math.floor(Math.random() * (maximo - minimo + 1));
  }
  function atualizarStatusPausas() {
    let texto;
    if (!ui('pausasAleatorias').checked) texto = 'Pausas desligadas.';
    else if (!planoPausas) texto = 'Quando a caçada começar, vou sortear a próxima pausa.';
    else if (planoPausas.retomarEm) {
      const faltam = Math.ceil((planoPausas.retomarEm - Date.now()) / 60000);
      texto = faltam > 0 ? `Descansando. Volto em até ${faltam} min.` : 'O descanso terminou. Esperando o jogo liberar a volta.';
    } else {
      const faltam = Math.ceil((planoPausas.proximaEm - Date.now()) / 60000);
      texto = faltam > 0 ? `Próxima pausa em até ${faltam} min. Vou descansar por ${planoPausas.duracaoMinutos} min.` : 'A pausa está pronta. Vou terminar a ação do jogo antes de descansar.';
    }
    // O texto muda só quando o minuto ou a etapa muda.
    if (ui('statusPausas').textContent !== texto) ui('statusPausas').textContent = texto;
  }
  function restaurarPlanoPausas(salvo) {
    if (!config.pausasAleatorias || !salvo || typeof salvo !== 'object') return null;
    const {intervaloMinutos, duracaoMinutos, proximaEm, retomarEm} = salvo;
    if (!Number.isInteger(intervaloMinutos) || intervaloMinutos < config.intervaloPausaMin || intervaloMinutos > config.intervaloPausaMax ||
        !Number.isInteger(duracaoMinutos) || duracaoMinutos < config.duracaoPausaMin || duracaoMinutos > config.duracaoPausaMax ||
        !Number.isFinite(proximaEm) || proximaEm < 0 || proximaEm > Date.now() + config.intervaloPausaMax * 60000 ||
        (retomarEm !== null && (!Number.isFinite(retomarEm) || retomarEm <= Date.now() || retomarEm < proximaEm || retomarEm > Date.now() + duracaoMinutos * 60000))) return null;
    return {intervaloMinutos, duracaoMinutos, proximaEm, retomarEm};
  }
  function ativarCiclo(planoSalvo = null) {
    planoPausas = restaurarPlanoPausas(planoSalvo);
    if (config.pausasAleatorias && !planoPausas) {
      const intervaloMinutos = sortearMinutos(config.intervaloPausaMin, config.intervaloPausaMax);
      const duracaoMinutos = sortearMinutos(config.duracaoPausaMin, config.duracaoPausaMax);
      planoPausas = {intervaloMinutos, duracaoMinutos, proximaEm:Date.now() + intervaloMinutos * 60000, retomarEm:null};
    }
    proximaVerificacaoExpedicao = agoraAtivo() + 30000;
    reinicioArmado = config.reiniciarAutomaticamente;
    timer = setInterval(ciclo, 2200); ui('iniciar').disabled = true;
    window.aurenSegundoPlano?.registrar('cacada',ciclo);
    atualizarStatusPausas();
    status(planoPausas?.retomarEm ? 'Continuando seu descanso. Vou voltar à caçada sozinho.' : 'Caçada iniciada. Vou lutar e recuperar o vigor como você escolheu.');
  }
  function iniciarPausaSorteada() {
    if (!planoPausas || planoPausas.retomarEm || Date.now() < planoPausas.proximaEm) return false;
    planoPausas.retomarEm = Date.now() + planoPausas.duracaoMinutos * 60000;
    atualizarStatusPausas();
    status(`Pausa de ${planoPausas.duracaoMinutos} min. Vou continuar sozinho depois do descanso.`);
    return true;
  }
  function pausar(msg = 'Caçada pausada. Clique em Iniciar para continuar.', automatica = false) {
    window.aurenSegundoPlano?.remover('cacada');
    window.aurenSegundoPlano?.remover('reinicio');
    window.aurenSegundoPlano?.remover('preparacao');
    iniciarDepoisBoss = false;
    ataquePronto = null;
    faltaRecursosMaior = null;
    const retomar = automatica && reinicioArmado && config?.reiniciarAutomaticamente;
    clearTimeout(timerReinicio); timerReinicio = null;
    if (!retomar) reinicioArmado = false;
    try { sessionStorage.removeItem('aurenRetomadaAtualizacaoV1'); } catch {}
    preparacao = null;
    clearInterval(timer); timer = null; ui('iniciar').disabled = false;
    planoPausas = null; atualizarStatusPausas();
    if (detalhesFadigaDoBot?.isConnected && visivel(detalhesFadigaDoBot)) fecharDetalhesFadiga();
    if (retomar) agendarReinicio(msg);
    else status(msg);
    // Preserva ação pendente: pausar/retomar não autoriza repetir um clique sem confirmação.
  }
  function agendarReinicio(msg) {
    if (!reinicioArmado || removido || host.hidden || !config?.reiniciarAutomaticamente) return;
    clearTimeout(timerReinicio);
    status(`${msg} Vou tentar continuar em 10 segundos.`);
    timerReinicio = setTimeout(tentarReinicio, 10000);
    window.aurenSegundoPlano?.registrar('reinicio',tentarReinicio);
  }
  function confirmarAcaoPendente(hp, r) {
    if (!pendente) return true;
    // Um resultado permite retomar o acompanhamento do ataque, sem autorizar outro ataque.
    if (pendente.tipo === 'ataque') return !!r;
    if (pendente.tipo === 'fabricacao') {
      if (estoqueMaior() > pendente.estoqueAntes) { pendente = null; return true; }
      return false;
    }
    if (pendente.tipo === 'fechamento' && !r) { pendente = null; return true; }
    if (pendente.tipo === 'restauradora' && pendente.motivo === 'fadiga') {
      const leitura = consultarFadiga();
      if (leitura && Number.isSafeInteger(pendente.fadigaEsperada) && leitura.atual <= pendente.fadigaEsperada) {
        pendente = null; fecharDetalhesFadiga(); return true;
      }
      return false;
    }
    if (['alivio', 'restauradora'].includes(pendente.tipo) && hp !== null && hp > pendente.hp) {
      const esperado = pendente.tipo === 'alivio' ? Math.min(100, pendente.hp + 40) : 100;
      if (hp >= esperado - 0.01) { pendente = null; return true; }
    }
    return false;
  }
  function descreverPendencia(incluirTempo = true) {
    if (!pendente) return 'Nenhuma resposta do jogo em espera.';
    const tipos = { fabricacao: 'Fabricação da poção maior', ataque: 'Ataque', fechamento: 'Fechar resultado', alivio: 'Poção de vigor', restauradora: pendente.motivo === 'fadiga' ? 'Poção maior para baixar a fadiga' : 'Poção de vigor maior' };
    const segundos = Math.floor(Math.max(0, agoraAtivo() - pendente.inicio) / 1000);
    return `${tipos[pendente.tipo] || 'Ação'} esperando a resposta do jogo${incluirTempo ? ` há ${segundos} segundos de espera` : ''}.`;
  }
  function recuperarAtaqueSemResultado() {
    motivoRecuperacao = '';
    if (pendente?.tipo !== 'ataque' || agoraAtivo() - pendente.inicio <= prazoInterface(45000)) return false;
    const resultados = todos('button.hero-header-results, button[aria-label="Ver resultados pendentes"]');
    if (resultados.length) {
      motivoRecuperacao = 'O jogo tem um resultado para mostrar. Esperando ele abrir.';
      ataquePronto = null;
      if (resultados.length === 1 && !pendente.tentouAbrirResultados && habilitado(resultados[0])) {
        pendente.tentouAbrirResultados = true;
        clicar(resultados[0]);
        status('Abrindo o resultado da última luta…');
      }
      return false;
    }
    const criatura = localizarCriatura(config.criatura), botao = botaoAtacar(), modo = botaoSoResultado();
    const pronto = telaCacada() && modoResultadoConfirmado(modo) &&
      criatura && selecionada(criatura) && habilitado(botao) && !botao.closest('[aria-busy="true"]') &&
      !todos('dialog[open], [role="dialog"], [aria-modal="true"]').length;
    if (!pronto) { ataquePronto = null; motivoRecuperacao = 'O jogo ainda não permite caçar essa criatura de novo.'; return false; }
    motivoRecuperacao = 'O jogo liberou outra caçada. Vou esperar 10 segundos para conferir se está tudo pronto.';
    if (ataquePronto?.registro !== pendente) {
      ataquePronto = { registro: pendente, desde: agoraAtivo(), botao, criatura, modo };
      return false;
    }
    if (ataquePronto.botao !== botao || ataquePronto.criatura !== criatura || ataquePronto.modo !== modo) {
      ataquePronto = { registro: pendente, desde: agoraAtivo(), botao, criatura, modo };
      return false;
    }
    if (agoraAtivo() - ataquePronto.desde < 10000) return false;
    // A interface está estável e pronta; reavalia um novo ciclo sem presumir o resultado anterior.
    pendente = null; ataquePronto = null; selecionando = null;
    status('O jogo liberou outra caçada, mas não mostrou o último resultado. Vou conferir o vigor antes de continuar.');
    return true;
  }
  async function tentarReinicio() {
    timerReinicio = null;
    if (!reinicioArmado || timer || preparacao || removido || host.hidden) return;
    try {
      if (avisosBloqueando()) { ataquePronto = null; return agendarReinicio('Esperando você responder ou fechar o aviso no jogo.'); }
      if (document.hidden && !config.continuarOculta) { ataquePronto = null; return agendarReinicio('Abra a aba do jogo para continuar.'); }
      const hp = lerVigor(), r = resultado();
      if (hp === null) { ataquePronto = null; return agendarReinicio('Esperando o vigor aparecer no jogo.'); }
      if (!confirmarAcaoPendente(hp, r) && !recuperarAtaqueSemResultado()) {
        return agendarReinicio(`${descreverPendencia(false)} ${motivoRecuperacao || 'Esperando a resposta do jogo antes de tentar outra ação.'}`);
      }
      selecionando = null;
      await iniciar(true);
    } catch (e) { agendarReinicio(`Não consegui retomar: ${e.message}`); }
  }
  function diagnostico() {
    const c = lerConfig(), hp = lerVigor(), criatura = localizarCriatura(c.criatura), fadiga = lerFadiga();
    const d = { vigor: hp, fadiga: fadiga?.atual ?? null, previsaoFadiga: fadiga, fabricacao: {estoqueMaior:estoqueMaior(), semRecursos:!!faltaRecursosMaior}, decisao: hp === null ? 'vigor não identificado' : decidir(c, hp, fadiga?.atual, !!(c.fabricarMaior && faltaRecursosMaior && estoqueMaior() === 0)), modalidadeResultado: { controle: resumo(botaoSoResultado()), confirmada: modoResultadoConfirmado(botaoSoResultado()) }, criatura: resumo(criatura), ataque: resumo(botaoAtacar()), alivio: resumo(botaoPocao('alivio')), restauradora: resumo(botaoPocao('restauradora')), resultadoAberto: !!resultado(), verificacaoHumana: !!window.aurenAvisos?.verificacaoHumana, pendente: pendente && pendente.tipo, segundosAguardandoConfirmacao: pendente ? Math.floor(Math.max(0, agoraAtivo() - pendente.inicio) / 1000) : null, pausas: planoPausas ? {...planoPausas} : null, configuracao: c };
    console.info('Diagnóstico Auren (nenhum clique):', d);
    const encontrado = el => el ? (habilitado(el) ? 'disponível' : 'ainda não pode ser usado') : 'não encontrado';
    status([
      'Situação do jogo:',
      hp === null ? 'Vigor: ainda não consegui ver o valor.' : `Vigor atual: ${hp.toFixed(2)}%.`,
      `Criatura: ${c.criatura} — ${criatura ? 'encontrada' : 'confira o nome e a região aberta'}.`,
      `Só Resultado: ${d.modalidadeResultado.confirmada ? 'já selecionado' : 'será marcado ao iniciar'}.`,
      `Botão para caçar: ${encontrado(botaoAtacar())}.`,
      `Poção de vigor: ${encontrado(botaoPocao('alivio'))}.`,
      `Poção de vigor maior: ${encontrado(botaoPocao('restauradora'))}.`,
      `Fadiga: ${!c.controlarFadiga ? 'controle desligado' : fadiga ? `${fadiga.atual} pontos; limite configurado ${c.limiteFadiga}` : 'abra os detalhes do Vigor no jogo para ver o valor'}.`,
      c.aproveitarMaior ? `Aproveitar a maior: até ${c.limiteFadiga + c.folgaFadiga} de fadiga; usar quando o vigor chegar a ${c.vigorMaior}% ou não puder caçar com a margem.` : 'Aproveitar a maior: desligado.',
      `Expedições: ${c.manterExpedicao ? `ligada, tempo das próximas viagens: ${c.duracaoExpedicao} minutos` : 'desativada'}.`,
      `Pausas: ${c.pausasAleatorias ? 'ligadas' : 'desligadas'}.`,
      pendente ? descreverPendencia() : 'Esta consulta não iniciou lutas nem usou poções.'
    ].join('\n')); return d;
  }
  function ciclo() {
    if (!timer || preparacao || removido || vezBoss) return;
    try {
      atualizarStatusPausas();
      if (planoPausas?.retomarEm && Date.now() < planoPausas.retomarEm) return;
      if (avisosBloqueando()) return;
      if (planoPausas?.retomarEm) {
        planoPausas = null;
        clearInterval(timer); timer = null;
        ui('statusPausas').textContent = 'Descanso terminado. Conferindo o jogo antes de continuar…';
        void iniciar(true);
        return;
      }
      const hp = lerVigor(), r = resultado(), agora = agoraAtivo();
      if (r && (!pendente || pendente.tipo === 'ataque')) {
        const btn = fecharResultado(r);
        if (!btn) return pausar('A luta terminou, mas não consegui fechar o resultado. Clique em Continuar no jogo e tente de novo.', true);
        if (clicar(btn)) {
          pendente = { tipo: 'fechamento', inicio: agora };
          selecionando = null;
          status('Fechando o resultado da luta…');
        } else status('Esperando o botão Continuar ficar disponível…');
        return;
      }
      if (pendente) {
        const tipo = pendente.tipo, baixandoFadiga = pendente.motivo === 'fadiga';
        if (confirmarAcaoPendente(hp, r)) {
          status(tipo === 'fabricacao' ? 'Poção maior fabricada. Conferindo a fadiga antes de continuar.' : tipo === 'fechamento' ? 'Resultado fechado. Conferindo o vigor para a próxima luta.' : baixandoFadiga ? 'A fadiga baixou. Conferindo o jogo antes de continuar.' : 'O vigor voltou. Conferindo se já dá para caçar.');
        }
        if (pendente && agora - pendente.inicio > prazoInterface(45000)) pausar('O jogo demorou a responder. Pausei para não repetir uma ação. Confira o jogo antes de continuar.', true);
        return;
      }
      if (selecionando) {
        const criatura = localizarCriatura(config.criatura);
        if (criatura && selecionada(criatura)) selecionando = null;
      }
      if (!selecionando && iniciarPausaSorteada()) return;
      // Uma renderização temporária não deve desligar o ciclo. Só decide com uma leitura atual válida.
      if (hp === null) {
        status('O vigor ainda não apareceu. Vou esperar e continuar quando conseguir ver o valor. Por enquanto, não luto nem uso poções.');
        return;
      }
      if (config.manterExpedicao && agora >= proximaVerificacaoExpedicao) {
        proximaVerificacaoExpedicao = agora + 30000;
        if (estadoExpedicao().ativa) {
          expedicaoPendente = null; statusExpedicao('Sua expedição está em andamento. A caçada continua.');
        } else {
          void manutencaoExpedicao();
          return;
        }
      }
      const estoque = config.fabricarMaior ? estoqueMaior() : null;
      if (estoque > 0 || !config.fabricarMaior) faltaRecursosMaior = null;
      // Reavalia a necessidade antes de voltar à oficina (a fadiga pode zerar no novo dia).
      if (faltaRecursosMaior && agora - faltaRecursosMaior.conferidoEm >= 60000) faltaRecursosMaior = null;
      const ignorarFadiga = !!(config.fabricarMaior && faltaRecursosMaior && estoque === 0);
      const fadiga = config.controlarFadiga && !ignorarFadiga ? consultarFadiga() : null;
      let acao = decidir(config, hp, fadiga?.atual, ignorarFadiga);
      let liberarPocaoMaior = false;
      if (acao === 'pausar') return pausar('Não consegui conferir o vigor. Veja o valor no jogo antes de continuar.', true);
      if (acao === 'aguardarFadiga') { status('Não consegui ler a fadiga. Vou esperar os detalhes do Vigor aparecerem antes de lutar ou usar poções.'); return; }
      if (acao === 'reduzirFadiga') {
        if (config.fabricarMaior && estoque === 0) { void fabricarPocaoMaior(); return; }
        const maior = botaoPocao('restauradora');
        if (hp === 100 && !habilitado(maior)) {
          liberarPocaoMaior = true;
          acao = 'atacar';
        } else {
          if (!maior) { status('Não encontrei a poção maior. A caçada vai esperar para respeitar seu limite de fadiga.'); return; }
          if (!habilitado(maior)) { status('A poção maior não está disponível. Vou esperar para respeitar seu limite de fadiga.'); return; }
          if (!fadiga || fadiga.depoisMaior >= fadiga.atual) { status('Não consegui conferir quanto a poção vai baixar a fadiga. Vou esperar.'); return; }
          if (!fecharDetalhesFadiga()) { status('Feche os detalhes do Vigor no jogo para continuar.'); return; }
          if (clicar(maior)) {
            pendente = {tipo:'restauradora', motivo:'fadiga', inicio:agora, hp, fadigaAntes:fadiga.atual, fadigaEsperada:fadiga.depoisMaior};
            status(`Usando a poção maior para baixar a fadiga de ${fadiga.atual} para ${fadiga.depoisMaior}. Esperando o jogo confirmar…`);
          }
          return;
        }
      }
      if (acao === 'regenerar') { status(`Vigor em ${hp.toFixed(2)}%. Esperando chegar a ${config.atacar}% para caçar.`); return; }
      if (config.controlarFadiga && !fecharDetalhesFadiga()) { status('Feche os detalhes do Vigor no jogo para continuar.'); return; }
      if (acao === 'atacar') {
        const criatura = localizarCriatura(config.criatura);
        if (!criatura) return pausar('Não encontrei a criatura. Confira o nome e abra a região dela no jogo.', true);
        if (!selecionada(criatura)) {
          if (selecionando && selecionando.nome === config.criatura) {
            if (agora - selecionando.inicio > prazoInterface(8000)) pausar('O jogo não confirmou a criatura. Escolha ela no jogo e clique em Pausar e conferir.', true);
            return;
          }
          const btn = criatura.matches('button,[role="button"]') ? criatura : unico(todos('button,[role="button"]', criatura));
          if (!clicar(btn)) return pausar('Não consegui escolher a criatura. Clique nela no jogo e tente de novo.', true);
          selecionando = { nome: config.criatura, inicio: agora }; status('Escolhendo a criatura. Esperando o jogo responder…'); return;
        }
        selecionando = null;
        const btn = botaoAtacar();
        if (!clicar(btn)) return pausar('Não consegui começar a luta. Confira se a criatura está escolhida e se o botão de caçar está disponível.', true);
        pendente = { tipo: 'ataque', inicio: agora, hp };
        status(liberarPocaoMaior ? 'Caçando para gastar o vigor cheio. Esperando o resultado para conferir a fadiga…' : `Caçando ${config.criatura}. Esperando o resultado…`);
        return;
      }
      const btn = botaoPocao(acao);
      if (!btn) { status(`Não encontrei a poção ${acao === 'alivio' ? 'de vigor' : 'de vigor maior'}. Vou esperar o vigor voltar. Para conferir, clique em Pausar e conferir.`); return; }
      if (!habilitado(btn)) { status(`A poção ${acao === 'alivio' ? 'de vigor' : 'de vigor maior'} não está disponível. Vou esperar o vigor voltar.`); return; }
      if (clicar(btn)) { pendente = { tipo: acao, inicio: agora, hp }; status(`Usando a poção ${acao === 'alivio' ? 'de vigor' : 'de vigor maior'}. Esperando o vigor voltar…`); }
    } catch (e) { pausar(`Não consegui continuar: ${e.message}`, true); }
  }
  async function iniciar(automatico = false, planoSalvo = null) {
    if (vezBoss) { iniciarDepoisBoss = true; status('Vou iniciar a caçada assim que terminar de conferir a investida do Boss.'); return; }
    if (timer || preparacao || removido) return;
    clearTimeout(timerReinicio); timerReinicio = null;
    window.aurenSegundoPlano?.remover('reinicio');
    if (!automatico) reinicioArmado = false;
    const token = {};
    try {
      preparacao = token;
      window.aurenSegundoPlano?.registrar('preparacao',ciclo);
      if (pendente && agoraAtivo() - pendente.inicio > prazoInterface(45000) && !(pendente.tipo === 'ataque' && resultado())) throw Error('O jogo ainda não respondeu à última ação. Confira o jogo e recarregue a página antes de tentar de novo.');
      ui('iniciar').disabled = true;
      // A atualização do jogo pode acontecer durante o descanso. Não navega nem inicia ações nessa retomada.
      if (planoSalvo?.retomarEm && !pendente) {
        config = lerConfig();
        const descansoSalvo = restaurarPlanoPausas(planoSalvo);
        if (descansoSalvo) { preparacao = null; ativarCiclo(descansoSalvo); return; }
      }
      status('Preparando sua caçada…');
      if (!(await navegarCacada(() => preparacao === token && !removido))) return;
      if (preparacao !== token) return;
      if (!(await prepararModalidade(token))) return;
      if (preparacao !== token) return;
      // Valida as escolhas antes de iniciar qualquer expedição.
      config = lerConfig();
      if (!(await prepararExpedicao(token))) return;
      if (preparacao !== token) return;
      if (!(await prepararModalidade(token))) return;
      if (preparacao !== token) return;
      preparacao = null;
      ativarCiclo(planoSalvo);
    } catch (e) {
      if (preparacao === token) pausar(e.message, automatico);
      else if (!timer && !preparacao) status(e.message);
    } finally {
      if (!preparacao || preparacao === token) window.aurenSegundoPlano?.remover('preparacao');
    }
  }
  function fechar() { window.aurenBoss?.pausar(); pausar('Painel fechado e caçada pausada. Clique no ícone da extensão para abrir de novo.'); host.hidden = true; }
  function prepararAtualizacao() {
    if (window.aurenBoss?.ativo()) {
      window.aurenBoss.pausar('O jogo vai atualizar. Clique em Iniciar Boss depois da recarga.');
    }
    if (!timer || !config) return;
    try {
      sessionStorage.setItem('aurenRetomadaAtualizacaoV1', JSON.stringify({
        versao: 1, criadoEm: Date.now(), config,
        pendente: pendente ? { ...pendente, inicio: Date.now() - Math.max(0, agoraAtivo() - pendente.inicio) } : null, expedicaoPendente,
        pausas: planoPausas ? {...planoPausas} : null
      }));
      preparacao = null;
      clearInterval(timer); timer = null;
      window.aurenSegundoPlano?.remover('cacada');
      window.aurenSegundoPlano?.remover('reinicio');
      status('O jogo vai atualizar. Vou continuar a caçada quando a página abrir de novo.');
    } catch {
      console.warn('Não foi possível salvar a retomada. Após atualizar o jogo, clique em Iniciar.');
    }
  }
  const api = { iniciar, pausar, fechar, diagnostico, decidir, seletores, prepararAtualizacao,
    reservarBoss, retornarDoBoss, liberarBoss:()=>{vezBoss=false;},
    ocupado: () => !!(pendente || preparacao || expedicaoPendente) };
  window.aurenCacada = api;
  ui('iniciar').onclick = () => iniciar(); ui('pausar').onclick = () => pausar(); ui('fechar').onclick = fechar;
  ui('diagnostico').onclick = () => { pausar(); try { diagnostico(); } catch (e) { status(e.message); } };
  const campos = ['bossDestino', 'criatura', 'modo', 'atacar', 'limiteAlivio', 'economizar', 'margem', 'continuarOculta', 'reiniciarAutomaticamente', 'manterExpedicao', 'duracaoExpedicao', 'pausasAleatorias', 'intervaloPausaMin', 'intervaloPausaMax', 'duracaoPausaMin', 'duracaoPausaMax', 'controlarFadiga', 'limiteFadiga', 'fabricarMaior', 'craftIngredientes', 'craftQuantidade', 'craftOuro', 'aproveitarMaior', 'folgaFadiga', 'vigorMaior'];
  for (const id of campos) {
    const campo = ui(id), valor = preferencias[id];
    if (campo.type === 'checkbox') { if (typeof valor === 'boolean') campo.checked = valor; }
    else if (typeof valor === 'string' && (id !== 'modo' || ['pocao', 'natural'].includes(valor)) &&
      (id !== 'duracaoExpedicao' || ['15', '60', '240'].includes(valor))) campo.value = valor;
  }
  function atualizarCampos() {
    ui('duracaoExpedicao').disabled = !ui('manterExpedicao').checked;
    for (const id of ['intervaloPausaMin','intervaloPausaMax','duracaoPausaMin','duracaoPausaMax']) ui(id).disabled = !ui('pausasAleatorias').checked;
    ui('fabricarMaior').disabled = !ui('controlarFadiga').checked;
    for (const id of ['craftIngredientes','craftQuantidade','craftOuro']) ui(id).disabled = !ui('controlarFadiga').checked || !ui('fabricarMaior').checked;
    ui('limiteFadiga').disabled = !ui('controlarFadiga').checked;
    ui('aproveitarMaior').disabled = !ui('controlarFadiga').checked;
    for (const id of ['folgaFadiga','vigorMaior']) ui(id).disabled = !ui('controlarFadiga').checked || !ui('aproveitarMaior').checked;
  }
  atualizarCampos(); atualizarStatusPausas();
  if (ui('manterExpedicao').checked) statusExpedicao('Expedição pronta. Clique em Iniciar para caçar e fazer expedições.');
  // Serializa as gravações para uma edição mais antiga não sobrescrever a última.
  let gravacao = Promise.resolve();
  function salvar() {
    const valores = Object.fromEntries(campos.map(id => [id, ui(id).type === 'checkbox' ? ui(id).checked : ui(id).value]));
    gravacao = gravacao.then(() => chrome.storage.local.set({ aurenPreferenciasV33: valores })).catch(() => {
      status('Não consegui salvar suas escolhas. Elas funcionam agora, mas você pode precisar preenchê-las de novo depois.');
    });
  }
  root.querySelectorAll('input,select').forEach(el => el.addEventListener('input', () => {
    if (el.id === 'bossDestino') { window.aurenBoss?.pausar(); salvar(); return; }
    atualizarCampos();
    if (el.id === 'manterExpedicao') statusExpedicao(el.checked ? 'Expedição pronta. Clique em Iniciar para começar.' : 'Não vou iniciar novas expedições. A viagem atual continua no jogo.');
    selecionando = null; pausar('Opções alteradas. Clique em Iniciar para continuar com elas.'); salvar();
  }));
  chrome.runtime.onMessage.addListener((msg, sender, responder) => {
    if (sender.id !== chrome.runtime.id || !msg || msg.origem !== 'auren-popup-v33') return;
    if (msg.comando === 'abrir') {
      host.hidden = false;
      if (host.style.left) {
        const caixa = host.getBoundingClientRect();
        posicionarPainel(caixa.left, caixa.top);
      }
      responder({ ok: true, mensagem: 'Painel aberto. Use Iniciar no painel para executar.' });
    } else if (msg.comando === 'pausar') {
      pausar('Caçada pausada pelo botão da extensão.');
      responder({ ok: true, mensagem: 'Automação pausada nesta aba.' });
    }
  });
  if (erroArmazenamento) status('Não consegui carregar suas escolhas. Confira os campos antes de começar.');
  if (erroNavegacaoInicial) status(erroNavegacaoInicial);
  document.addEventListener('visibilitychange', function oculto() {
    if (removido) { document.removeEventListener('visibilitychange', oculto); return; }
    if (document.hidden && (timer || preparacao) && !ui('continuarOculta').checked) pausar('Você saiu da aba do jogo. Pausei a caçada. Clique em Iniciar para continuar.');
  });
  console.info('Auren instalado. Caçada pausada até clicar em Iniciar. API: window.aurenCacada.');
  // Só a atualização acionada pelo bot permite retomar sem clicar em Iniciar.
  try {
    const salvo = sessionStorage.getItem('aurenRetomadaAtualizacaoV1');
    sessionStorage.removeItem('aurenRetomadaAtualizacaoV1');
    const retomada = salvo ? JSON.parse(salvo) : null;
    const idade = retomada ? Date.now() - retomada.criadoEm : -1;
    if (retomada?.versao === 1 && idade >= 0 && idade <= 120000 && retomada.config && !erroNavegacaoInicial) {
      for (const id of campos) {
        const valor = retomada.config[id];
        if (ui(id).type === 'checkbox' && typeof valor === 'boolean') ui(id).checked = valor;
        else if (typeof valor === 'string' || typeof valor === 'number') ui(id).value = String(valor);
      }
      atualizarCampos();
      if (['iniciar', 'retomar'].includes(retomada.expedicaoPendente?.acao)) expedicaoPendente = retomada.expedicaoPendente;
      const anterior = retomada.pendente;
      if (anterior && ['ataque', 'fechamento', 'alivio', 'restauradora', 'fabricacao'].includes(anterior.tipo) && Number.isFinite(anterior.inicio)) pendente = { ...anterior, inicio: agoraAtivo() - Math.max(0, Date.now() - anterior.inicio) };
      status('Jogo atualizado. Continuando a caçada com suas escolhas…');
      iniciar(false, retomada.pausas);
    }
  } catch { status('Não consegui continuar a caçada anterior. Confira as opções e clique em Iniciar.'); }
})().catch(error => console.error('Não foi possível carregar a extensão Auren:', error));

