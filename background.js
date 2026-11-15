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
  if (!(await chrome.permissions.contains({origins:[destino.permissao]}))) throw Error('Salve novamente a configuração para autorizar o acesso ao receptor.');
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(), 5000);
  try {
    const response = await fetch(destino.endpoint, {
      method:'POST', redirect:'error', signal:controller.signal,
      headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${perfil.chave}`},
      body:JSON.stringify({id:msg.eventoId, tipo:msg.tipo})
    });
    if (!response.ok) throw Error(response.status === 401 ? 'A chave foi recusada pelo receptor.' : response.status === 429 ? 'O receptor pediu para aguardar antes de outro aviso.' : `O receptor respondeu HTTP ${response.status}.`);
    let data;
    try { data = await response.json(); } catch { throw Error('O receptor respondeu em um formato inválido.'); }
    if (data.ok !== true) throw Error('O receptor não confirmou o recebimento.');
  } catch(error) {
    if (error.name === 'AbortError' || error instanceof TypeError) throw Error('Não consegui alcançar o dispositivo receptor. Confira se a aplicação e o Tailscale estão ligados e se a porta 8765 está liberada no firewall.');
    throw error;
  } finally { clearTimeout(timeout); }
}
async function enviarAvisos(msg) {
  const salvo = await chrome.storage.local.get('aurenNotificacoesV1');
  const {ids, nomes, normalizar} = aurenConfigNotificacoes;
  const cfg = normalizar(salvo.aurenNotificacoesV1);
  if (!cfg.ativadas) throw Error('Ative e salve os avisos nas configurações da extensão.');
  const destinos = ids.filter(id=>cfg.dispositivos[id].ativado && (!msg.destino || msg.destino === id));
  if (!destinos.length) throw Error(msg.destino ? `Ative e salve o envio para ${nomes[msg.destino]} nas configurações.` : 'Ative Windows, Android ou ambos nas configurações.');
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
    chrome.runtime.openOptionsPage().then(()=>responder({ok:true}),()=>responder({ok:false,erro:'Não consegui abrir as configurações.'}));
    return true;
  }
  if (!['captcha', 'teste'].includes(msg.comando)) return;
  if (msg.comando === 'captcha' && (typeof sender.tab?.id !== 'number' || !/^https:\/\/(?:www\.)?auren-online\.com\//.test(sender.url || ''))) return;
  if (msg.destino !== undefined && !aurenConfigNotificacoes.ids.includes(msg.destino)) { responder({ok:false,erro:'Dispositivo inválido.'}); return; }
  if (msg.comando === 'teste') msg = {...msg, eventoId:crypto.randomUUID(), tipo:'cloudflare'};
  if (!['cloudflare','sombra'].includes(msg.tipo) || !/^[a-zA-Z0-9-]{1,100}$/.test(msg.eventoId || '')) { responder({ok:false,erro:'Aviso inválido.'}); return; }
  enviarAvisos(msg).then(responder,error=>responder({ok:false,erro:error.message}));
  return true;
});
