(() => {
  'use strict';
  if (!chrome.alarms || !chrome.tabs || !chrome.storage.session) return;
  const nome = 'auren-segundo-plano', chave = 'aurenAbasSegundoPlanoV1';
  let fila = Promise.resolve();
  const serializar = tarefa => {
    fila = fila.then(tarefa).catch(error=>console.error('Falha no acompanhamento em segundo plano:',error));
    return fila;
  };
  async function ler() { return (await chrome.storage.session.get(chave))[chave] || {}; }
  async function gravar(abas) {
    await chrome.storage.session.set({[chave]:abas});
    if (Object.keys(abas).length) {
      if (!await chrome.alarms.get(nome)) await chrome.alarms.create(nome,{periodInMinutes:0.5});
    } else await chrome.alarms.clear(nome);
  }
  async function liberar(abas,id) {
    const anterior = abas[id];
    delete abas[id];
    if (anterior?.autoDiscardable === true) {
      try { await chrome.tabs.update(Number(id),{autoDiscardable:true}); } catch { /* Aba já fechada. */ }
    }
  }
  chrome.runtime.onMessage.addListener((msg,sender,responder)=>{
    if (msg?.origem !== 'auren-segundo-plano' || typeof msg.ativo !== 'boolean' ||
        sender.id !== chrome.runtime.id || !Number.isInteger(sender.tab?.id) || sender.frameId !== 0 ||
        !/^https:\/\/(?:www\.)?auren-online\.com\//.test(sender.url || '')) return;
    serializar(async()=>{
      const abas = await ler(), id = sender.tab.id;
      if (msg.ativo) {
        if (!abas[id]) {
          const tab = await chrome.tabs.get(id);
          abas[id] = {autoDiscardable:tab.autoDiscardable === true};
        }
        await chrome.tabs.update(id,{autoDiscardable:false});
      } else await liberar(abas,id);
      await gravar(abas);
      responder({ok:true});
    });
    return true;
  });
  chrome.alarms.onAlarm.addListener(alarme=>{
    if (alarme.name !== nome) return;
    serializar(async()=>{
      const abas = await ler();
      for (const id of Object.keys(abas)) {
        try {
          const resposta = await chrome.tabs.sendMessage(Number(id),{origem:'auren-segundo-plano',comando:'pulso'});
          if (resposta?.ativo !== true) await liberar(abas,id);
        } catch { await liberar(abas,id); }
      }
      await gravar(abas);
    });
  });
  chrome.tabs.onRemoved.addListener(id=>serializar(async()=>{
    const abas = await ler();delete abas[id];await gravar(abas);
  }));
  // Reconstitui o alarme quando o service worker é reiniciado.
  serializar(async()=>gravar(await ler()));
})();
