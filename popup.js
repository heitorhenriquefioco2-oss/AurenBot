'use strict';
const statusEl = document.getElementById('status');
async function enviar(comando) {
  const buttons = [...document.querySelectorAll('button')];
  buttons.forEach(b => { b.disabled = true; });
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || typeof tab.id !== 'number') throw Error('Nenhuma aba ativa.');
    const resposta = await chrome.tabs.sendMessage(tab.id, { origem: 'auren-popup-v33', comando });
    if (!resposta || !resposta.ok) throw Error('O painel não respondeu.');
    statusEl.textContent = resposta.mensagem;
  } catch {
    statusEl.textContent = 'Abra o Auren e recarregue a página após instalar a extensão. Depois tente novamente.';
  } finally {
    buttons.forEach(b => { b.disabled = false; });
  }
}
document.getElementById('abrir').addEventListener('click', () => enviar('abrir'));
document.getElementById('pausar').addEventListener('click', () => enviar('pausar'));
