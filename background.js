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

function destinoAvisos(valor) {
  const url = new URL(valor);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw Error('Informe somente o endereço do receptor, por exemplo http://100.64.0.10:8765.');
  return { endpoint: url.origin + '/api/notify', permissao: `${url.protocol}//${url.hostname}/*` };
}
async function enviarAvisoWindows(msg) {
  const salvo = await chrome.storage.local.get('aurenNotificacoesV1');
  const cfg = salvo.aurenNotificacoesV1;
  if (!cfg?.ativadas) throw Error('Ative e salve os avisos nas configurações da extensão.');
  const destino = destinoAvisos(cfg.endereco);
  if (!/^[a-zA-Z0-9_-]{32,256}$/.test(cfg.chave || '')) throw Error('A chave do receptor está inválida. Copie a chave exibida na aplicação receptora.');
  if (!(await chrome.permissions.contains({origins:[destino.permissao]}))) throw Error('Salve novamente a configuração para autorizar o acesso ao receptor.');
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(), 5000);
  try {
    const response = await fetch(destino.endpoint, {
      method:'POST', redirect:'error', signal:controller.signal,
      headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${cfg.chave}`},
      body:JSON.stringify({id:msg.eventoId, tipo:msg.tipo})
    });
    if (!response.ok) throw Error(response.status === 401 ? 'A chave foi recusada pelo receptor.' : response.status === 429 ? 'O receptor pediu para aguardar antes de outro aviso.' : `O receptor respondeu HTTP ${response.status}.`);
    const data = await response.json();
    if (data.ok !== true) throw Error('O receptor não confirmou o recebimento.');
    return {ok:true};
  } catch(error) {
    if (error.name === 'AbortError' || error instanceof TypeError) throw Error('Não consegui alcançar o dispositivo receptor. Confira se a aplicação e o Tailscale estão ligados e se a porta 8765 está liberada no firewall.');
    throw error;
  } finally { clearTimeout(timeout); }
}
chrome.runtime.onMessage.addListener((msg, sender, responder) => {
  if (sender.id !== chrome.runtime.id || msg?.origem !== 'auren-avisos-windows') return;
  if (msg.comando === 'configurar') {
    chrome.runtime.openOptionsPage().then(()=>responder({ok:true}),()=>responder({ok:false,erro:'Não consegui abrir as configurações.'}));
    return true;
  }
  if (!['captcha', 'teste'].includes(msg.comando)) return;
  if (msg.comando === 'captcha' && (typeof sender.tab?.id !== 'number' || !/^https:\/\/(?:www\.)?auren-online\.com\//.test(sender.url || ''))) return;
  if (msg.comando === 'teste') msg = {...msg, eventoId:crypto.randomUUID(), tipo:'cloudflare'};
  if (!['cloudflare','sombra'].includes(msg.tipo) || !/^[a-zA-Z0-9-]{1,100}$/.test(msg.eventoId || '')) { responder({ok:false,erro:'Aviso inválido.'}); return; }
  enviarAvisoWindows(msg).then(responder,error=>responder({ok:false,erro:error.message}));
  return true;
});
