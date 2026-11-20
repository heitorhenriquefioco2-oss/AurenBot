(() => {
  'use strict';
  // Mantém a interface do jogo atualizada apenas enquanto a automação em segundo plano está autorizada.
  const atributo = 'data-auren-segundo-plano';
  const pulso = 'data-auren-pulso';
  const hidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
  const visibility = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
  if (!hidden?.get || !visibility?.get || !hidden.configurable || !visibility.configurable) return;
  const ativo = () => document.documentElement?.getAttribute(atributo) === 'ativo';
  Object.defineProperties(Document.prototype, {
    hidden:{...hidden, get(){return this === document && ativo() ? false : hidden.get.call(this);}},
    visibilityState:{...visibility, get(){return this === document && ativo() ? 'visible' : visibility.get.call(this);}}
  });
  new MutationObserver(registros=>{
    if (hidden.get.call(document) && registros.some(r=>r.target === document.documentElement)) {
      document.dispatchEvent(new Event('visibilitychange'));
    }
  }).observe(document, {subtree:true, attributes:true, attributeFilter:[atributo,pulso]});
})();
