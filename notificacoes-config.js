(() => {
  'use strict';
  const ids = ['windows', 'android'];
  const nomes = {windows:'Windows', android:'Android'};
  function normalizar(valor) {
    const salvo = valor && typeof valor === 'object' ? valor : {};
    const cfg = {versao:2, ativadas:salvo.ativadas === true, repetir:salvo.repetir !== false, dispositivos:{}};
    for (const id of ids) {
      const p = salvo.versao === 2 ? salvo.dispositivos?.[id] : null;
      cfg.dispositivos[id] = {ativado:p?.ativado === true, endereco:typeof p?.endereco === 'string' ? p.endereco.trim() : '', chave:typeof p?.chave === 'string' ? p.chave.trim() : ''};
    }
    if (salvo.versao !== 2 && (salvo.endereco || salvo.chave || salvo.ativadas === true || salvo.destino)) {
      const id = salvo.destino === 'android' ? 'android' : 'windows';
      cfg.dispositivos[id] = {ativado:true, endereco:typeof salvo.endereco === 'string' ? salvo.endereco.trim() : '', chave:typeof salvo.chave === 'string' ? salvo.chave.trim() : ''};
    }
    return cfg;
  }
  function destino(valor) {
    let url;
    try { url = new URL(valor); } catch { throw Error('Cole o endereço mostrado no app. Exemplo: http://100.64.0.10:8765.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw Error('Cole só o endereço mostrado no app, sem nada depois do número. Exemplo: http://100.64.0.10:8765.');
    return {endereco:url.origin, endpoint:url.origin + '/api/notify', permissao:`${url.protocol}//${url.hostname}/*`};
  }
  function validarPerfil(perfil) {
    const receptor = destino(perfil.endereco);
    if (!/^[a-zA-Z0-9_-]{32,256}$/.test(perfil.chave || '')) throw Error('Copie o código de acesso inteiro que aparece no app.');
    return receptor;
  }
  globalThis.aurenConfigNotificacoes = {ids, nomes, normalizar, destino, validarPerfil};
})();
