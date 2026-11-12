'use strict';
const ui = id => document.getElementById(id);
function configurarDestino() {
  const url = new URL(ui('endereco').value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw Error('Use somente o endereço do receptor, como http://100.64.0.10:8765.');
  if (!/^[a-zA-Z0-9_-]{32,256}$/.test(ui('chave').value.trim())) throw Error('Copie a chave completa exibida no receptor.');
  return {endereco:url.origin, permissao:`${url.protocol}//${url.hostname}/*`};
}
ui('config').onsubmit = async event => {
  event.preventDefault();
  try {
    const ativadas = ui('ativadas').checked;
    let endereco = ui('endereco').value.trim();
    if (ativadas) {
      const destino = configurarDestino();
      // A solicitação de permissão parte deste clique explícito na página da extensão.
      if (!(await chrome.permissions.request({origins:[destino.permissao]}))) throw Error('O acesso a esse endereço não foi autorizado.');
      endereco = destino.endereco;
    }
    await chrome.storage.local.set({aurenNotificacoesV1:{ativadas, endereco, chave:ui('chave').value.trim(), repetir:ui('repetir').checked}});
    ui('status').textContent = ativadas ? 'Configuração salva. Envie um aviso de teste para conferir a conexão com o Windows.' : 'Avisos desativados.';
  } catch(error) { ui('status').textContent = error.message; }
};
ui('testar').onclick = async () => {
  ui('status').textContent = 'Enviando teste ao PC…';
  try {
    const result = await chrome.runtime.sendMessage({origem:'auren-avisos-windows', comando:'teste'});
    if (!result?.ok) throw Error(result?.erro || 'Não consegui enviar o aviso.');
    ui('status').textContent = 'O receptor confirmou o aviso. Confira a notificação e o som no Windows.';
  } catch(error) { ui('status').textContent = error.message; }
};
chrome.storage.local.get('aurenNotificacoesV1').then(saved=>{
  const cfg = saved.aurenNotificacoesV1 || {};
  ui('ativadas').checked = cfg.ativadas === true;
  ui('endereco').value = cfg.endereco || '';
  ui('chave').value = cfg.chave || '';
  ui('repetir').checked = cfg.repetir !== false;
  ui('status').textContent = cfg.ativadas ? 'Avisos configurados. Use o teste para conferir o receptor.' : 'Preencha os dados do receptor e ative os avisos para começar.';
},()=>{ui('status').textContent='Não consegui recuperar a configuração.';});
