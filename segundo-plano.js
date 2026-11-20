(() => {
  'use strict';
  if (window.aurenSegundoPlano) return;
  const tarefas = new Map(), esperas = new Set();
  let registrado = false, pulso = 0;
  const permitido = () => document.getElementById('auren-cacada-v3')?.shadowRoot?.getElementById('continuarOculta')?.checked === true;
  function atualizar() {
    const ativo = tarefas.size > 0 && permitido();
    const html = document.documentElement;
    if (ativo && html?.getAttribute('data-auren-segundo-plano') !== 'ativo') html?.setAttribute('data-auren-segundo-plano','ativo');
    if (!ativo && html?.hasAttribute('data-auren-segundo-plano')) html.removeAttribute('data-auren-segundo-plano');
    if (ativo === registrado) return;
    registrado = ativo;
    try {
      Promise.resolve(chrome.runtime.sendMessage({origem:'auren-segundo-plano', ativo})).catch(()=>{
        registrado = false;
        console.warn('Recarregue a extensão e o jogo para ativar o acompanhamento em segundo plano.');
      });
    } catch { registrado = false; }
  }
  function esperar(ms) {
    return new Promise(resolve=>{
      const espera = {quando:Date.now()+ms, concluir:null};
      const timer = setTimeout(()=>espera.concluir(), ms);
      espera.concluir = () => { clearTimeout(timer); esperas.delete(espera); resolve(); };
      esperas.add(espera);
    });
  }
  function executar() {
    if (!permitido() || !document.hidden) return;
    document.documentElement.setAttribute('data-auren-pulso',String(++pulso));
    for (const espera of [...esperas]) if (Date.now() >= espera.quando) espera.concluir();
    for (const tarefa of [...tarefas.values()]) {
      try { Promise.resolve(tarefa()).catch(error=>console.error('Falha no ciclo em segundo plano:',error)); }
      catch (error) { console.error('Falha no ciclo em segundo plano:',error); }
    }
  }
  window.aurenSegundoPlano = {
    registrar(nome, tarefa) { tarefas.set(nome,tarefa); atualizar(); },
    remover(nome) { tarefas.delete(nome); atualizar(); },
    atualizar, esperar,
    prazo:ms=>document.hidden && permitido() ? Math.max(ms,120000) : ms
  };
  chrome.runtime.onMessage.addListener((msg,sender,responder)=>{
    if (sender.id !== chrome.runtime.id || msg?.origem !== 'auren-segundo-plano' || msg.comando !== 'pulso') return;
    executar();
    responder({ativo:tarefas.size > 0 && permitido()});
  });
  document.addEventListener('visibilitychange',atualizar);
  // Uma recarga começa sem tarefas, mesmo que a página anterior tivesse automação ativa.
  try { Promise.resolve(chrome.runtime.sendMessage({origem:'auren-segundo-plano',ativo:false})).catch(()=>{}); } catch {}
})();
