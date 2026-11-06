# AurenBot

Extensão Chrome de caçada v3.3.2, com fechamento automático de avisos desde o carregamento da página.

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
- Confira o **Diagnóstico** e clique em **Iniciar**. Antes de começar o ciclo, o bot confere a modalidade **Só o resultado** e a seleciona se necessário. Aguarda a confirmação da seleção por até 8 segundos; sem confirmação, mantém a caçada pausada. Pausar, ocultar o painel ou alterar uma configuração cancela essa preparação.
- O resultado da caçada é fechado pelo botão **Continuar**; depois o bot reavalia a vida e repete o ciclo.
- Para parar, use **Pausar** no painel ou no botão da extensão. **Ocultar painel** também pausa a automação.
- Para reabrir o painel oculto, clique no ícone da extensão e em **Abrir painel no jogo**. Isso não inicia a automação.

As configurações são salvas localmente pela extensão neste perfil do Chrome. O estado ativo da caçada não é salvo: após recarregar a página é necessário clicar em Iniciar. Ocultar a aba também pausa a caçada.

## Fechamento automático de avisos

O fechamento inicia em `document_start`, antes do painel, e faz uma primeira verificação imediatamente. Um observador detecta alterações na página, com uma verificação adicional a cada 700 ms e antes de cada ciclo da caçada. Ele continua ativo com a caçada pausada ou o painel oculto.

- Resultados de atividades, incluindo vitória e derrota da Arena Livre: usa o botão `activity-result-continue` dentro de `activity-result-dialog`.
- Avisos em diálogos, modais e notificações: reconhece um único botão de dispensar, como Fechar, Entendi, OK ou ×. Também reconhece Entendi em tutoriais inline.
- O resultado da própria caçada permanece sob controle do ciclo original, para preservar a confirmação do ataque.
- Aguarda botões habilitados e limita tentativas de fechamento. Enquanto um aviso reconhecido permanece aberto, o ciclo não clica por trás dele.

O observador atua assim que a janela entra na página; não impede que o jogo a crie. O aviso específico de atualização ainda depende da identificação do seu HTML. Botões genéricos de confirmar ou comprar não são acionados.

Pausar e Ocultar painel interrompem apenas a caçada. Para interromper também o fechamento de avisos, desative a extensão e recarregue o jogo.

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

