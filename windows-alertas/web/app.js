'use strict';
const el = id => document.getElementById(id);
let stopped = false;
async function api(path, body) {
  const response = await fetch(path, body ? {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)} : {});
  const data = await response.json();
  if (!response.ok) throw Error(data.erro || 'Não consegui falar com o receptor.');
  return data;
}
async function refresh() {
  if (stopped) return;
  const data = await api('/api/state');
  if (stopped) return;
  const selected = el('address').value;
  el('address').replaceChildren(...data.enderecos.map(address => new Option(address, address)));
  if (data.enderecos.includes(selected)) el('address').value = selected;
  else el('address').value = data.enderecos.find(a => /^http:\/\/100\./.test(a)) || data.enderecos.find(a => !a.includes('127.0.0.1')) || data.enderecos[0];
  el('token').value = data.token;
  el('sound').checked = data.som;
  el('events').replaceChildren(...(data.eventos.length ? data.eventos.map(event => {
    const li = document.createElement('li');
    li.textContent = `${new Date(event.horario).toLocaleString('pt-BR')} — ${event.tipo === 'sombra' ? 'Desafio de sombra' : 'Verificação do Cloudflare'}`;
    return li;
  }) : [Object.assign(document.createElement('li'),{textContent:'Nenhum aviso recebido ainda.'})]));
  if (!data.windows) el('status').textContent = 'Este servidor não está no Windows. Os avisos são registrados, mas o balão e o som nativos exigem executar o receptor no PC Windows.';
}
async function action(fn) { try { await fn(); } catch(error) { el('status').textContent = error.message; } }
el('copyAddress').onclick = () => action(async()=>{await navigator.clipboard.writeText(el('address').value);el('status').textContent='Endereço copiado.';});
el('copyToken').onclick = () => action(async()=>{await navigator.clipboard.writeText(el('token').value);el('status').textContent='Chave copiada. Cole somente na configuração da extensão.';});
el('sound').onchange = () => action(async()=>{await api('/api/settings',{som:el('sound').checked});el('status').textContent='Preferência de som salva.';});
el('test').onclick = () => action(async()=>{await api('/api/test',{});el('status').textContent='Teste enviado ao Windows. Confira o balão e o som.';});
el('stop').onclick = () => action(async()=>{await api('/api/stop',{});stopped=true;clearInterval(poll);el('status').textContent='Receptor encerrado. Abra o executável novamente para receber avisos.';el('test').disabled=true;});
action(async()=>{await refresh();if(!el('status').textContent.startsWith('Este servidor'))el('status').textContent='Receptor ligado. Pronto para receber avisos.';});
const poll = setInterval(()=>action(refresh),5000);
