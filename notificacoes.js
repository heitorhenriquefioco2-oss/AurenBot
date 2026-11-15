'use strict';
const ui = id => document.getElementById(id);
const {ids, nomes, normalizar, validarPerfil} = aurenConfigNotificacoes;
let configSalva = null, salvando = false;
function valoresFormulario() {
  const cfg = {versao:2, ativadas:ui('ativadas').checked, repetir:ui('repetir').checked, dispositivos:{}};
  for (const id of ids) cfg.dispositivos[id] = {ativado:ui(id+'Ativado').checked, endereco:ui(id+'Endereco').value.trim(), chave:ui(id+'Chave').value.trim()};
  return cfg;
}
function mostrarPerfis(cfg) {
  for (const id of ids) {
    const perfil = cfg.dispositivos[id];
    ui(id+'Status').textContent = perfil.ativado ? 'Configurado para receber avisos.' : 'Envio desmarcado. Os dados permanecem salvos.';
  }
}
ui('config').onsubmit = async event => {
  event.preventDefault();
  if (salvando) return;
  salvando = true; ui('salvar').disabled = true;
  try {
    const cfg = valoresFormulario(), digitado = structuredClone(cfg);
    const ativos = ids.filter(id=>cfg.dispositivos[id].ativado);
    if (cfg.ativadas && !ativos.length) throw Error('Selecione Windows, Android ou ambos para receber os avisos.');
    const origens = [];
    if (cfg.ativadas) for (const id of ativos) {
      try {
        const destino = validarPerfil(cfg.dispositivos[id]);
        cfg.dispositivos[id].endereco = destino.endereco;
        origens.push(destino.permissao);
      } catch(error) { throw Error(`${nomes[id]}: ${error.message}`); }
    }
    // Solicita as permissões em um único clique, antes de qualquer gravação.
    if (origens.length && !(await chrome.permissions.request({origins:[...new Set(origens)]}))) throw Error('O acesso aos endereços não foi autorizado. Nenhuma alteração foi salva.');
    await chrome.storage.local.set({aurenNotificacoesV1:cfg});
    configSalva = cfg;
    for (const id of ids) if (ui(id+'Endereco').value.trim() === digitado.dispositivos[id].endereco) ui(id+'Endereco').value = cfg.dispositivos[id].endereco;
    mostrarPerfis(cfg);
    ui('status').textContent = cfg.ativadas ? 'Configuração salva. Envie um teste para conferir cada dispositivo.' : 'Notificações desativadas. Endereços e chaves continuam salvos.';
  } catch(error) { ui('status').textContent = error.message; }
  finally { salvando = false; ui('salvar').disabled = false; }
};
async function testar(destino) {
  if (salvando || !configSalva || JSON.stringify(valoresFormulario()) !== JSON.stringify(configSalva)) {
    ui('status').textContent = 'Salve as alterações antes de testar os dispositivos.';
    return;
  }
  ui('status').textContent = 'Enviando teste aos receptores salvos…';
  try {
    const result = await chrome.runtime.sendMessage({origem:'auren-avisos-windows', comando:'teste', ...(destino ? {destino} : {})});
    if (result?.resultados) {
      for (const r of result.resultados) if (ids.includes(r.destino)) ui(r.destino+'Status').textContent = r.ok ? 'Teste confirmado pelo receptor. Confira a notificação no dispositivo.' : `Falha no teste: ${r.erro}`;
      ui('status').textContent = result.resultados.map(r=>`${nomes[r.destino] || 'Receptor'}: ${r.ok ? 'teste confirmado' : r.erro}`).join('\n');
    } else {
      if (!result?.ok) throw Error(result?.erro || 'Não consegui enviar o aviso.');
      ui('status').textContent = 'O receptor confirmou o aviso. Confira a notificação no dispositivo.';
    }
  } catch(error) { ui('status').textContent = error.message; }
}
ui('testar').onclick = ()=>testar();
ui('testarWindows').onclick = ()=>testar('windows');
ui('testarAndroid').onclick = ()=>testar('android');
chrome.storage.local.get('aurenNotificacoesV1').then(saved=>{
  const cfg = normalizar(saved.aurenNotificacoesV1);
  ui('ativadas').checked = cfg.ativadas; ui('repetir').checked = cfg.repetir;
  for (const id of ids) {
    ui(id+'Ativado').checked = cfg.dispositivos[id].ativado;
    ui(id+'Endereco').value = cfg.dispositivos[id].endereco;
    ui(id+'Chave').value = cfg.dispositivos[id].chave;
  }
  configSalva = valoresFormulario(); mostrarPerfis(cfg); ui('campos').disabled = false;
  ui('status').textContent = cfg.ativadas ? 'Configuração carregada. Você pode ativar Windows e Android juntos.' : 'Preencha os receptores, ative os avisos e salve para começar.';
},()=>{ui('status').textContent='Não consegui recuperar a configuração. Reabra esta página para preservar os dados salvos.';});
