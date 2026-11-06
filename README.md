# AurenBot

Primeira publicação do AurenBot no GitHub, baseada na extensão Chrome de caçada v3.3.0.

## Instalar

1. Se recebeu o ZIP, extraia seu conteúdo para uma pasta permanente.
2. No Google Chrome, digite `chrome://extensions` na barra de endereços.
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e selecione a pasta `AurenBot` que contém o arquivo `manifest.json`.
5. Desative a versão anterior no Tampermonkey, se estiver instalada. Recarregue a página do Auren para encerrar scripts antigos do console.
6. Abra a tela de Caçada. O painel aparece pausado; não é necessário colar código no console.

## Usar

- Informe o nome exato da criatura disponível na região aberta.
- Escolha a vida mínima para atacar e o modo de recuperação.
- Configure os limites da restauradora e da poção de alívio.
- Ative **Economizar poções** e informe quantos pontos percentuais vale esperar regenerar.
- Confira o **Diagnóstico** e clique em **Iniciar**.
- O resultado da caçada é fechado pelo botão **Continuar**; depois o bot reavalia a vida e repete o ciclo.
- Para parar, use **Pausar** no painel ou no botão da extensão. **Ocultar painel** também pausa a automação.
- Para reabrir o painel oculto, clique no ícone da extensão e em **Abrir painel no jogo**. Isso não inicia a automação.

As configurações são salvas localmente pela extensão neste perfil do Chrome. O estado ativo não é salvo: após recarregar a página é necessário clicar em Iniciar. Ocultar a aba também pausa o bot.

## Exemplo

Ataque em 80%, restauradora até 30%, alívio até 70%, economia de 5 pontos:

- Vida a partir de 80%: atacar.
- Vida até 30%: restauradora.
- Vida acima de 30% e até 70%: alívio.
- Vida acima de 70% e abaixo de 80%: aguardar regeneração.
- A margem de economia e o modo somente regeneração têm prioridade sobre o uso de poções.

## Observações

A extensão atua somente em `https://auren-online.com/` e `https://www.auren-online.com/`, pela interface visível. Solicita apenas a permissão de armazenamento. Não transmite configurações a servidores.

Não execute o script de console junto com a extensão, nem duas versões da extensão na mesma página. Em uma atualização, clique em Recarregar na página de extensões e depois recarregue o jogo.

O painel e as regras vêm da versão 3.3. Alterações futuras na interface do jogo podem exigir atualização dos seletores. A extensão mantém a pausa diante de elementos ambíguos ou falta de confirmação.
