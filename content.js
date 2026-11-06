(async () => {
  'use strict';
  // Interage somente com a interface visível; não chama APIs privadas.
  if (document.getElementById('auren-cacada-v3') || document.getElementById('auren-bot-panel')) {
    console.warn('Recarregue a página para encerrar o bot antigo antes de executar esta versão.');
    return;
  }
  let preferencias = {};
  let erroArmazenamento = false;
  try {
    const salvo = await chrome.storage.local.get('aurenPreferenciasV33');
    if (salvo.aurenPreferenciasV33 && typeof salvo.aurenPreferenciasV33 === 'object') preferencias = salvo.aurenPreferenciasV33;
  } catch { erroArmazenamento = true; }

  const normal = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const texto = el => normal(el && [el.textContent, el.getAttribute('aria-label'), el.getAttribute('title')].filter(Boolean).join(' '));
  const visivel = el => !!el && el.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';
  const habilitado = el => visivel(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true' && el.getAttribute('aria-busy') !== 'true';
  const todos = (sel, scope = document) => [...scope.querySelectorAll(sel)].filter(visivel);
  const unico = xs => xs.length === 1 ? xs[0] : null;
  const numero = v => Number(String(v).replace(',', '.'));
  function percentual(valor, campo) {
    const texto = String(valor ?? '').trim().replace(/\s*%\s*$/, '').trim();
    if (!/^\d+(?:[.,]\d+)?$/.test(texto)) {
      throw Error(`${campo}: informe um número, por exemplo 80 ou 80,5. Valor recebido: ${JSON.stringify(valor)}.`);
    }
    const n = Number(texto.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 100) throw Error(`${campo}: o valor deve estar entre 0 e 100. Recebido: ${texto}.`);
    return n;
  }
  const seletores = {
    vida: '.hero-header-status[aria-label*="Vida"] progress, .sanctum-vitals',
    criaturas: 'button, [role="button"], .monster-card, .hunt-monster-card',
    // Opcional: preencher pelo console se o jogo usar classes diferentes.
    selecionada: '', atacar: '', alivio: '', restauradora: '', resultado: ''
  };

  function decidir(c, hp) {
    if (hp <= 0) return 'pausar';
    if (hp >= c.atacar) return 'atacar';
    if (c.modo === 'natural' || (c.economizar && c.atacar - hp <= c.margem + 1e-9)) return 'regenerar';
    if (hp <= c.limite) return 'restauradora';
    return hp <= c.limiteAlivio ? 'alivio' : 'regenerar';
  }

  function lerVida() {
    for (const el of todos(seletores.vida)) {
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
    return unico(botoes().filter(el => /^(cacar e ver resultado|cacar|atacar|batalhar)$/.test(normal(el.textContent))));
  }
  function botaoSoResultado() {
    return unico(todos('button, [role="button"], [role="tab"], [role="radio"]').filter(el => nomeExato(el, 'so o resultado')));
  }
  function telaExpedicao() {
    return todos('h1,h2,[role="heading"]').some(el => normal(el.textContent) === 'expedicao');
  }
  function telaCacada() {
    return !telaExpedicao() && (!!botaoSoResultado() || todos('h1,h2,[role="heading"]').some(el => normal(el.textContent) === 'cacada'));
  }
  function menuCacada() {
    const controles = todos('a,button,[role="button"],[role="link"]').filter(el => nomeExato(el, 'cacada'));
    const laterais = controles.filter(el => el.closest('aside,nav,[role="navigation"]'));
    return unico(laterais.length ? laterais : controles);
  }
  async function navegarCacada(valido) {
    const inicio = Date.now();
    let clicado = false;
    while (valido()) {
      if (telaCacada()) return true;
      if (Date.now() - inicio > 8000) throw Error('Não foi possível abrir Caçada em 8s. Abra a aba pelo menu esquerdo e tente novamente.');
      if (!window.aurenAvisos?.verificar() && !clicado) {
        const botao = menuCacada();
        if (botao && clicar(botao)) {
          clicado = true;
          status('Abrindo Caçada pelo menu. Aguardando a tela carregar.');
        }
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return false;
  }
  function estadoExpedicao() {
    const controles = todos('button, [role="button"]').filter(el => nomeExato(el, 'pausar expedicao'));
    const aviso = todos('h1,h2,h3,h4,p,strong,span,div').some(el => normal(el.textContent) === 'heroi em expedicao');
    const pausada = todos('h1,h2,h3,h4,p,strong,span,button,[role="button"]').some(el =>
      /^(expedicao pausada|jornada pausada|retomar expedicao|continuar expedicao|ate o retorno automatico)$/.test(normal(el.textContent)));
    return { ativa: !pausada && (controles.length > 0 || aviso), pausada, botao: unico(controles) };
  }
  function perguntarExpedicao(token) {
    status('Expedição ativa. Escolha se deseja pausá-la para iniciar a caçada.');
    ui('confirmacaoExpedicao').hidden = false;
    ui('aceitarExpedicao').focus();
    return new Promise(resolve => {
      token.responderExpedicao = aceitar => {
        delete token.responderExpedicao;
        ui('confirmacaoExpedicao').hidden = true;
        ui('aceitarExpedicao').onclick = null;
        ui('cancelarExpedicao').onclick = null;
        resolve(aceitar);
      };
      ui('aceitarExpedicao').onclick = () => token.responderExpedicao?.(true);
      ui('cancelarExpedicao').onclick = () => token.responderExpedicao?.(false);
    });
  }
  async function prepararExpedicao(token) {
    if (!estadoExpedicao().ativa) return true;
    if (!(await perguntarExpedicao(token))) {
      if (preparacao === token) pausar('Início cancelado. A expedição foi mantida.');
      return false;
    }
    if (preparacao !== token) return false;
    const inicio = Date.now();
    let clicouOrigem = false, clicouNaExpedicao = false;
    while (preparacao === token && !removido) {
      if (Date.now() - inicio > 8000) throw Error('Pausa da expedição não confirmada em 8s. Confira o jogo antes de iniciar novamente.');
      if (!window.aurenAvisos?.verificar()) {
        const expedicao = estadoExpedicao();
        if (!expedicao.ativa && (telaCacada() || (telaExpedicao() && (expedicao.pausada || clicouNaExpedicao)))) {
          if (!(await navegarCacada(() => preparacao === token && !removido))) return false;
          if (estadoExpedicao().ativa) throw Error('A expedição ainda está ativa ao voltar para Caçada. Confira o jogo antes de tentar novamente.');
          return true;
        }
        const naExpedicao = telaExpedicao();
        // Na Caçada, o primeiro botão pode apenas abrir Expedição.
        // A autorização cobre a pausa no destino, uma única vez em cada tela.
        const podeClicar = naExpedicao ? !clicouNaExpedicao : !clicouOrigem;
        if (podeClicar && expedicao.botao && clicar(expedicao.botao)) {
          if (naExpedicao) clicouNaExpedicao = true;
          else clicouOrigem = true;
          status(naExpedicao ? 'Pausa acionada na tela de Expedição. Aguardando confirmação.' : 'Pausa solicitada. Aguardando o jogo ou a tela de Expedição.');
        }
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return false;
  }
  function modoResultadoConfirmado(botao) {
    if (!botao) return false;
    const marcas = ['aria-selected', 'aria-pressed', 'aria-checked', 'data-selected'];
    if (marcas.some(a => botao.getAttribute(a) === 'true') || botao.getAttribute('data-state') === 'active' ||
        /(^|\s)(selected|is-selected|active|is-active)(\s|$)/.test(botao.className || '')) return true;
    if (marcas.some(a => botao.getAttribute(a) === 'false')) return false;
    // Algumas versões indicam a modalidade apenas pelo texto do botão de caçar.
    return todos('button, [role="button"]', document.querySelector('main') || document)
      .some(el => normal(el.textContent) === 'cacar e ver resultado');
  }
  async function prepararModalidade(token) {
    const inicio = Date.now();
    let clicado = false;
    while (preparacao === token && !removido) {
      if (Date.now() - inicio > 8000) throw Error('Não foi possível confirmar Só o resultado em 8s. Confira a tela de Caçada e tente novamente.');
      if (!window.aurenAvisos?.verificar()) {
        const botao = botaoSoResultado();
        if (!botao) throw Error('Opção Só o resultado ausente ou ambígua. Abra a tela de Caçada e tente novamente.');
        if (modoResultadoConfirmado(botao)) return true;
        if (!clicado && clicar(botao)) {
          clicado = true;
          status('Selecionando Só o resultado. Aguardando confirmação antes de iniciar a caçada.');
        }
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return false;
  }
  function botaoPocao(tipo) {
    if (seletores[tipo]) return unico(todos(seletores[tipo]));
    const lista = todos('button, [role="button"]');
    const especificos = lista.filter(el => {
      const t = texto(el);
      return tipo === 'alivio' ? /\balivio\b/.test(t) && !/\brestauradora\b/.test(t) : /\brestauradora\b/.test(t) && !/\balivio\b/.test(t);
    });
    if (especificos.length) return unico(especificos);
    // Algumas telas apresentam as poções apenas pelo efeito (+40% / +100%).
    const efeito = tipo === 'alivio' ? /\+\s*40\s*%/ : /\+\s*100\s*%/;
    const outroEfeito = tipo === 'alivio' ? /\+\s*100\s*%/ : /\+\s*40\s*%/;
    return unico(lista.filter(el => efeito.test(texto(el)) && !outroEfeito.test(texto(el)) && !/comprar|fabricar|receita|ouro|cristais/.test(texto(el))));
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

  const host = document.createElement('div');
  host.id = 'auren-cacada-v3';
  host.style.cssText = 'position:fixed;right:16px;top:70px;width:min(390px,calc(100vw - 32px));z-index:2147483647';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    :host{all:initial;color-scheme:dark}*{box-sizing:border-box}section{background:#141d24;color:#f2eee4;border:1px solid #b99b60;border-radius:10px;padding:15px;font:13px/1.45 system-ui;box-shadow:0 8px 32px #0008;max-height:calc(100vh - 90px);overflow:auto}h2{font-size:17px;margin:0 0 8px}p{color:#d6c399}label{display:block;margin:8px 0}input,select{display:block;width:100%;background:#25323d;border:1px solid #65727b;border-radius:4px;color:white;font:inherit;padding:6px}input[type=checkbox]{display:inline;width:auto}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}nav{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}button{font:inherit;border:0;border-radius:4px;padding:8px;cursor:pointer;background:#c0a269;color:#101820}output{display:block;background:#25323d;padding:9px;white-space:pre-wrap}pre{font:11px/1.5 monospace;white-space:pre-wrap;max-height:160px;overflow:auto}small{color:#bcc9d2}
    </style><section><h2>Auren • Caçada real v3.3.4</h2>
    <p>Caçada inicia pausada. O fechamento de avisos já está ativo. Abra a tela de Caçada e confira o diagnóstico.</p>
    <label>Nome exato da criatura<input id="criatura" placeholder="Golem de entulho" maxlength="100"></label>
    <label>Recuperação<select id="modo"><option value="pocao">Usar poções</option><option value="natural">Somente regeneração automática</option></select></label>
    <div class="grid"><label>Atacar a partir de (%)<input id="atacar" type="text" inputmode="decimal" value="80"></label><label>Restauradora se vida ≤ (%)<input id="limite" type="text" inputmode="decimal" value="30"></label></div>
    <label>Alívio se vida ≤ (%)<input id="limiteAlivio" type="text" inputmode="decimal" value="70"></label>
    <small>Restauradora até o limite dela; alívio acima desse limite e até o limite de alívio. Acima disso, aguardar regeneração. A vida mínima para atacar e a economia de poções têm prioridade.</small>
    <label><input id="economizar" type="checkbox" checked> Economizar poções aguardando pouca vida</label>
    <label>Esperar quando faltar até (pontos percentuais)<input id="margem" type="text" inputmode="decimal" value="5"></label>
    <small>Ex.: alvo 80%, margem 5 → de 75% a 80%, aguardar. Sem a poção escolhida, aguardar regeneração.</small>
    <nav><button id="diagnostico">Diagnóstico</button><button id="iniciar">Iniciar</button><button id="pausar">Pausar</button><button id="fechar">Ocultar painel</button></nav>
    <div id="confirmacaoExpedicao" role="group" aria-label="Expedição ativa" hidden>
      <p>Seu herói está em expedição. Deseja pausar a expedição para iniciar a caçada? Ela não será retomada automaticamente pelo bot.</p>
      <nav><button id="aceitarExpedicao">Pausar expedição e continuar</button><button id="cancelarExpedicao">Cancelar início</button></nav>
    </div>
    <output id="status" aria-live="polite">Caçada pausada. Fechamento de avisos ativo.</output><pre id="log"></pre></section>`;
  document.documentElement.appendChild(host);
  const ui = id => root.getElementById(id);
  let timer = null, pendente = null, removido = false, config = null, selecionando = null, preparacao = null, navegacaoInicial = true;
  const linhas = [];
  function status(msg) {
    ui('status').textContent = `${timer ? 'Ativo' : 'Pausado'} • ${msg}`;
    if (linhas[0] && linhas[0].endsWith(msg)) return;
    linhas.unshift(`${new Date().toLocaleTimeString()} ${msg}`);
    linhas.length = Math.min(linhas.length, 35);
    ui('log').textContent = linhas.join('\n');
  }
  function lerConfig() {
    const c = { criatura: ui('criatura').value.trim(), modo: ui('modo').value, atacar: percentual(ui('atacar').value, 'Vida para atacar'), limite: percentual(ui('limite').value, 'Limite da restauradora'), limiteAlivio: percentual(ui('limiteAlivio').value, 'Limite da poção de alívio'), economizar: ui('economizar').checked, margem: percentual(ui('margem').value, 'Margem de economia') };
    if (!c.criatura) throw Error('Informe o nome exato da criatura.');
    if (c.atacar < 30) throw Error('A tela fornecida exige pelo menos 30% para caçar.');
    if (c.limiteAlivio < c.limite) throw Error('O limite de alívio deve ser igual ou maior que o limite da restauradora.');
    return c;
  }
  function pausar(msg = 'Pausado pelo jogador.') {
    navegacaoInicial = false;
    preparacao?.responderExpedicao?.(false);
    preparacao = null;
    clearInterval(timer); timer = null; ui('iniciar').disabled = false; status(msg);
    // Preserva ação pendente: pausar/retomar não autoriza repetir um clique sem confirmação.
  }
  function diagnostico() {
    const c = lerConfig(), hp = lerVida(), criatura = localizarCriatura(c.criatura);
    const d = { vida: hp, decisao: hp === null ? 'vida não identificada' : decidir(c, hp), modalidadeResultado: { controle: resumo(botaoSoResultado()), confirmada: modoResultadoConfirmado(botaoSoResultado()) }, criatura: resumo(criatura), ataque: resumo(botaoAtacar()), alivio: resumo(botaoPocao('alivio')), restauradora: resumo(botaoPocao('restauradora')), resultadoAberto: !!resultado(), pendente: pendente && pendente.tipo, configuracao: c };
    console.info('Diagnóstico Auren (nenhum clique):', d);
    status(JSON.stringify(d, null, 2)); return d;
  }
  function ciclo() {
    if (!timer || removido) return;
    try {
      if (window.aurenAvisos?.verificar()) return;
      const hp = lerVida(), r = resultado(), agora = Date.now();
      if (r && (!pendente || pendente.tipo === 'ataque')) {
        const btn = fecharResultado(r);
        if (!btn) return pausar('Resultado detectado, mas o botão Continuar não foi identificado de forma única.');
        if (clicar(btn)) {
          pendente = { tipo: 'fechamento', inicio: agora };
          selecionando = null;
          status('Continuar acionado. Aguardando o resultado fechar para retomar a caçada.');
        } else status('Aguardando o botão Continuar ficar disponível.');
        return;
      }
      if (pendente) {
        if (pendente.tipo === 'fechamento' && !r) {
          pendente = null; status('Resultado fechado. Retomando o ciclo e reavaliando a vida.');
        } else if (['alivio', 'restauradora'].includes(pendente.tipo) && hp !== null && hp > pendente.hp) {
          // Aumento de vida pode ser regeneração; exige aumento compatível com a poção.
          const esperado = pendente.tipo === 'alivio' ? Math.min(100, pendente.hp + 40) : 100;
          if (hp >= esperado - 0.01) { pendente = null; status('Recuperação observada; reavaliando no próximo ciclo.'); }
        }
        if (pendente && agora - pendente.inicio > 45000) pausar('Sem confirmação da última ação em 45s. Confira o jogo antes de retomar.');
        return;
      }
      if (hp === null) return pausar('Não foi possível identificar a vida. Use Diagnóstico.');
      const acao = decidir(config, hp);
      if (acao === 'pausar') return pausar('Personagem sem vida. Confira o jogo.');
      if (acao === 'regenerar') { status(`Vida ${hp.toFixed(2)}%. Aguardando regeneração até ${config.atacar}%.`); return; }
      if (acao === 'atacar') {
        const criatura = localizarCriatura(config.criatura);
        if (!criatura) return pausar('Criatura não encontrada de forma única. Confira o nome e a região aberta.');
        if (!selecionada(criatura)) {
          if (selecionando && selecionando.nome === config.criatura) {
            if (agora - selecionando.inicio > 8000) pausar('Seleção da criatura não confirmada. Use Diagnóstico para ajustar o seletor.');
            return;
          }
          const btn = criatura.matches('button,[role="button"]') ? criatura : unico(todos('button,[role="button"]', criatura));
          if (!clicar(btn)) return pausar('Card da criatura não tem um controle de seleção inequívoco.');
          selecionando = { nome: config.criatura, inicio: agora }; status('Selecionando criatura; aguardando confirmação visual.'); return;
        }
        selecionando = null;
        const btn = botaoAtacar();
        if (!clicar(btn)) return pausar('Botão de caçada ausente, ambíguo ou desabilitado.');
        pendente = { tipo: 'ataque', inicio: agora, hp }; status(`Caçada acionada: ${config.criatura}. Aguardando resultado.`); return;
      }
      const btn = botaoPocao(acao);
      if (!btn) { status(`Poção ${acao} não identificada de forma única; aguardando regeneração. Confira Diagnóstico.`); return; }
      if (!habilitado(btn)) { status(`Poção ${acao} indisponível; aguardando regeneração.`); return; }
      if (clicar(btn)) { pendente = { tipo: acao, inicio: agora, hp }; status(`Poção ${acao} acionada; aguardando confirmação da vida.`); }
    } catch (e) { pausar(`Erro: ${e.message}`); }
  }
  async function iniciar() {
    if (timer || preparacao || removido) return;
    navegacaoInicial = false;
    const token = {};
    try {
      config = lerConfig();
      if (pendente && Date.now() - pendente.inicio > 45000 && !(pendente.tipo === 'ataque' && resultado())) throw Error('Ação anterior sem confirmação. Confira o jogo e recarregue a página antes de reiniciar.');
      preparacao = token;
      ui('iniciar').disabled = true;
      status('Preparando a caçada.');
      if (!(await navegarCacada(() => preparacao === token && !removido))) return;
      if (preparacao !== token) return;
      if (!(await prepararExpedicao(token))) return;
      if (preparacao !== token) return;
      if (!(await prepararModalidade(token))) return;
      if (preparacao !== token) return;
      preparacao = null;
      timer = setInterval(ciclo, 2200); ui('iniciar').disabled = true; status('Iniciado. Lendo a tela de Caçada.');
    } catch (e) {
      if (preparacao === token) pausar(e.message);
      else if (!timer && !preparacao) status(e.message);
    }
  }
  function fechar() { pausar('Painel ocultado; automação pausada.'); host.hidden = true; }
  const api = { iniciar, pausar, fechar, diagnostico, decidir, seletores };
  window.aurenCacada = api;
  ui('iniciar').onclick = iniciar; ui('pausar').onclick = () => pausar(); ui('fechar').onclick = fechar;
  ui('diagnostico').onclick = () => { pausar(); try { diagnostico(); } catch (e) { status(e.message); } };
  const campos = ['criatura', 'modo', 'atacar', 'limite', 'limiteAlivio', 'economizar', 'margem'];
  for (const id of campos) {
    const campo = ui(id), valor = preferencias[id];
    if (campo.type === 'checkbox') { if (typeof valor === 'boolean') campo.checked = valor; }
    else if (typeof valor === 'string' && (id !== 'modo' || ['pocao', 'natural'].includes(valor))) campo.value = valor;
  }
  // Serializa as gravações para uma edição mais antiga não sobrescrever a última.
  let gravacao = Promise.resolve();
  function salvar() {
    const valores = Object.fromEntries(campos.map(id => [id, ui(id).type === 'checkbox' ? ui(id).checked : ui(id).value]));
    gravacao = gravacao.then(() => chrome.storage.local.set({ aurenPreferenciasV33: valores })).catch(() => {
      status('Não foi possível salvar as configurações. Elas continuam válidas nesta página.');
    });
  }
  root.querySelectorAll('input,select').forEach(el => el.addEventListener('input', () => {
    selecionando = null; pausar('Configuração alterada. Clique em Iniciar para aplicar.'); salvar();
  }));
  chrome.runtime.onMessage.addListener((msg, sender, responder) => {
    if (sender.id !== chrome.runtime.id || !msg || msg.origem !== 'auren-popup-v33') return;
    if (msg.comando === 'abrir') {
      host.hidden = false;
      responder({ ok: true, mensagem: 'Painel aberto. Use Iniciar no painel para executar.' });
    } else if (msg.comando === 'pausar') {
      pausar('Pausado pelo botão da extensão.');
      responder({ ok: true, mensagem: 'Automação pausada nesta aba.' });
    }
  });
  if (erroArmazenamento) status('Não foi possível carregar as configurações salvas. Usando valores iniciais.');
  document.addEventListener('visibilitychange', function oculto() {
    if (removido) { document.removeEventListener('visibilitychange', oculto); return; }
    if (document.hidden && timer) pausar('Aba oculta. Retome ao voltar ao jogo.');
  });
  console.info('Auren v3.3.4 instalado. Caçada pausada; fechamento de avisos ativo. API: window.aurenCacada. Comece pelo botão Diagnóstico.');
  // Uma navegação inicial, sem observador que mantenha o usuário nesta tela.
  navegarCacada(() => navegacaoInicial && !removido).catch(error => {
    if (navegacaoInicial && !timer && !preparacao) status(error.message);
  }).finally(() => { navegacaoInicial = false; });
})().catch(error => console.error('Não foi possível carregar a extensão Auren:', error));

