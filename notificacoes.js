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
    ui(id+'Status').textContent = perfil.ativado ? 'Avisos ativados.' : 'Desativado. Dados salvos.';
  }
}
ui('config').onsubmit = async event => {
  event.preventDefault();
  if (salvando) return;
  salvando = true; ui('salvar').disabled = true;
  try {
    const cfg = valoresFormulario(), digitado = structuredClone(cfg);
    const ativos = ids.filter(id=>cfg.dispositivos[id].ativado);
    if (cfg.ativadas && !ativos.length) throw Error('Marque Windows, Android ou os dois.');
    const origens = [];
    if (cfg.ativadas) for (const id of ativos) {
      try {
        const destino = validarPerfil(cfg.dispositivos[id]);
        cfg.dispositivos[id].endereco = destino.endereco;
        origens.push(destino.permissao);
      } catch(error) { throw Error(`${nomes[id]}: ${error.message}`); }
    }
    // Solicita as permissões em um único clique, antes de qualquer gravação.
    if (origens.length && !(await chrome.permissions.request({origins:[...new Set(origens)]}))) throw Error('Conexão recusada. Salve novamente e autorize o Chrome. Nada foi alterado.');
    await chrome.storage.local.set({aurenNotificacoesV1:cfg});
    configSalva = cfg;
    for (const id of ids) if (ui(id+'Endereco').value.trim() === digitado.dispositivos[id].endereco) ui(id+'Endereco').value = cfg.dispositivos[id].endereco;
    mostrarPerfis(cfg);
    ui('status').textContent = cfg.ativadas ? 'Tudo salvo. Teste os avisos.' : 'Avisos desligados. Dados salvos.';
  } catch(error) { ui('status').textContent = error.message; }
  finally { salvando = false; ui('salvar').disabled = false; }
};
async function testar(destino) {
  if (salvando || !configSalva || JSON.stringify(valoresFormulario()) !== JSON.stringify(configSalva)) {
    ui('status').textContent = 'Clique em Salvar configurações antes do teste.';
    return;
  }
  ui('status').textContent = 'Enviando teste…';
  try {
    const result = await chrome.runtime.sendMessage({origem:'auren-avisos-windows', comando:'teste', ...(destino ? {destino} : {})});
    if (result?.resultados) {
      for (const r of result.resultados) if (ids.includes(r.destino)) ui(r.destino+'Status').textContent = r.ok ? 'O app recebeu o teste. Confira o aparelho.' : `O teste não chegou: ${r.erro}`;
      ui('status').textContent = result.resultados.map(r=>`${nomes[r.destino] || 'App'}: ${r.ok ? 'teste recebido' : r.erro}`).join('\n');
    } else {
      if (!result?.ok) throw Error(result?.erro || 'Falha no envio. Confira a conexão.');
      ui('status').textContent = 'Aviso recebido. Confira o aparelho.';
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
  ui('status').textContent = cfg.ativadas ? 'Avisos prontos. Escolha os aparelhos abaixo.' : 'Preencha os dados, ative os avisos e salve.';
},()=>{ui('status').textContent='Falha ao carregar dados. Reabra esta página.';});
