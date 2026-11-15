'use strict';

// O ícone reabre diretamente o painel no jogo, sem popup intermediário.
chrome.action.onClicked.addListener(async tab => {
  if (typeof tab.id !== 'number') return;
  try {
    await chrome.tabs.sendMessage(tab.id, { origem: 'auren-popup-v33', comando: 'abrir' });
  } catch {
    console.info('Abra o Auren e recarregue a página para usar o painel.');
  }
});

importScripts('notificacoes-config.js');

async function enviarReceptor(perfil, msg) {
  const destino = aurenConfigNotificacoes.validarPerfil(perfil);
  if (!(await chrome.permissions.contains({origins:[destino.permissao]}))) throw Error('Clique em Salvar configurações e permita o acesso quando o Chrome pedir.');
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(), 5000);
  try {
    const response = await fetch(destino.endpoint, {
      method:'POST', redirect:'error', signal:controller.signal,
      headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${perfil.chave}`},
      body:JSON.stringify({id:msg.eventoId, tipo:msg.tipo})
    });
    if (!response.ok) throw Error(response.status === 401 ? 'Código de acesso incorreto. Copie de novo no app e salve.' : response.status === 429 ? 'O app recebeu um aviso há pouco. Aguarde alguns segundos e tente de novo.' : `O app não recebeu o aviso. Tente de novo. Código do erro: ${response.status}.`);
    let data;
    try { data = await response.json(); } catch { throw Error('Não entendi a resposta do app. Confira o endereço e tente de novo.'); }
    if (data.ok !== true) throw Error('O app ainda não confirmou o aviso. Tente de novo.');
  } catch(error) {
    if (error.name === 'AbortError' || error instanceof TypeError) throw Error('Não consegui conectar. Abra o app, confira a internet e mantenha o Tailscale ligado nos dois aparelhos.');
    throw error;
  } finally { clearTimeout(timeout); }
}
async function enviarAvisos(msg) {
  const salvo = await chrome.storage.local.get('aurenNotificacoesV1');
  const {ids, nomes, normalizar} = aurenConfigNotificacoes;
  const cfg = normalizar(salvo.aurenNotificacoesV1);
  if (!cfg.ativadas) throw Error('Ligue os avisos e clique em Salvar configurações.');
  const destinos = ids.filter(id=>cfg.dispositivos[id].ativado && (!msg.destino || msg.destino === id));
  if (!destinos.length) throw Error(msg.destino ? `Marque ${nomes[msg.destino]} nos avisos e clique em Salvar configurações.` : 'Marque Windows, Android ou os dois para receber os avisos.');
  // Cada receptor tem sua própria permissão, autenticação e prazo; uma falha não cancela o outro.
  const resultados = await Promise.all(destinos.map(async destino=>{
    try { await enviarReceptor(cfg.dispositivos[destino], msg); return {destino, ok:true}; }
    catch(error) { return {destino, ok:false, erro:error.message}; }
  }));
  const falhas = resultados.filter(r=>!r.ok);
  return {ok:falhas.length === 0, resultados, ...(falhas.length ? {erro:resultados.length === 1 ? falhas[0].erro : falhas.map(r=>`${nomes[r.destino]}: ${r.erro}`).join(' ')} : {})};
}
chrome.runtime.onMessage.addListener((msg, sender, responder) => {
  if (sender.id !== chrome.runtime.id || msg?.origem !== 'auren-avisos-windows') return;
  if (msg.comando === 'configurar') {
    chrome.runtime.openOptionsPage().then(()=>responder({ok:true}),()=>responder({ok:false,erro:'Não consegui abrir as opções. Tente de novo.'}));
    return true;
  }
  if (!['captcha', 'teste'].includes(msg.comando)) return;
  if (msg.comando === 'captcha' && (typeof sender.tab?.id !== 'number' || !/^https:\/\/(?:www\.)?auren-online\.com\//.test(sender.url || ''))) return;
  if (msg.destino !== undefined && !aurenConfigNotificacoes.ids.includes(msg.destino)) { responder({ok:false,erro:'Escolha Windows ou Android para testar.'}); return; }
  if (msg.comando === 'teste') msg = {...msg, eventoId:crypto.randomUUID(), tipo:'cloudflare'};
  if (!['cloudflare','sombra'].includes(msg.tipo) || !/^[a-zA-Z0-9-]{1,100}$/.test(msg.eventoId || '')) { responder({ok:false,erro:'Não consegui preparar o aviso. Recarregue o jogo e tente de novo.'}); return; }
  enviarAvisos(msg).then(responder,error=>responder({ok:false,erro:error.message}));
  return true;
});
