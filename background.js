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
