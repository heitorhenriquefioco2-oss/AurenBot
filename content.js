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
  const visivel = el => !!el?.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const habilitado = el => visivel(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true' && el.getAttribute('aria-busy') !== 'true';
  const todos = (sel, scope = document) => [...scope.querySelectorAll(sel)].filter(visivel);
  const unico = xs => xs.length === 1 ? xs[0] : null;
  const numero = v => Number(String(v).replace(',', '.'));
  const agoraAtivo = () => Date.now() - (window.aurenAvisos?.tempoVerificacaoHumana || 0);
  const prazoInterface = ms => window.aurenSegundoPlano?.prazo(ms) ?? ms;
  const esperarInterface = () => window.aurenSegundoPlano?.esperar(200) ?? new Promise(resolve=>setTimeout(resolve,200));
  function avisosBloqueando(reportar = status) {
    const bloqueado = window.aurenAvisos?.verificar();
    if (window.aurenAvisos?.verificacaoHumana) reportar(window.aurenAvisos.tipoVerificacao === 'sombra' ? 'Resolva o desafio de sombra no jogo.' : window.aurenAvisos.seloPronto ? 'Verificação pronta. Clique em Apresentar o selo.' : 'Resolva a verificação e clique em Apresentar o selo.');
    return !!bloqueado || !!window.aurenAvisos?.verificacaoHumana;
  }
  function percentual(valor, campo) {
    const texto = String(valor ?? '').trim().replace(/\s*%\s*$/, '').trim();
    if (!/^\d+(?:[.,]\d+)?$/.test(texto)) {
      throw Error(`${campo}: use um número de 0 a 100, como 80 ou 80,5.`);
    }
    const n = Number(texto.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 100) throw Error(`${campo}: use de 0 a 100.`);
    return n;
  }
  const controlesCriatura = 'button, [role="button"], .monster-card, .hunt-monster-card';
  const seletores = {
    // Mantém a chave legada da API; a leitura agora é do Vigor de caçada.
    vida: '.hunt-vitality progress, progress[aria-label="Vigor de caçada" i], .hero-header-status[aria-label*="Vigor" i] progress, .hunt-health-value > strong, .sanctum-vitals',
    criaturas: controlesCriatura,
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
    const leituras = [];
    for (const el of painel.querySelectorAll('.hunt-fatigue-preview .realm-sr-only, .hunt-fatigue-preview [aria-hidden="true"]')) {
      const t = normal(el.textContent);
      const m = t.match(/^fadiga de ([\d.]+) para ([\d.]+)$/) || t.match(/^([\d.]+)\s*(?:→|->)\s*([\d.]+)$/);
      if (!m) continue;
      const atual = inteiroOficina(m[1]), depoisMaior = inteiroOficina(m[2]);
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
    const dialogos = todos('dialog[open], [role="dialog"], [aria-modal="true"], .item-detail-popover');
    if (dialogos.some(el=>!el.matches('.hunt-health-details') && !el.closest('.hunt-health-details'))) return null;
    const leitura = lerFadiga();
    if (leitura) return leitura;
    if (dialogos.length) return null;
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
    const procurado = normal(nome);
    const candidatos = controles => [...controles].filter(el => nomeExato(el, procurado) && visivel(el));
    const modernos = seletores.criaturas === controlesCriatura ? candidatos(document.querySelectorAll('.monster-choices button')) : [];
    const xs = modernos.length ? modernos : candidatos(document.querySelectorAll(seletores.criaturas));
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
    const direto = botaoAcaoResultado();
    if (direto) return direto;
    return unico(botoes().filter(el => /^(cacar e ver resultado|cacar|atacar|batalhar|enfrentar monstro)$/.test(rotuloControle(el))));
  }
  function botaoAcaoResultado() {
    return unico(todos('button.hunt-result, .hunt-actions button').filter(el=>
      /^so(?: o)? resultado$/.test(normal(el.textContent)) || /^so(?: o)? resultado$/.test(rotuloControle(el))));
  }
  function rotuloControle(el) {
    const ignorados = 'svg, img, [aria-hidden="true"], kbd, script, style';
    if (!el.querySelector(ignorados)) return normal(el.textContent);
    const copia = el.cloneNode(true);
    copia.querySelectorAll(ignorados).forEach(no => no.remove());
    return normal(copia.textContent);
  }
  function botaoSoResultado() {
    const direto = botaoAcaoResultado();
    if (direto) return direto;
    const alvo = v => /^so(?: o)? resultado$/.test(normal(v));
    const acionaveis = 'button,a,label,[role="button"],[role="tab"],[role="radio"],[tabindex]';
    const candidatos = new Set();
    for (const el of document.querySelectorAll(acionaveis + ',span,strong,div')) {
      const direto = alvo(el.getAttribute('aria-label')) || alvo(el.getAttribute('title')) || alvo(el.textContent);
      if (!direto && !(el.matches(acionaveis) && el.textContent.length < 300 && alvo(rotuloControle(el)))) continue;
      if (!visivel(el)) continue;
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
      if (agoraAtivo() - inicio > prazoInterface(prazo)) throw Error('Abra a Caçada no jogo e tente novamente.');
      if (!avisosBloqueando(reportar) && !clicado) {
        const botao = menuCacada();
        if (botao && clicar(botao)) {
          clicado = true;
          reportar('Abrindo Caçada…');
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
    while (preparacao === token) {
      if (telaExpedicao()) return true;
      if (agoraAtivo() - inicio > prazoInterface(8000)) throw Error('Abra a Expedição no jogo e tente novamente.');
      if (!avisosBloqueando() && !clicou && clicar(menuExpedicao())) {
        clicou = true; status('Abrindo Expedição…');
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
        statusExpedicao('Expedição em andamento.');
        return true;
      }
      if (expedicaoPendente) {
        statusExpedicao('Aguardando a partida. Confira a tela Expedição.');
        return true;
      }
      if (!(await navegarExpedicao(token))) return false;
      const inicio = agoraAtivo();
      let selecionouDuracao = false;
      while (preparacao === token) {
        if (avisosBloqueando()) { await esperarInterface(); continue; }
        const estado = estadoExpedicao();
        if (estado.ativa) {
          expedicaoPendente = null;
          statusExpedicao('Expedição iniciada. Voltando à Caçada.');
          break;
        }
        if (agoraAtivo() - inicio > 15000) throw Error(expedicaoPendente ? 'Expedição sem confirmação. A caçada continua.' : 'Confira duração, território e estratégia na Expedição.');
        if (!expedicaoPendente) {
          if (estado.pausada) {
            if (clicar(estado.retomar)) {
              expedicaoPendente = { acao: 'retomar' };
              statusExpedicao('Retomando expedição…');
            }
          } else {
            const duracao = opcaoDuracao(config.duracaoExpedicao);
            if (!duracao) throw Error('Confira a duração na tela Expedição.');
            if (!selecionada(duracao)) {
              if (!selecionouDuracao && clicar(duracao)) selecionouDuracao = true;
            } else {
              const duracaoEsperada = { 15: '15 min', 60: '1 h', 240: '4 h' }[config.duracaoExpedicao];
              const iniciarExpedicao = unico(botoes().filter(el => rotuloControle(el) === `explorar por ${duracaoEsperada}`));
              if (clicar(iniciarExpedicao)) {
                expedicaoPendente = { acao: 'iniciar', minutos: config.duracaoExpedicao };
                statusExpedicao('Aguardando partida…');
              }
            }
          }
        }
        await esperarInterface();
      }
    } catch (e) { erro = e.message; statusExpedicao(erro); }
    if (preparacao !== token) return false;
    if (!(await navegarCacada(() => preparacao === token))) return false;
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
      if (preparacao === token) pausar(`Volta à Caçada: ${e.message}`, true);
    } finally {
      if (preparacao === token) preparacao = null;
    }
  }
  function modoResultadoConfirmado(botao) {
    if (!botao) return false;
    if (botao === botaoAcaoResultado()) return true;
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
    while (preparacao === token) {
      if (agoraAtivo() - inicio > prazoInterface(8000)) throw Error('Só Resultado indisponível. Confira a Caçada.');
      if (!avisosBloqueando()) {
        // Na interface atual, o clique já inicia a luta e pertence apenas ao ciclo de ataque.
        if (botaoAcaoResultado()) return true;
        const botao = botaoSoResultado();
        if (botao && modoResultadoConfirmado(botao)) return true;
        if (botao && !clicado && clicar(botao)) {
          clicado = true;
          status('Selecionando Só Resultado…');
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
    const valido = () => preparacao === token;
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
      if (!fecharDetalhesFadiga()) throw Error('Feche os detalhes do Vigor para fabricar.');
      status('Sem poção maior. Conferindo a Oficina…');
      await acionar(()=>unico(todos('nav a,nav button,aside a,aside button,[role="navigation"] a,[role="navigation"] button').filter(el=>nomeExato(el, 'oficina'))), 'Abra a Oficina no jogo.');
      if (!valido()) return;
      await acionar(()=>unico(todos('.workshop-stations button[data-station="cauldron"]')), 'Caldeirão não encontrado.');
      if (!valido()) return;
      await acionar(()=>unico(botoes().filter(el=>rotuloControle(el) === 'pocoes')), 'Poções não encontradas no Caldeirão.');
      if (!valido()) return;
      const receita = () => unico(todos('.workshop-recipe-grid button').filter(el=>/^pocao de vigor maior, [\d.]+ na mochila$/.test(normal(el.getAttribute('aria-label')))));
      // O estoque também pode ter mudado durante o caminho.
      const escolha = await esperar(receita, 'Receita da poção maior não encontrada.');
      if (!valido()) return;
      const estoque = inteiroOficina(normal(escolha.getAttribute('aria-label')).match(/, ([\d.]+) na mochila$/)?.[1]);
      if (estoque === null) throw Error('Estoque da poção maior indisponível.');
      if (estoque > 0) { await voltar(); return; }
      if (!clicar(escolha)) throw Error('Selecione a poção maior na Oficina.');
      const seletor = await esperar(()=>unico(todos('.forge-stage-center .forge-jewel-quantity select')), 'Confira a quantidade de poções.');
      if (!valido()) return;
      if (seletor.value !== '1') {
        if (!habilitado(seletor) || ![...seletor.options].some(o=>o.value === '1')) throw Error('Selecione uma poção por vez.');
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(seletor, '1');
        seletor.dispatchEvent(new Event('change', {bubbles:true}));
      }
      const r = await esperar(receitaMaior, 'A receita mudou. Confira ingrediente, quantidade e ouro do craft.');
      if (!valido()) return;
      let ingrediente = r.ingrediente;
      let semRecursos = r.disponivel < materiais.ouro;
      if (!semRecursos && (!materiais.ingredientes.includes(ingrediente) || !(r.slot.inserido === materiais.quantidade || r.estoque >= materiais.quantidade))) {
        await acionar(()=>unico(todos('.forge-potion-swap-button')), 'Abra o seletor de ingredientes.');
        const cartao = nome => unico(todos('.forge-potion-ingredient-card').filter(el=>normal(el.querySelector('strong')?.textContent) === nome));
        const escolhaParte = await esperar(()=>{
          const opcoes = materiais.ingredientes.map(nome=>{
            const parte = cartao(nome);
            return {nome, estoque:parte ? estoqueParteOficina(parte) : null};
          });
          const disponivel = opcoes.find(opcao=>opcao.estoque >= materiais.quantidade);
          return disponivel || (opcoes.every(opcao=>opcao.estoque !== null) && {nome:null});
        }, 'Confira os ingredientes configurados na mochila.');
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
          }, 'Confira a quantidade do ingrediente.');
          const encaixar = () => todos('.forge-potion-ingredient-apply');
          await acionar(()=>selecaoCorreta() && unico(encaixar()), 'Confira o encaixe do ingrediente.');
          await esperar(()=>!encaixar().length && receitaMaior()?.ingrediente === ingrediente, 'Ingrediente escolhido sem confirmação.');
        } else await acionar(()=>unico(todos('.forge-potion-ingredient-cancel')), 'Feche o seletor de ingredientes.');
      }
      if (!valido()) return;
      if (semRecursos) {
        if (!await voltar()) return;
        faltaRecursosMaior = {conferidoEm:agoraAtivo()};
        status('Sem ingrediente ou ouro. Caçando sem limite de fadiga. Nova conferência em 1 min.');
        return;
      }
      const receitaPronta = atual => atual?.ingrediente === ingrediente && atual.disponivel >= materiais.ouro && atual.slot.inserido === materiais.quantidade && atual.slotOuro.inserido === materiais.ouro;
      if (!receitaPronta(receitaMaior())) {
        await acionar(()=>{
          const atual = receitaMaior();
          if (atual?.ingrediente !== ingrediente || atual.disponivel < materiais.ouro || !(atual.slot.inserido === materiais.quantidade || atual.estoque >= materiais.quantidade)) return null;
          return unico(todos('button.forge-fill-recipe'));
        }, 'Confira o preenchimento da receita.');
      }
      await esperar(()=>receitaPronta(receitaMaior()), 'Confira os ingredientes nos encaixes.');
      if (!valido()) return;
      await esperar(()=>{
        const final = receitaMaior(), botao = final && unico(todos('button.forge-potion-craft-button', final.bancada));
        if (!receitaPronta(final) || !botao || rotuloControle(botao) !== 'preparar pocao de vigor maior') throw Error('A receita mudou. Confira a Oficina.');
        if (!habilitado(botao)) return false;
        pendente = {tipo:'fabricacao', inicio:agoraAtivo(), estoqueAntes:0};
        if (!clicar(botao)) { pendente = null; throw Error('Fabricação sem confirmação. Confira a Oficina.'); }
        return true;
      }, 'Aguardando liberação da fabricação.');
      if (!valido()) return;
      status('Fabricando a maior. Aguardando confirmação…');
      await esperar(()=> {
        const sucesso = unico(todos('.workshop-craft-result').filter(el=>todos('h1,h2,h3',el).some(h=>normal(h.textContent) === 'pocao de vigor maior fabricada')));
        const total = normal(receita()?.getAttribute('aria-label')).match(/, ([\d.]+) na mochila$/);
        if (sucesso || (total && inteiroOficina(total[1]) > 0)) {
          pendente = null;
          if (sucesso && !clicar(unico(todos('.workshop-craft-result-continue', sucesso)))) return false;
          return true;
        }
        return false;
      }, 'Fabricação sem confirmação. Confira a Oficina antes de retomar.', 45000);
      if (!valido()) return;
      if (!await voltar()) return;
      status('Maior fabricada. Conferindo a fadiga na Caçada.');
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
    for (const btn of [...document.querySelectorAll('button')].filter(b => normal(b.textContent) === 'continuar' && visivel(b))) {
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
    </style><section><header id="moverPainel" title="Arraste para mover o painel"><h2>Auren • Assistente de caçada v3.3.41</h2><small>Arraste para mover.</small></header>
    <nav role="tablist" aria-label="Opções de caçada, expedição, extras e pausas"><button id="tabCacada" role="tab" aria-selected="true" aria-controls="abaCacada">Caçada</button><button id="tabExpedicao" role="tab" aria-selected="false" aria-controls="abaExpedicao" tabindex="-1">Expedição</button><button id="tabBoss" role="tab" aria-selected="false" aria-controls="abaBoss" tabindex="-1">Extras</button><button id="tabPausas" role="tab" aria-selected="false" aria-controls="abaPausas" tabindex="-1">Pausas</button></nav>
    <div id="abaCacada" role="tabpanel" aria-labelledby="tabCacada">
    <label>Criatura<input id="criatura" placeholder="Ex.: Corvo do eclipse" maxlength="100"></label>
    <small>Nome exato do jogo. Deixe a região aberta.</small>
    <label>Recuperação de vigor<select id="modo"><option value="pocao">Poções</option><option value="natural">Regeneração</option></select></label>
    <label>Vigor mínimo (%)<input id="atacar" type="text" inputmode="decimal" value="80"></label>
    <label>Poção comum até (%)<input id="limiteAlivio" type="text" inputmode="decimal" value="70"></label>
    <small>A comum recupera vigor até esse limite. Acima dele, aguarda regenerar. A maior reduz fadiga.</small>
    <label><input id="economizar" type="checkbox" checked> Poupar poções</label>
    <label>Margem para esperar (%)<input id="margem" type="text" inputmode="decimal" value="5"></label>
    <small>Com mínimo 80% e margem 5, aguarda de 75% a 80%. A fadiga tem prioridade.</small>
    <label><input id="controlarFadiga" type="checkbox"> Controlar fadiga</label>
    <label>Limite de fadiga (pontos)<input id="limiteFadiga" type="text" inputmode="numeric" value="100" disabled></label>
    <label><input id="aproveitarMaior" type="checkbox" disabled> Gastar vigor antes da maior</label>
    <label>Fadiga extra (pontos)<input id="folgaFadiga" type="text" inputmode="numeric" value="5" disabled></label>
    <label>Usar maior com vigor até (%)<input id="vigorMaior" type="text" inputmode="decimal" value="30" disabled></label>
    <small>Pode caçar abaixo do mínimo. Usa a maior no vigor escolhido, abaixo de 30% ou ao esgotar a margem. Ex.: limite 100 + 5 permite 105.</small>
    <small>Limite mínimo 2. Cada vitória soma 1. Sem aproveitar a maior, reduz fadiga antes do limite.</small>
    <small>Se a maior estiver bloqueada por vigor cheio, caça uma vez e relê a fadiga.</small>
    <label><input id="fabricarMaior" type="checkbox" disabled> Fabricar poção maior</label>
    <small>Fabrica uma por vez. Sem recursos, caça sem limite de fadiga e confere novamente em 1 min.</small>
    <details><summary>Configurar craft</summary>
      <label>Ingredientes permitidos<input id="craftIngredientes" value="Olho de corvo; Coração de serpente" maxlength="500" disabled></label>
      <small>Nomes exatos, separados por ;. Usa um tipo por poção.</small>
      <label>Quantidade por poção<input id="craftQuantidade" type="text" inputmode="numeric" value="1" disabled></label>
      <label>Ouro por poção<input id="craftOuro" type="text" inputmode="numeric" value="1900" disabled></label>
      <small>Ajuste à receita do jogo. O bot confere antes de gastar.</small>
    </details>
    </div>
    <div id="abaExpedicao" role="tabpanel" aria-labelledby="tabExpedicao" hidden>
      <label><input id="manterExpedicao" type="checkbox"> Renovar expedição</label>
      <label>Duração<select id="duracaoExpedicao" disabled><option value="15">15 minutos</option><option value="60" selected>1 hora</option><option value="240">4 horas</option></select></label>
      <small>Escolha território, grau e estratégia no jogo. Mantém a viagem atual; aplica a duração nas próximas e volta à Caçada.</small>
      <output id="statusExpedicao" aria-live="polite">Renovação desligada.</output>
    </div>
    <div id="abaBoss" role="tabpanel" aria-labelledby="tabBoss" hidden>
      <label>Boss<select id="bossDestino"><option value="auto">Tela atual</option><option value="guilda">Guilda</option><option value="mundo">Mundo</option></select></label>
      <p>Ataca com o maior dano disponível.</p>
      <small>Funciona com a caçada ativa ou parada.</small>
      <small>Até 8 investidas por encontro, a cada 15 min. Retorna à Caçada entre ataques.</small>
      <nav><button id="iniciarBoss">Iniciar Boss</button><button id="pausarBoss">Pausar Boss</button></nav>
      <output id="statusBoss" aria-live="polite">Boss parado.</output>
    </div>
    <div id="abaPausas" role="tabpanel" aria-labelledby="tabPausas" hidden>
      <label><input id="pausasAleatorias" type="checkbox"> Pausas automáticas</label>
      <div class="grid"><label>Caçar de (min)<input id="intervaloPausaMin" type="text" inputmode="numeric" value="20" disabled></label><label>Até (min)<input id="intervaloPausaMax" type="text" inputmode="numeric" value="40" disabled></label></div>
      <div class="grid"><label>Descansar de (min)<input id="duracaoPausaMin" type="text" inputmode="numeric" value="2" disabled></label><label>Até (min)<input id="duracaoPausaMax" type="text" inputmode="numeric" value="5" disabled></label></div>
      <small>Use de 1 a 1440 min. Valores iguais fixam a duração.</small>
      <p>A pausa espera a ação terminar e suspende lutas, poções e novas viagens. Avisos continuam ativos.</p>
      <small>Ao fim, volta à Caçada. Pausar, ocultar ou editar opções cancela os horários; Iniciar sorteia de novo.</small>
      <output id="statusPausas" aria-live="polite">Pausas desligadas.</output>
    </div>
    <label><input id="continuarOculta" type="checkbox" aria-describedby="ajudaContinuarOculta"> Continuar em segundo plano</label>
    <small id="ajudaContinuarOculta">Caçada e Boss com o Chrome minimizado. Mantenha jogo e computador ligados; os ciclos podem atrasar.</small>
    <label><input id="reiniciarAutomaticamente" type="checkbox" aria-describedby="ajudaReinicio">Retomar após erro</label>
    <small id="ajudaReinicio">Tenta a cada 10 s, após conferir o jogo. Pausar, ocultar ou editar opções cancela as tentativas.</small>
    <nav><button id="configurarAvisos">Avisos</button></nav><small id="statusAvisos" aria-live="polite">Avisos desligados.</small>
    <nav><button id="diagnostico">Pausar e conferir</button><button id="iniciar">Iniciar</button><button id="pausar">Pausar</button><button id="fechar">Ocultar painel</button></nav>
    <small>Ocultar pausa caçada e extras. Reabra pelo ícone da extensão; os avisos do jogo continuam sendo fechados.</small>
    <output id="status" aria-live="polite">Pronto para iniciar.</output><pre id="log"></pre></section>`;
  document.documentElement.appendChild(host);
  const ui = id => root.getElementById(id);
  window.aurenAvisos?.ouvirAvisosWindows?.(texto=>{ui('statusAvisos').textContent=texto;});
  ui('configurarAvisos').onclick = async () => {
    try {
      const result = await chrome.runtime.sendMessage({origem:'auren-avisos-windows', comando:'configurar'});
      if (!result?.ok) throw Error(result?.erro || 'Falha ao abrir avisos. Tente novamente.');
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
  let timer = null, timerResposta = null, pendente = null, config = null, selecionando = null, preparacao = null;
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
      pausar(`Volta do Boss à Caçada: ${error.message}`, true);
    } finally {
      if (preparacao === token) preparacao = null;
      vezBoss = false;
      if (iniciarDepoisBoss) { iniciarDepoisBoss = false; void iniciar(); }
    }
  }
  const observarProntidao = new MutationObserver(registros => {
    const mudancas = registros.filter(r=>!(r.target instanceof Element && r.target.closest('#auren-cacada-v3')));
    if (!mudancas.length) return;
    // Abrir/fechar a consulta de fadiga não é uma resposta do jogo. Evita ciclos
    // provocados pela própria consulta quando não há poções disponíveis.
    const alternouDetalhes = r => r.type === 'attributes'
      ? r.target.matches('.hunt-health-details') && ['hidden','class','style'].includes(r.attributeName)
      : r.type === 'childList' && r.addedNodes.length + r.removedNodes.length > 0 &&
        [...r.addedNodes, ...r.removedNodes].every(no=>no.nodeType === Node.ELEMENT_NODE && no.matches('.hunt-health-details'));
    if (mudancas.some(r=>!alternouDetalhes(r) && (r.attributeName !== 'style' || r.target.matches('.hunt-vitality progress, [role="dialog"], [aria-modal="true"]')))) agendarCiclo();
    if (!ataquePronto) return;
    const { botao, criatura, modo } = ataquePronto;
    if (!botao.isConnected || !criatura.isConnected || !modo.isConnected || window.aurenAvisos?.verificacaoHumana ||
        todos('dialog[open], [role="dialog"], [aria-modal="true"]').length ||
        mudancas.some(r => r.type === 'attributes' &&
          [botao, criatura, modo].some(el => r.target === el || r.target.contains(el)))) ataquePronto = null;
  });
  observarProntidao.observe(document.documentElement, {
    childList: true, subtree: true, characterData: true, attributes: true,
    attributeFilter: ['disabled', 'aria-disabled', 'aria-busy', 'aria-pressed', 'aria-selected', 'data-selected', 'class', 'hidden', 'style', 'value', 'max', 'aria-valuenow', 'aria-valuetext', 'data-state']
  });
  function agendarCiclo() {
    if (!timer || preparacao || vezBoss || timerResposta !== null) return;
    timerResposta = setTimeout(()=>{
      timerResposta = null;
      ciclo();
    },150);
  }
  const linhas = [];
  function status(msg) {
    const atual = `${timer ? (planoPausas?.retomarEm ? 'Em pausa' : 'Ativo') : 'Pausado'} • ${msg}`;
    if (ui('status').textContent !== atual) ui('status').textContent = atual;
    if (linhas[0] && linhas[0].endsWith(msg)) return;
    linhas.unshift(`${new Date().toLocaleTimeString()} ${msg}`);
    linhas.length = Math.min(linhas.length, 35);
    ui('log').textContent = linhas.join('\n');
  }
  function lerConfig() {
    const c = {
      criatura: ui('criatura').value.trim(),
      modo: ui('modo').value,
      atacar: percentual(ui('atacar').value, 'Vigor mínimo para caçar'),
      limiteAlivio: percentual(ui('limiteAlivio').value, 'Limite da poção comum'),
      economizar: ui('economizar').checked,
      margem: percentual(ui('margem').value, 'Quanto falta para caçar'),
      continuarOculta: ui('continuarOculta').checked,
      reiniciarAutomaticamente: ui('reiniciarAutomaticamente').checked,
      manterExpedicao: ui('manterExpedicao').checked,
      duracaoExpedicao: Number(ui('duracaoExpedicao').value)
    };
    if (![15, 60, 240].includes(c.duracaoExpedicao)) throw Error('Expedição: escolha 15 min, 1 h ou 4 h.');
    if (!c.criatura) throw Error('Informe a criatura pelo nome do jogo.');
    if (c.atacar < 30) throw Error('Vigor mínimo: pelo menos 30%.');
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
      if (!ingredientes.length) throw Error('Craft: informe pelo menos um ingrediente.');
      if (quantidade === null || quantidade < 1) throw Error('Craft: quantidade inteira de 1 ou mais.');
      if (ouro === null) throw Error('Craft: ouro inteiro de 0 ou mais.');
      c.craft = {ingredientes, quantidade, ouro};
    }
    c.aproveitarMaior = c.controlarFadiga && ui('aproveitarMaior').checked;
    c.folgaFadiga = 0;
    c.vigorMaior = null;
    c.limiteFadiga = null;
    if (c.controlarFadiga) {
      const valor = ui('limiteFadiga').value.trim();
      if (!/^\d+$/.test(valor) || !Number.isSafeInteger(Number(valor)) || Number(valor) < 2) throw Error('Fadiga: use um número inteiro de 2 ou mais.');
      c.limiteFadiga = Number(valor);
    }
    if (c.aproveitarMaior) {
      const folga = ui('folgaFadiga').value.trim();
      if (!/^\d+$/.test(folga) || !Number.isSafeInteger(Number(folga)) ||
          !Number.isSafeInteger(c.limiteFadiga + Number(folga))) throw Error('Fadiga extra: use um inteiro válido de 0 ou mais.');
      c.folgaFadiga = Number(folga);
      c.vigorMaior = percentual(ui('vigorMaior').value, 'Vigor para usar a maior');
    }
    c.pausasAleatorias = ui('pausasAleatorias').checked;
    for (const [id, nome] of [['intervaloPausaMin','Tempo mínimo antes de pausar'], ['intervaloPausaMax','Tempo máximo antes de pausar'], ['duracaoPausaMin','Descanso mínimo'], ['duracaoPausaMax','Descanso máximo']]) {
      c[id] = null;
      if (!c.pausasAleatorias) continue;
      const valor = ui(id).value.trim();
      if (!/^\d+$/.test(valor) || Number(valor) < 1 || Number(valor) > 1440) throw Error(`${nome}: use minutos inteiros de 1 a 1440.`);
      c[id] = Number(valor);
    }
    if (c.pausasAleatorias && c.intervaloPausaMin > c.intervaloPausaMax) throw Error('O mínimo não pode ser maior que o máximo.');
    if (c.pausasAleatorias && c.duracaoPausaMin > c.duracaoPausaMax) throw Error('O descanso mínimo não pode ser maior que o máximo.');
    return c;
  }
  function sortearMinutos(minimo, maximo) {
    return minimo + Math.floor(Math.random() * (maximo - minimo + 1));
  }
  function atualizarStatusPausas() {
    let texto;
    if (!ui('pausasAleatorias').checked) texto = 'Pausas desligadas.';
    else if (!planoPausas) texto = 'A próxima pausa será sorteada ao iniciar.';
    else if (planoPausas.retomarEm) {
      const faltam = Math.ceil((planoPausas.retomarEm - Date.now()) / 60000);
      texto = faltam > 0 ? `Descanso: até ${faltam} min.` : 'Descanso concluído. Aguardando o jogo.';
    } else {
      const faltam = Math.ceil((planoPausas.proximaEm - Date.now()) / 60000);
      texto = faltam > 0 ? `Pausa em até ${faltam} min. Descanso de ${planoPausas.duracaoMinutos} min.` : 'Pausa pronta. Concluindo a ação atual.';
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
    status(planoPausas?.retomarEm ? 'Descanso em andamento. Retomada automática.' : 'Caçada ativa.');
  }
  function iniciarPausaSorteada() {
    if (!planoPausas || planoPausas.retomarEm || Date.now() < planoPausas.proximaEm) return false;
    planoPausas.retomarEm = Date.now() + planoPausas.duracaoMinutos * 60000;
    atualizarStatusPausas();
    status(`Descanso de ${planoPausas.duracaoMinutos} min. Retomada automática.`);
    return true;
  }
  function pausar(msg = 'Caçada pausada.', automatica = false) {
    clearTimeout(timerResposta); timerResposta = null;
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
    if (!reinicioArmado || host.hidden || !config?.reiniciarAutomaticamente) return;
    clearTimeout(timerReinicio);
    status(`${msg} Nova tentativa em 10 s.`);
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
    if (!pendente) return 'Nenhuma ação pendente.';
    const tipos = { fabricacao: 'Fabricação da poção maior', ataque: 'Ataque', fechamento: 'Fechar resultado', alivio: 'Poção de vigor', restauradora: pendente.motivo === 'fadiga' ? 'Maior para fadiga' : 'Poção de vigor maior' };
    const segundos = Math.floor(Math.max(0, agoraAtivo() - pendente.inicio) / 1000);
    return `${tipos[pendente.tipo] || 'Ação'} aguardando confirmação${incluirTempo ? ` há ${segundos} s` : ''}.`;
  }
  function recuperarAtaqueSemResultado() {
    motivoRecuperacao = '';
    if (pendente?.tipo !== 'ataque' || agoraAtivo() - pendente.inicio <= prazoInterface(45000)) return false;
    const resultados = todos('button.hero-header-results, button[aria-label="Ver resultados pendentes"]');
    if (resultados.length) {
      motivoRecuperacao = 'Aguardando o resultado pendente.';
      ataquePronto = null;
      if (resultados.length === 1 && !pendente.tentouAbrirResultados && habilitado(resultados[0])) {
        pendente.tentouAbrirResultados = true;
        clicar(resultados[0]);
        status('Abrindo resultado pendente…');
      }
      return false;
    }
    const criatura = localizarCriatura(config.criatura), botao = botaoAtacar(), modo = botaoSoResultado();
    const pronto = telaCacada() && modoResultadoConfirmado(modo) &&
      criatura && selecionada(criatura) && habilitado(botao) && !botao.closest('[aria-busy="true"]') &&
      !todos('dialog[open], [role="dialog"], [aria-modal="true"]').length;
    if (!pronto) { ataquePronto = null; motivoRecuperacao = 'Nova caçada ainda indisponível.'; return false; }
    motivoRecuperacao = 'Nova caçada liberada. Aguardando 10 s de estabilidade.';
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
    status('Último resultado ausente. Nova caçada liberada. Conferindo vigor.');
    return true;
  }
  async function tentarReinicio() {
    timerReinicio = null;
    if (!reinicioArmado || timer || preparacao || host.hidden) return;
    try {
      if (avisosBloqueando()) { ataquePronto = null; return agendarReinicio('Responda ou feche o aviso no jogo.'); }
      if (document.hidden && !config.continuarOculta) { ataquePronto = null; return agendarReinicio('Abra a aba do jogo.'); }
      const hp = lerVigor(), r = resultado();
      if (hp === null) { ataquePronto = null; return agendarReinicio('Aguardando leitura do vigor.'); }
      if (!confirmarAcaoPendente(hp, r) && !recuperarAtaqueSemResultado()) {
        return agendarReinicio(`${descreverPendencia(false)} ${motivoRecuperacao || 'Aguardando confirmação do jogo.'}`);
      }
      selecionando = null;
      await iniciar(true);
    } catch (e) { agendarReinicio(`Falha ao retomar: ${e.message}`); }
  }
  function diagnostico() {
    const c = lerConfig(), hp = lerVigor(), criatura = localizarCriatura(c.criatura), fadiga = lerFadiga();
    const estoque = estoqueMaior(), modo = botaoSoResultado();
    const ignorarFadiga = !!(c.fabricarMaior && faltaRecursosMaior && estoque === 0);
    const d = {
      vigor: hp,
      fadiga: fadiga?.atual ?? null,
      previsaoFadiga: fadiga,
      fabricacao: {estoqueMaior:estoque, semRecursos:!!faltaRecursosMaior},
      decisao: hp === null ? 'vigor não identificado' : decidir(c,hp,fadiga?.atual,ignorarFadiga),
      modalidadeResultado: {controle:resumo(modo), confirmada:modoResultadoConfirmado(modo)},
      criatura: resumo(criatura),
      ataque: resumo(botaoAtacar()),
      alivio: resumo(botaoPocao('alivio')),
      restauradora: resumo(botaoPocao('restauradora')),
      resultadoAberto: !!resultado(),
      verificacaoHumana: !!window.aurenAvisos?.verificacaoHumana,
      pendente: pendente && pendente.tipo,
      segundosAguardandoConfirmacao: pendente ? Math.floor(Math.max(0,agoraAtivo()-pendente.inicio)/1000) : null,
      pausas: planoPausas ? {...planoPausas} : null,
      configuracao: c
    };
    console.info('Diagnóstico Auren (nenhum clique):', d);
    const encontrado = el => el ? (habilitado(el) ? 'disponível' : 'indisponível') : 'não encontrado';
    status([
      'Situação do jogo:',
      hp === null ? 'Vigor: indisponível.' : `Vigor: ${hp.toFixed(2)}%.`,
      `Criatura: ${c.criatura} — ${criatura ? 'encontrada' : 'confira o nome e a região aberta'}.`,
      botaoAcaoResultado() ? 'Só Resultado: ataque direto.' :
        `Só Resultado: ${d.modalidadeResultado.confirmada ? 'já selecionado' : 'será marcado ao iniciar'}.`,
      `Ataque: ${encontrado(botaoAtacar())}.`,
      `Poção de vigor: ${encontrado(botaoPocao('alivio'))}.`,
      `Poção de vigor maior: ${encontrado(botaoPocao('restauradora'))}.`,
      `Fadiga: ${!c.controlarFadiga ? 'controle desligado' : fadiga ? `${fadiga.atual} pontos; limite configurado ${c.limiteFadiga}` : 'abra os detalhes do Vigor'}.`,
      c.aproveitarMaior ? `Maior: fadiga até ${c.limiteFadiga + c.folgaFadiga}, vigor até ${c.vigorMaior}%.` : 'Aproveitar maior: desligado.',
      `Expedições: ${c.manterExpedicao ? `ligada, próximas viagens de ${c.duracaoExpedicao} min` : 'desativada'}.`,
      `Pausas: ${c.pausasAleatorias ? 'ligadas' : 'desligadas'}.`,
      pendente ? descreverPendencia() : 'Consulta concluída.'
    ].join('\n')); return d;
  }
  function ciclo() {
    if (!timer || preparacao || vezBoss) return;
    try {
      atualizarStatusPausas();
      if (planoPausas?.retomarEm && Date.now() < planoPausas.retomarEm) return;
      if (avisosBloqueando()) return;
      if (planoPausas?.retomarEm) {
        planoPausas = null;
        clearInterval(timer); timer = null;
        ui('statusPausas').textContent = 'Descanso concluído. Conferindo o jogo…';
        void iniciar(true);
        return;
      }
      const hp = lerVigor(), r = resultado(), agora = agoraAtivo();
      if (r && (!pendente || pendente.tipo === 'ataque')) {
        const btn = fecharResultado(r);
        if (!btn) return pausar('Clique em Continuar no resultado e tente novamente.', true);
        if (clicar(btn)) {
          pendente = { tipo: 'fechamento', inicio: agora };
          selecionando = null;
          status('Fechando resultado…');
        } else status('Aguardando o botão Continuar…');
        return;
      }
      if (pendente) {
        const tipo = pendente.tipo, baixandoFadiga = pendente.motivo === 'fadiga';
        if (confirmarAcaoPendente(hp, r)) {
          status(tipo === 'fabricacao' ? 'Maior fabricada. Conferindo fadiga.' : tipo === 'fechamento' ? 'Resultado fechado. Conferindo vigor.' : baixandoFadiga ? 'Fadiga reduzida. Conferindo o jogo.' : 'Vigor recuperado. Conferindo a caçada.');
          agendarCiclo();
        }
        if (pendente && agora - pendente.inicio > prazoInterface(45000)) pausar('Ação sem confirmação. Confira o jogo antes de retomar.', true);
        return;
      }
      if (selecionando) {
        const criatura = localizarCriatura(config.criatura);
        if (criatura && selecionada(criatura)) selecionando = null;
      }
      if (!selecionando && iniciarPausaSorteada()) return;
      // Uma renderização temporária não deve desligar o ciclo. Só decide com uma leitura atual válida.
      if (hp === null) {
        status('Vigor indisponível. Aguardando leitura.');
        return;
      }
      if (config.manterExpedicao && agora >= proximaVerificacaoExpedicao) {
        proximaVerificacaoExpedicao = agora + 30000;
        if (estadoExpedicao().ativa) {
          expedicaoPendente = null; statusExpedicao('Expedição em andamento.');
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
      if (acao === 'pausar') return pausar('Confira o vigor no jogo antes de retomar.', true);
      if (acao === 'aguardarFadiga') { status('Fadiga indisponível. Aguardando os detalhes do Vigor.'); return; }
      if (acao === 'reduzirFadiga') {
        if (config.fabricarMaior && estoque === 0) { void fabricarPocaoMaior(); return; }
        const maior = botaoPocao('restauradora');
        if (hp === 100 && !habilitado(maior)) {
          liberarPocaoMaior = true;
          acao = 'atacar';
        } else {
          if (!maior) { status('Poção maior não encontrada. Aguardando.'); return; }
          if (!habilitado(maior)) { status('A poção maior não está disponível. Aguardando.'); return; }
          if (!fadiga || fadiga.depoisMaior >= fadiga.atual) { status('Redução de fadiga desconhecida. Aguardando.'); return; }
          if (!fecharDetalhesFadiga()) { status('Feche os detalhes do Vigor.'); return; }
          if (clicar(maior)) {
            pendente = {tipo:'restauradora', motivo:'fadiga', inicio:agora, hp, fadigaAntes:fadiga.atual, fadigaEsperada:fadiga.depoisMaior};
            status(`Maior: fadiga ${fadiga.atual} → ${fadiga.depoisMaior}. Aguardando confirmação…`);
          }
          return;
        }
      }
      if (acao === 'regenerar') { status(`Vigor ${hp.toFixed(2)}%. Aguardando ${config.atacar}%.`); return; }
      if (config.controlarFadiga && !fecharDetalhesFadiga()) { status('Feche os detalhes do Vigor.'); return; }
      if (acao === 'atacar') {
        const criatura = localizarCriatura(config.criatura);
        if (!criatura) return pausar('Criatura não encontrada. Confira nome e região.', true);
        if (!selecionada(criatura)) {
          if (selecionando && selecionando.nome === config.criatura) {
            if (agora - selecionando.inicio > prazoInterface(8000)) pausar('Seleção sem confirmação. Escolha a criatura e use Pausar e conferir.', true);
            return;
          }
          const btn = criatura.matches('button,[role="button"]') ? criatura : unico(todos('button,[role="button"]', criatura));
          if (!clicar(btn)) return pausar('Escolha a criatura no jogo e tente novamente.', true);
          selecionando = { nome: config.criatura, inicio: agora }; status('Selecionando criatura…'); return;
        }
        selecionando = null;
        const btn = botaoAtacar();
        if (!clicar(btn)) return pausar('Ataque indisponível. Confira criatura e botão de caçar.', true);
        pendente = { tipo: 'ataque', inicio: agora, hp };
        status(liberarPocaoMaior ? 'Gastando vigor cheio. Aguardando resultado…' : `Caçando ${config.criatura}. Aguardando resultado…`);
        return;
      }
      const btn = botaoPocao(acao);
      if (!btn) { status(`Poção ${acao === 'alivio' ? 'de vigor' : 'de vigor maior'} não encontrada. Aguardando vigor.`); return; }
      if (!habilitado(btn)) { status(`Poção ${acao === 'alivio' ? 'de vigor' : 'de vigor maior'} não está disponível. Aguardando vigor.`); return; }
      if (clicar(btn)) { pendente = { tipo: acao, inicio: agora, hp }; status(`Usando poção ${acao === 'alivio' ? 'de vigor' : 'de vigor maior'}. Aguardando confirmação…`); }
    } catch (e) { pausar(`Não consegui continuar: ${e.message}`, true); }
  }
  async function iniciar(automatico = false, planoSalvo = null) {
    if (vezBoss) { iniciarDepoisBoss = true; status('Aguardando a investida do Boss para iniciar.'); return; }
    if (timer || preparacao) return;
    clearTimeout(timerReinicio); timerReinicio = null;
    window.aurenSegundoPlano?.remover('reinicio');
    if (!automatico) reinicioArmado = false;
    const token = {};
    try {
      preparacao = token;
      window.aurenSegundoPlano?.registrar('preparacao',ciclo);
      if (pendente && agoraAtivo() - pendente.inicio > prazoInterface(45000) && !(pendente.tipo === 'ataque' && resultado())) throw Error('Ação anterior sem confirmação. Confira o jogo e recarregue a página.');
      ui('iniciar').disabled = true;
      // A atualização do jogo pode acontecer durante o descanso. Não navega nem inicia ações nessa retomada.
      if (planoSalvo?.retomarEm && !pendente) {
        config = lerConfig();
        const descansoSalvo = restaurarPlanoPausas(planoSalvo);
        if (descansoSalvo) { preparacao = null; ativarCiclo(descansoSalvo); return; }
      }
      status('Preparando caçada…');
      if (!(await navegarCacada(() => preparacao === token))) return;
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
  function fechar() { window.aurenBoss?.pausar(); pausar('Painel oculto. Reabra pelo ícone da extensão.'); host.hidden = true; }
  function prepararAtualizacao() {
    if (window.aurenBoss?.ativo()) {
      window.aurenBoss.pausar('Atualizando jogo. Reinicie o Boss após a recarga.');
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
      status('Atualizando jogo. A caçada será retomada.');
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
  if (ui('manterExpedicao').checked) statusExpedicao('Expedição pronta para iniciar.');
  // Serializa as gravações para uma edição mais antiga não sobrescrever a última.
  let gravacao = Promise.resolve();
  function salvar() {
    const valores = Object.fromEntries(campos.map(id => [id, ui(id).type === 'checkbox' ? ui(id).checked : ui(id).value]));
    gravacao = gravacao.then(() => chrome.storage.local.set({ aurenPreferenciasV33: valores })).catch(() => {
      status('Opções aplicadas, mas não salvas. Confira ao reabrir.');
    });
  }
  root.querySelectorAll('input,select').forEach(el => el.addEventListener('input', () => {
    if (el.id === 'bossDestino') { window.aurenBoss?.pausar(); salvar(); return; }
    atualizarCampos();
    if (el.id === 'manterExpedicao') statusExpedicao(el.checked ? 'Expedição pronta para iniciar.' : 'Renovação desligada. A viagem atual continua.');
    selecionando = null; pausar('Opções alteradas. Clique em Iniciar.'); salvar();
  }));
  chrome.runtime.onMessage.addListener((msg, sender, responder) => {
    if (sender.id !== chrome.runtime.id || !msg || msg.origem !== 'auren-popup-v33') return;
    if (msg.comando === 'abrir') {
      host.hidden = false;
      if (host.style.left) {
        const caixa = host.getBoundingClientRect();
        posicionarPainel(caixa.left, caixa.top);
      }
      responder({ ok: true, mensagem: 'Painel aberto.' });
    } else if (msg.comando === 'pausar') {
      pausar('Caçada pausada.');
      responder({ ok: true, mensagem: 'Caçada pausada.' });
    }
  });
  if (erroArmazenamento) status('Falha ao carregar opções. Confira os campos.');
  if (erroNavegacaoInicial) status(erroNavegacaoInicial);
  document.addEventListener('visibilitychange', function oculto() {
    if (document.hidden && (timer || preparacao) && !ui('continuarOculta').checked) pausar('Aba oculta. Caçada pausada.');
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
      status('Jogo atualizado. Retomando caçada…');
      iniciar(false, retomada.pausas);
    }
  } catch { status('Confira as opções e clique em Iniciar para retomar.'); }
})().catch(error => console.error('Não foi possível carregar a extensão Auren:', error));

