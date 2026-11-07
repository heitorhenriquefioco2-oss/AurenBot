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
  function percentual(valor, campo) {
    const texto = String(valor ?? '').trim().replace(/\s*%\s*$/, '').trim();
    if (!/^\d+(?:[.,]\d+)?$/.test(texto)) {
      throw Error(`${campo}: use um número entre 0 e 100. Por exemplo, 80 ou 80,5.`);
    }
    const n = Number(texto.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 100) throw Error(`${campo}: escolha um valor de 0 a 100.`);
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
    const inicio = Date.now();
    let clicado = false;
    while (valido()) {
      if (telaCacada()) return true;
      if (Date.now() - inicio > prazo) throw Error('Não consegui abrir a Caçada. Clique em Caçada no menu esquerdo e tente de novo.');
      if (!window.aurenAvisos?.verificar() && !clicado) {
        const botao = menuCacada();
        if (botao && clicar(botao)) {
          clicado = true;
          reportar('Abrindo a Caçada. Só um instante…');
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
    status('Sua expedição está em andamento. Você quer pausá-la para caçar?');
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
      if (preparacao === token) pausar('Tudo bem! A expedição continua e a caçada não foi iniciada.');
      return false;
    }
    if (preparacao !== token) return false;
    const inicio = Date.now();
    let clicouOrigem = false, clicouNaExpedicao = false;
    while (preparacao === token && !removido) {
      if (Date.now() - inicio > 8000) throw Error('O jogo ainda não confirmou a pausa da expedição. Confira se ela foi pausada antes de tentar de novo.');
      if (!window.aurenAvisos?.verificar()) {
        const expedicao = estadoExpedicao();
        if (!expedicao.ativa && (telaCacada() || (telaExpedicao() && (expedicao.pausada || clicouNaExpedicao)))) {
          if (!(await navegarCacada(() => preparacao === token && !removido))) return false;
          if (estadoExpedicao().ativa) throw Error('A expedição ainda está em andamento. Pause-a no jogo antes de começar a caçada.');
          return true;
        }
        const naExpedicao = telaExpedicao();
        // Na Caçada, o primeiro botão pode apenas abrir Expedição.
        // A autorização cobre a pausa no destino, uma única vez em cada tela.
        const podeClicar = naExpedicao ? !clicouNaExpedicao : !clicouOrigem;
        if (podeClicar && expedicao.botao && clicar(expedicao.botao)) {
          if (naExpedicao) clicouNaExpedicao = true;
          else clicouOrigem = true;
          status(naExpedicao ? 'Pedi para pausar a expedição. Aguardando a resposta do jogo…' : 'Abrindo a expedição para concluir a pausa…');
        }
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return false;
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
    const inicio = Date.now();
    let clicado = false;
    while (preparacao === token && !removido) {
      if (Date.now() - inicio > 8000) throw Error('Não consegui selecionar Só o resultado. Confira essa opção na tela de Caçada e tente de novo.');
      if (!window.aurenAvisos?.verificar()) {
        const botao = botaoSoResultado();
        if (botao && modoResultadoConfirmado(botao)) return true;
        if (botao && !clicado && clicar(botao)) {
          clicado = true;
          status('Selecionando Só o resultado para agilizar suas caçadas…');
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

  // A navegação inicial termina antes de criar/exibir a interface do bot.
  let erroNavegacaoInicial = '';
  try {
    await navegarCacada(() => true, msg => console.info('[Auren início]', msg), 15000);
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
    </style><section><header id="moverPainel" title="Arraste para mover o painel"><h2>Auren • Seu assistente de caçada v3.3.14</h2><small>Arraste este título para mover o painel.</small></header>
    <p>Escolha a criatura e como cuidar da vida do seu herói. Quando estiver pronto, clique em Iniciar. Se houver uma expedição em andamento, vamos pedir sua permissão para pausá-la.</p>
    <label>Qual criatura você quer caçar?<input id="criatura" placeholder="Ex.: Corvo do eclipse" maxlength="100"></label>
    <small>Copie o nome como aparece no jogo e deixe a região dessa criatura aberta.</small>
    <label>Como recuperar a vida?<select id="modo"><option value="pocao">Usar poções quando precisar</option><option value="natural">Esperar a vida recuperar sozinha</option></select></label>
    <div class="grid"><label>Caçar com pelo menos (%)<input id="atacar" type="text" inputmode="decimal" value="80"></label><label>Usar restauradora com até (%)<input id="limite" type="text" inputmode="decimal" value="30"></label></div>
    <label>Usar poção de alívio com até (%)<input id="limiteAlivio" type="text" inputmode="decimal" value="70"></label>
    <small>No modo com poções, usa a restauradora com pouca vida. Acima do limite dela, usa alívio até o limite escolhido. Depois disso, espera a vida recuperar. Ao atingir a vida mínima para caçar, volta ao combate.</small>
    <label><input id="economizar" type="checkbox" checked> Esperar um pouco para economizar poções</label>
    <label>Esperar se faltar até (%)<input id="margem" type="text" inputmode="decimal" value="5"></label>
    <small>Exemplo: para caçar com 80%, esperar 5 significa aguardar a vida subir de 75% para 80%, sem gastar poção. Essa espera tem prioridade sobre o uso de poções. Se a poção não estiver disponível, o bot também espera.</small>
    <label><input id="continuarOculta" type="checkbox" aria-describedby="ajudaContinuarOculta"> Continuar quando a aba estiver oculta</label>
    <small id="ajudaContinuarOculta">Útil em VPS ao desconectar o RDP. Mantenha o jogo e o Chrome abertos. O navegador pode reduzir a frequência dos ciclos em segundo plano.</small>
    <label><input id="reiniciarAutomaticamente" type="checkbox" aria-describedby="ajudaReinicio">Reiniciar automaticamente após uma parada por erro</label>
    <small id="ajudaReinicio">Após clicar em Iniciar, verifica a cada 10 segundos se já pode retomar. Pausar, Ocultar painel e alterar configurações cancelam o reinício. Aguarda vida válida e confirmação das ações pendentes.</small>
    <nav><button id="diagnostico">Conferir jogo</button><button id="iniciar">Iniciar</button><button id="pausar">Pausar</button><button id="fechar">Ocultar painel</button></nav>
    <small>Ocultar o painel também pausa a caçada. Para abrir de novo, clique no ícone da extensão. Os avisos reconhecidos continuam sendo fechados mesmo com a caçada pausada.</small>
    <div id="confirmacaoExpedicao" role="dialog" aria-modal="true" aria-label="Expedição ativa" hidden>
      <p>Seu herói está em uma expedição e não pode caçar ao mesmo tempo. Quer pausá-la para começar a caçada? O bot não vai retomar a expedição por conta própria.</p>
      <nav><button id="aceitarExpedicao">Sim, pausar e começar a caçar</button><button id="cancelarExpedicao">Não, manter a expedição</button></nav>
    </div>
    <output id="status" aria-live="polite">Tudo pronto para configurar. A caçada só começa quando você clicar em Iniciar.</output><pre id="log"></pre></section>`;
  document.documentElement.appendChild(host);
  const estiloPopup = document.createElement('style');
  estiloPopup.textContent = '#confirmacaoExpedicao:not([hidden]){position:fixed;top:30vh;left:50%;transform:translateX(-50%);width:min(420px,calc(100vw - 32px));padding:20px;background:#141d24;border:1px solid #b99b60;border-radius:10px;box-shadow:0 0 0 100vmax #0009;z-index:1}';
  root.appendChild(estiloPopup);
  const ui = id => root.getElementById(id);
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
    if (!event.isPrimary || event.button !== 0 || !ui('confirmacaoExpedicao').hidden) return;
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
  const linhas = [];
  function status(msg) {
    ui('status').textContent = `${timer ? 'Ativo' : 'Pausado'} • ${msg}`;
    if (linhas[0] && linhas[0].endsWith(msg)) return;
    linhas.unshift(`${new Date().toLocaleTimeString()} ${msg}`);
    linhas.length = Math.min(linhas.length, 35);
    ui('log').textContent = linhas.join('\n');
  }
  function lerConfig() {
    const c = { criatura: ui('criatura').value.trim(), modo: ui('modo').value, atacar: percentual(ui('atacar').value, 'Vida para atacar'), limite: percentual(ui('limite').value, 'Limite da restauradora'), limiteAlivio: percentual(ui('limiteAlivio').value, 'Limite da poção de alívio'), economizar: ui('economizar').checked, margem: percentual(ui('margem').value, 'Margem de economia'), continuarOculta: ui('continuarOculta').checked, reiniciarAutomaticamente: ui('reiniciarAutomaticamente').checked };
    if (!c.criatura) throw Error('Informe o nome exato da criatura.');
    if (c.atacar < 30) throw Error('Escolha pelo menos 30% de vida para começar a caçar.');
    if (c.limiteAlivio < c.limite) throw Error('O limite da poção de alívio precisa ser igual ou maior que o da restauradora.');
    return c;
  }
  function pausar(msg = 'Você pausou a caçada. Clique em Iniciar quando quiser continuar.', automatica = false) {
    const retomar = automatica && reinicioArmado && config?.reiniciarAutomaticamente;
    clearTimeout(timerReinicio); timerReinicio = null;
    if (!retomar) reinicioArmado = false;
    try { sessionStorage.removeItem('aurenRetomadaAtualizacaoV1'); } catch {}
    preparacao?.responderExpedicao?.(false);
    preparacao = null;
    clearInterval(timer); timer = null; ui('iniciar').disabled = false;
    if (retomar) agendarReinicio(msg);
    else status(msg);
    // Preserva ação pendente: pausar/retomar não autoriza repetir um clique sem confirmação.
  }
  function agendarReinicio(msg) {
    if (!reinicioArmado || removido || host.hidden || !config?.reiniciarAutomaticamente) return;
    clearTimeout(timerReinicio);
    status(`${msg} Reinício automático: nova verificação em 10 segundos.`);
    timerReinicio = setTimeout(tentarReinicio, 10000);
  }
  function confirmarAcaoPendente(hp, r) {
    if (!pendente) return true;
    // Um resultado permite retomar o acompanhamento do ataque, sem autorizar outro ataque.
    if (pendente.tipo === 'ataque') return !!r;
    if (pendente.tipo === 'fechamento' && !r) { pendente = null; return true; }
    if (['alivio', 'restauradora'].includes(pendente.tipo) && hp !== null && hp > pendente.hp) {
      const esperado = pendente.tipo === 'alivio' ? Math.min(100, pendente.hp + 40) : 100;
      if (hp >= esperado - 0.01) { pendente = null; return true; }
    }
    return false;
  }
  async function tentarReinicio() {
    timerReinicio = null;
    if (!reinicioArmado || timer || preparacao || removido || host.hidden) return;
    try {
      if (document.hidden && !config.continuarOculta) return agendarReinicio('Aguardando a aba do jogo ficar visível.');
      const hp = lerVida(), r = resultado();
      if (hp === null || hp <= 0) return agendarReinicio('Aguardando uma leitura válida de vida acima de zero.');
      if (!confirmarAcaoPendente(hp, r)) return agendarReinicio('Aguardando o jogo confirmar a última ação, sem repetir cliques.');
      if (estadoExpedicao().ativa) return agendarReinicio('Há uma expedição ativa. Aguardando ela terminar ou ser pausada no jogo.');
      selecionando = null;
      await iniciar(true);
    } catch (e) { agendarReinicio(`Não consegui retomar: ${e.message}`); }
  }
  function diagnostico() {
    const c = lerConfig(), hp = lerVida(), criatura = localizarCriatura(c.criatura);
    const d = { vida: hp, decisao: hp === null ? 'vida não identificada' : decidir(c, hp), modalidadeResultado: { controle: resumo(botaoSoResultado()), confirmada: modoResultadoConfirmado(botaoSoResultado()) }, criatura: resumo(criatura), ataque: resumo(botaoAtacar()), alivio: resumo(botaoPocao('alivio')), restauradora: resumo(botaoPocao('restauradora')), resultadoAberto: !!resultado(), pendente: pendente && pendente.tipo, configuracao: c };
    console.info('Diagnóstico Auren (nenhum clique):', d);
    const encontrado = el => el ? (habilitado(el) ? 'disponível' : 'encontrado, mas ainda indisponível') : 'não encontrado';
    status([
      'Confira antes de começar:',
      hp === null ? 'Vida: não consegui ler a vida do herói.' : `Vida atual: ${hp.toFixed(2)}%.`,
      `Criatura: ${c.criatura} — ${criatura ? 'encontrada' : 'confira o nome e a região aberta'}.`,
      `Só o resultado: ${d.modalidadeResultado.confirmada ? 'já selecionado' : 'será selecionado ao clicar em Iniciar'}.`,
      `Botão para caçar: ${encontrado(botaoAtacar())}.`,
      `Poção de alívio: ${encontrado(botaoPocao('alivio'))}.`,
      `Poção restauradora: ${encontrado(botaoPocao('restauradora'))}.`,
      pendente ? 'Ainda estou aguardando o jogo confirmar a última ação.' : 'Nenhuma ação de caçada foi feita nesta conferência.'
    ].join('\n')); return d;
  }
  function ciclo() {
    if (!timer || removido) return;
    try {
      if (window.aurenAvisos?.verificar()) return;
      const hp = lerVida(), r = resultado(), agora = Date.now();
      if (r && (!pendente || pendente.tipo === 'ataque')) {
        const btn = fecharResultado(r);
        if (!btn) return pausar('A caçada terminou, mas não consegui encontrar o botão Continuar com segurança. Feche o resultado no jogo e tente de novo.', true);
        if (clicar(btn)) {
          pendente = { tipo: 'fechamento', inicio: agora };
          selecionando = null;
          status('Fechando o resultado para continuar caçando…');
        } else status('Aguardando o jogo liberar o botão Continuar…');
        return;
      }
      if (pendente) {
        const tipo = pendente.tipo;
        if (confirmarAcaoPendente(hp, r)) {
          status(tipo === 'fechamento' ? 'Resultado fechado! Conferindo a vida antes da próxima caçada.' : 'A vida recuperou. Vou conferir se já dá para caçar.');
        }
        if (pendente && agora - pendente.inicio > 45000) pausar('O jogo demorou a responder. Pausei a caçada para evitar repetir uma ação. Confira o jogo antes de continuar.', true);
        return;
      }
      // Uma renderização temporária não deve desligar o ciclo. Só decide com uma leitura atual válida.
      if (hp === null) {
        status('Não consegui ler a vida do herói. Aguardando a leitura voltar para retomar automaticamente, sem atacar nem usar poções.');
        return;
      }
      const acao = decidir(config, hp);
      if (acao === 'pausar') return pausar('Seu herói está sem vida. Cuide dele no jogo antes de continuar.', true);
      if (acao === 'regenerar') { status(`Sua vida está em ${hp.toFixed(2)}%. Vou esperar chegar a ${config.atacar}% para caçar.`); return; }
      if (acao === 'atacar') {
        const criatura = localizarCriatura(config.criatura);
        if (!criatura) return pausar('Não consegui identificar a criatura com segurança. Confira o nome e deixe a região dela aberta.', true);
        if (!selecionada(criatura)) {
          if (selecionando && selecionando.nome === config.criatura) {
            if (agora - selecionando.inicio > 8000) pausar('O jogo não confirmou a criatura escolhida. Selecione-a no jogo e use Conferir jogo.', true);
            return;
          }
          const btn = criatura.matches('button,[role="button"]') ? criatura : unico(todos('button,[role="button"]', criatura));
          if (!clicar(btn)) return pausar('Não consegui selecionar essa criatura. Clique nela no jogo e tente de novo.', true);
          selecionando = { nome: config.criatura, inicio: agora }; status('Escolhendo a criatura. Aguardando o jogo confirmar…'); return;
        }
        selecionando = null;
        const btn = botaoAtacar();
        if (!clicar(btn)) return pausar('Não consegui usar o botão de caçar. Confira se a criatura está selecionada e se o jogo permite iniciar a caçada.', true);
        pendente = { tipo: 'ataque', inicio: agora, hp }; status(`Caçando ${config.criatura}. Aguardando o resultado…`); return;
      }
      const btn = botaoPocao(acao);
      if (!btn) { status(`Não consegui encontrar a poção ${acao === 'alivio' ? 'de alívio' : 'restauradora'} com segurança. Vou esperar a vida recuperar. Você pode usar Conferir jogo.`); return; }
      if (!habilitado(btn)) { status(`A poção ${acao === 'alivio' ? 'de alívio' : 'restauradora'} não está disponível. Vou esperar a vida recuperar.`); return; }
      if (clicar(btn)) { pendente = { tipo: acao, inicio: agora, hp }; status(`Usando a poção ${acao === 'alivio' ? 'de alívio' : 'restauradora'}. Aguardando a vida recuperar…`); }
    } catch (e) { pausar(`Erro: ${e.message}`, true); }
  }
  async function iniciar(automatico = false) {
    if (timer || preparacao || removido) return;
    clearTimeout(timerReinicio); timerReinicio = null;
    if (!automatico) reinicioArmado = false;
    const token = {};
    try {
      preparacao = token;
      if (pendente && Date.now() - pendente.inicio > 45000 && !(pendente.tipo === 'ataque' && resultado())) throw Error('O jogo não confirmou a última ação. Confira o que aconteceu e recarregue a página antes de tentar de novo.');
      ui('iniciar').disabled = true;
      status('Preparando a caçada.');
      if (!(await navegarCacada(() => preparacao === token && !removido))) return;
      if (preparacao !== token) return;
      if (!(await prepararModalidade(token))) return;
      if (preparacao !== token) return;
      // Não pausa uma expedição se ainda faltam configurações para caçar.
      config = lerConfig();
      if (!(await prepararExpedicao(token))) return;
      if (preparacao !== token) return;
      if (!(await prepararModalidade(token))) return;
      if (preparacao !== token) return;
      preparacao = null;
      reinicioArmado = config.reiniciarAutomaticamente;
      timer = setInterval(ciclo, 2200); ui('iniciar').disabled = true; status('Caçada iniciada! Vou cuidar dos combates e da recuperação de vida conforme suas escolhas.');
    } catch (e) {
      if (preparacao === token) pausar(e.message, automatico);
      else if (!timer && !preparacao) status(e.message);
    }
  }
  function fechar() { pausar('Painel oculto e caçada pausada. Clique no ícone da extensão para abrir o painel de novo.'); host.hidden = true; }
  function prepararAtualizacao() {
    if (!timer || !config) return;
    try {
      sessionStorage.setItem('aurenRetomadaAtualizacaoV1', JSON.stringify({
        versao: 1, criadoEm: Date.now(), config,
        pendente: pendente ? { ...pendente } : null
      }));
      clearInterval(timer); timer = null;
      status('O jogo vai atualizar. Vou retomar sua caçada assim que a página carregar.');
    } catch {
      console.warn('Não foi possível salvar a retomada. Após atualizar o jogo, clique em Iniciar.');
    }
  }
  const api = { iniciar, pausar, fechar, diagnostico, decidir, seletores, prepararAtualizacao };
  window.aurenCacada = api;
  ui('iniciar').onclick = () => iniciar(); ui('pausar').onclick = () => pausar(); ui('fechar').onclick = fechar;
  ui('diagnostico').onclick = () => { pausar(); try { diagnostico(); } catch (e) { status(e.message); } };
  const campos = ['criatura', 'modo', 'atacar', 'limite', 'limiteAlivio', 'economizar', 'margem', 'continuarOculta', 'reiniciarAutomaticamente'];
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
      status('Não consegui salvar suas escolhas para a próxima visita. Você ainda pode usá-las nesta página.');
    });
  }
  root.querySelectorAll('input,select').forEach(el => el.addEventListener('input', () => {
    selecionando = null; pausar('Suas escolhas foram atualizadas. Clique em Iniciar para usá-las.'); salvar();
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
      pausar('Pausado pelo botão da extensão.');
      responder({ ok: true, mensagem: 'Automação pausada nesta aba.' });
    }
  });
  if (erroArmazenamento) status('Não consegui recuperar suas escolhas salvas. Confira os valores do painel antes de começar.');
  if (erroNavegacaoInicial) status(erroNavegacaoInicial);
  document.addEventListener('visibilitychange', function oculto() {
    if (removido) { document.removeEventListener('visibilitychange', oculto); return; }
    if (document.hidden && timer && !config.continuarOculta) pausar('A aba do jogo ficou oculta, então pausei a caçada. Ao voltar, clique em Iniciar para continuar.');
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
      const anterior = retomada.pendente;
      if (anterior && ['ataque', 'fechamento', 'alivio', 'restauradora'].includes(anterior.tipo) && Number.isFinite(anterior.inicio)) pendente = anterior;
      status('Jogo atualizado. Retomando sua caçada com as mesmas escolhas…');
      iniciar();
    }
  } catch { status('Não consegui recuperar a caçada anterior. Confira suas escolhas e clique em Iniciar.'); }
})().catch(error => console.error('Não foi possível carregar a extensão Auren:', error));

