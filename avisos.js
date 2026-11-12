(() => {
  'use strict';
  // Inicia em document_start, independentemente do painel e da caçada.
  if (window.aurenAvisos) return;
  const normal = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const visivel = el => el.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';
  const habilitado = el => visivel(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true' && el.getAttribute('aria-busy') !== 'true';
  const tentativas = new Map();
  let ativo = true, agendado = false, verificando = false, total = 0;
  let inicioVerificacao = null, tempoVerificacao = 0, verificacaoHumana = false;
  let seloPronto = false;

  function localizarVerificacaoHumana() {
    const titulos = [...document.querySelectorAll('h1,h2,h3,h4,[role="heading"]')]
      .filter(el => visivel(el) && normal(el.textContent) === 'a guarda pede um sinal');
    if (!titulos.length) return null;
    const paineis = [...new Set(titulos.map(titulo => {
      const dialogo = titulo.closest('dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"]');
      if (dialogo) return dialogo;
      let painel = titulo.parentElement;
      for (let nivel = 0; painel && nivel < 6 && painel !== document.body && painel !== document.documentElement; nivel++, painel = painel.parentElement) {
        if (painel.querySelector('iframe[src*="challenges.cloudflare.com"], .cf-turnstile, input[name="cf-turnstile-response"], button')) return painel;
      }
      return titulo.parentElement;
    }))];
    if (paineis.length !== 1) return { painel: null, botao: null };
    const painel = paineis[0];
    const botoes = [...painel.querySelectorAll('button, [role="button"]')]
      .filter(botao => visivel(botao) && /^apresentar (?:o )?selo$/.test(normal(botao.getAttribute('aria-label') || botao.textContent)));
    return { painel, botao: botoes.length === 1 ? botoes[0] : null };
  }
  function registrarVerificacao(presente) {
    if (presente && inicioVerificacao === null) inicioVerificacao = Date.now();
    if (!presente && inicioVerificacao !== null) {
      tempoVerificacao += Math.max(0, Date.now() - inicioVerificacao);
      inicioVerificacao = null;
    }
    verificacaoHumana = presente;
    if (!presente) seloPronto = false;
  }

  function avisosAtualizacao() {
    const candidatos = [];
    for (const botao of document.querySelectorAll('button, [role="button"]')) {
      if (!visivel(botao) || normal(botao.textContent) !== 'atualizar') continue;
      let painel = botao.parentElement;
      for (let nivel = 0; painel && nivel < 8 && painel !== document.body && painel !== document.documentElement; nivel++, painel = painel.parentElement) {
        const t = normal(painel.textContent);
        if (t.length > 1200) break;
        if (!t.includes('nova versao disponivel') || !t.includes('auren online foi atualizado') || !t.includes('recarregue para continuar')) continue;
        const botoes = [...painel.querySelectorAll('button, [role="button"]')].filter(b => visivel(b) && normal(b.textContent) === 'atualizar');
        if (botoes.length === 1) candidatos.push({ painel, botao, atualizacao: true });
        break;
      }
    }
    return candidatos;
  }

  function avisosCheckin() {
    const candidatos = [];
    const tituloCheckin = /^check[-\s\u2010-\u2015]*in diario$/;
    const rotuloFechar = /^(?:fechar|close)(?: (?:o )?(?:painel|check[-\s\u2010-\u2015]*in(?: diario)?))?$|^[×✕✖x]$/;
    // O check-in pode ser um painel sem role de diálogo. Exige o título e o texto próprio dele.
    const titulos = [...document.querySelectorAll('h1,h2,h3,h4,[role="heading"],div,span')]
      .filter(el => visivel(el) && tituloCheckin.test(normal(el.textContent)));
    for (const titulo of titulos) {
      let painel = titulo.parentElement;
      for (let nivel = 0; painel && nivel < 8 && painel !== document.body && painel !== document.documentElement; nivel++, painel = painel.parentElement) {
        const t = normal(painel.textContent);
        if (!/registrar o check[-\s\u2010-\u2015]*in de hoje|recompensa de hoje|dias recebidos/.test(t)) continue;
        const fechar = [...painel.querySelectorAll('button, [role="button"]')].filter(botao => {
          if (!visivel(botao)) return false;
          const rotulos = [botao.getAttribute('aria-label'), botao.getAttribute('title'), botao.textContent].map(normal).filter(Boolean);
          if (rotulos.some(rotulo => rotuloFechar.test(rotulo))) return true;
          // Um ícone X sem texto também é aceito, somente dentro do painel identificado.
          return rotulos.length === 0 && !!botao.querySelector('svg.lucide-x, [data-lucide="x"], svg[data-icon="x"]');
        });
        if (fechar.length === 1 && !candidatos.some(c => c.botao === fechar[0])) candidatos.push({ painel, botao: fechar[0] });
        // Ao chegar aos controles do painel, não procura um X em contêineres externos.
        if (painel.querySelector('button, [role="button"]')) break;
      }
    }
    return candidatos;
  }

  function verificar() {
    if (!ativo || verificando) return false;
    verificando = true;
    try {
      const selo = localizarVerificacaoHumana();
      registrarVerificacao(!!selo);
      if (selo) {
        // O jogo exige um clique manual confiável para apresentar o selo.
        seloPronto = !!selo.botao && habilitado(selo.botao);
        return true; // Nenhum aviso ou ação por trás da verificação pode ser acionado.
      }
      for (const [painel] of tentativas) if (!visivel(painel)) tentativas.delete(painel);
      const paineis = [...document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"], .modal, .toast, [role="alert"]')].filter(visivel);
      const candidatos = [...avisosAtualizacao(), ...avisosCheckin()];
      for (const painel of paineis) {
        const t = normal(painel.textContent);
        // A confirmação de um ataque pertence exclusivamente ao ciclo da caçada.
        if (/cacada concluida/.test(t) && !/arena livre/.test(t)) continue;
        const botoes = [...painel.querySelectorAll('button, [role="button"]')].filter(visivel);
        const continuar = botoes.filter(b => b.matches('.activity-result-continue'));
        if (painel.matches('.activity-result-dialog') && continuar.length === 1) {
          candidatos.push({ painel, botao: continuar[0] });
          continue;
        }
        const fechar = botoes.filter(b => {
          const nome = normal(b.getAttribute('aria-label') || b.getAttribute('title') || b.textContent);
          return /^(fechar|fechar aviso|fechar janela|fechar resultado|close|dismiss|dispensar|entendi|entendido|ok|×|✕|✖|x)[\s✓✔.!]*$/.test(nome);
        });
        if (fechar.length === 1) candidatos.push({ painel, botao: fechar[0] });
      }
      // Alguns tutoriais usam cartões inline, sem semântica de diálogo.
      for (const botao of document.querySelectorAll('button')) {
        if (visivel(botao) && /^entendi[\s✓✔.!]*$/.test(normal(botao.textContent)) &&
            !candidatos.some(c => c.botao === botao)) {
          candidatos.push({ painel: botao, botao });
        }
      }
      const unicos = candidatos.filter((c, i) => candidatos.findIndex(outro => outro.botao === c.botao) === i);
      for (const { painel, botao, atualizacao } of unicos) {
        const anterior = tentativas.get(painel) || { n: 0, quando: 0 };
        if (atualizacao && anterior.n >= 1) continue;
        if (!habilitado(botao) || anterior.n >= 3 || Date.now() - anterior.quando < 1500) continue;
        // Registra antes do clique: uma nova verificação não pode duplicar a ação.
        tentativas.set(painel, { n: anterior.n + 1, quando: Date.now() });
        if (atualizacao) window.aurenCacada?.prepararAtualizacao();
        botao.click();
        total++;
        console.info('[Auren avisos] Fechamento acionado:', botao);
        break; // Reavalia o DOM antes de agir sobre outra janela.
      }
      // Impede a caçada de clicar por trás de um aviso ainda em fechamento.
      return candidatos.length > 0;
    } catch (error) {
      console.error('[Auren avisos] Falha ao verificar avisos:', error);
      return true;
    } finally {
      verificando = false;
    }
  }

  const observer = new MutationObserver(() => {
    if (agendado || !ativo) return;
    agendado = true;
    queueMicrotask(() => { agendado = false; verificar(); });
  });
  observer.observe(document, {
    subtree: true, childList: true, characterData: true,
    attributes: true,
    attributeFilter: ['open', 'class', 'style', 'hidden', 'disabled', 'aria-hidden', 'aria-disabled', 'aria-busy', 'aria-label', 'title']
  });
  const timer = setInterval(verificar, 700);
  window.aurenAvisos = {
    verificar,
    parar() { ativo = false; observer.disconnect(); clearInterval(timer); tentativas.clear(); registrarVerificacao(false); },
    get verificacaoHumana() { return verificacaoHumana; },
    get seloPronto() { return seloPronto; },
    get tempoVerificacaoHumana() { return tempoVerificacao + (inicioVerificacao === null ? 0 : Math.max(0, Date.now() - inicioVerificacao)); },
    get fechamentos() { return total; }
  };
  verificar();
  console.info('[Auren avisos] Ativo desde o carregamento, mesmo com a caçada pausada.');
})();
