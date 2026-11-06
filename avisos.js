(() => {
  'use strict';
  // Inicia em document_start, independentemente do painel e da caçada.
  if (window.aurenAvisos) return;
  const normal = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const visivel = el => el.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';
  const habilitado = el => visivel(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true' && el.getAttribute('aria-busy') !== 'true';
  const tentativas = new Map();
  let ativo = true, agendado = false, verificando = false, total = 0;

  function verificar() {
    if (!ativo || verificando) return false;
    verificando = true;
    try {
      for (const [painel] of tentativas) if (!visivel(painel)) tentativas.delete(painel);
      const paineis = [...document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"], .modal, .toast, [role="alert"]')].filter(visivel);
      const candidatos = [];
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
      for (const { painel, botao } of candidatos) {
        const anterior = tentativas.get(painel) || { n: 0, quando: 0 };
        if (!habilitado(botao) || anterior.n >= 3 || Date.now() - anterior.quando < 1500) continue;
        // Registra antes do clique: uma nova verificação não pode duplicar a ação.
        tentativas.set(painel, { n: anterior.n + 1, quando: Date.now() });
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
    parar() { ativo = false; observer.disconnect(); clearInterval(timer); tentativas.clear(); },
    get fechamentos() { return total; }
  };
  verificar();
  console.info('[Auren avisos] Ativo desde o carregamento, mesmo com a caçada pausada.');
})();
