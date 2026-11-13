'use strict';
const ui = id => document.getElementById(id);
let configSalva = null;
function valoresFormulario() {
  return {ativadas:ui('ativadas').checked, destino:ui('destino').value, endereco:ui('endereco').value.trim(), chave:ui('chave').value.trim(), repetir:ui('repetir').checked};
}
function atualizarDestino() {
  const android = ui('destino').value === 'android';
  ui('androidAjuda').hidden = !android;
  ui('rotuloAtivar').textContent = android ? 'Enviar avisos ao meu celular Android' : 'Enviar avisos ao meu PC Windows';
  ui('rotuloEndereco').textContent = android ? 'Endereço do celular Android' : 'Endereço do receptor Windows';
  ui('ajudaEndereco').textContent = android ? 'Copie o endereço do AurenBot Alertas no celular. Na VPS, use o IP Tailscale do celular, não o do PC.' : 'Copie o endereço da aplicação AurenBot Alertas. Na VPS, use o IP Tailscale do PC receptor.';
  ui('ajudaChave').textContent = android ? 'Copie a chave exibida no aplicativo Android. Não use a chave do receptor Windows nem uma chave de IA.' : 'Copie a chave da aplicação no PC. Não use uma chave de IA.';
}
ui('destino').onchange = () => {
  atualizarDestino();
  ui('status').textContent = 'Confira o endereço e a chave do dispositivo escolhido e salve para aplicar. Os dados preenchidos foram mantidos.';
};
function configurarDestino() {
  const url = new URL(ui('endereco').value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw Error('Use somente o endereço do receptor, como http://100.64.0.10:8765.');
  if (!/^[a-zA-Z0-9_-]{32,256}$/.test(ui('chave').value.trim())) throw Error('Copie a chave completa exibida no receptor.');
  return {endereco:url.origin, permissao:`${url.protocol}//${url.hostname}/*`};
}
ui('config').onsubmit = async event => {
  event.preventDefault();
  try {
    const cfg = valoresFormulario();
    const {ativadas, destino} = cfg;
    if (!['windows', 'android'].includes(destino)) throw Error('Escolha Windows ou Android para receber os avisos.');
    const enderecoDigitado = cfg.endereco;
    let endereco = cfg.endereco;
    if (ativadas) {
      const destino = configurarDestino();
      // A solicitação de permissão parte deste clique explícito na página da extensão.
      if (!(await chrome.permissions.request({origins:[destino.permissao]}))) throw Error('O acesso a esse endereço não foi autorizado.');
      endereco = destino.endereco;
    }
    cfg.endereco = endereco;
    await chrome.storage.local.set({aurenNotificacoesV1:cfg});
    if (ui('endereco').value.trim() === enderecoDigitado) ui('endereco').value = endereco;
    configSalva = cfg;
    ui('status').textContent = ativadas ? 'Configuração salva. Envie um aviso de teste para conferir a conexão com o dispositivo escolhido.' : 'Avisos desativados.';
  } catch(error) { ui('status').textContent = error.message; }
};
ui('testar').onclick = async () => {
  if (!configSalva || JSON.stringify(valoresFormulario()) !== JSON.stringify(configSalva)) {
    ui('status').textContent = 'Salve as alterações antes de testar o dispositivo escolhido.';
    return;
  }
  ui('status').textContent = 'Enviando teste ao receptor salvo…';
  try {
    const result = await chrome.runtime.sendMessage({origem:'auren-avisos-windows', comando:'teste'});
    if (!result?.ok) throw Error(result?.erro || 'Não consegui enviar o aviso.');
    ui('status').textContent = 'O receptor confirmou o aviso. Confira a notificação no dispositivo receptor.';
  } catch(error) { ui('status').textContent = error.message; }
};
chrome.storage.local.get('aurenNotificacoesV1').then(saved=>{
  const cfg = saved.aurenNotificacoesV1 || {};
  ui('destino').value = cfg.destino === 'android' ? 'android' : 'windows';
  atualizarDestino();
  ui('ativadas').checked = cfg.ativadas === true;
  ui('endereco').value = cfg.endereco || '';
  ui('chave').value = cfg.chave || '';
  ui('repetir').checked = cfg.repetir !== false;
  configSalva = valoresFormulario();
  ui('status').textContent = cfg.ativadas ? 'Avisos configurados. Use o teste para conferir o receptor.' : 'Preencha os dados do receptor e ative os avisos para começar.';
},()=>{ui('status').textContent='Não consegui recuperar a configuração.';});
