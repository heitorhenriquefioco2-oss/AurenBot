# AurenBot

Extensão Chrome de caçada v3.3.8, com fechamento automático de avisos desde o carregamento da página.

## Instalar

1. Se recebeu o ZIP, extraia seu conteúdo para uma pasta permanente.
2. No Google Chrome, digite `chrome://extensions` na barra de endereços.
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e selecione a pasta `AurenBot` que contém o arquivo `manifest.json`.
5. Desative a versão anterior no Tampermonkey, se estiver instalada. Recarregue a página do Auren para encerrar scripts antigos do console.
6. Ao carregar, a extensão apenas abre Caçada uma única vez e exibe o painel pausado. As demais ações aguardam o clique em Iniciar. Depois disso você pode navegar pelo jogo livremente; não é necessário colar código no console.

## Usar

- Informe o nome exato da criatura disponível na região aberta.
- Escolha a vida mínima para atacar e o modo de recuperação.
- Configure os limites da restauradora e da poção de alívio.
- Ative **Economizar poções** e informe quantos pontos percentuais vale esperar regenerar.
- Ao carregar, o bot apenas abre **Caçada** e mostra o painel dentro do jogo. Não seleciona a modalidade, não solicita pausa de expedição e não inicia a caçada nesse momento.
- Ao clicar em **Iniciar** no painel, o bot seleciona **Só o resultado** e valida as configurações. Se houver expedição ativa, pergunta se deseja pausá-la; somente com sua aceitação solicita a pausa, retorna para **Caçada**, reconfirma **Só o resultado** e inicia o ciclo.
- Configure a criatura e os limites no painel. Sem uma criatura configurada ou com valores inválidos, Iniciar mantém a caçada parada, antes de pausar uma expedição.
- Pausar, ocultar o painel ou alterar qualquer configuração cancela a preparação. Recusar a pausa mantém a expedição e não inicia a caçada.
- O resultado da caçada é fechado pelo botão **Continuar**; depois o bot reavalia a vida e repete o ciclo.
- Para parar, use **Pausar** no painel. **Ocultar painel** também pausa a automação.
- Para reabrir o painel oculto, clique no ícone da extensão. Ele abre diretamente o painel no jogo, sem popup intermediário e sem iniciar a automação.

As configurações são salvas localmente pela extensão neste perfil do Chrome. A cada carregamento, o bot abre Caçada e aguarda Iniciar, mesmo com configurações salvas. Uma recusa da pausa cancela a tentativa de início atual. Ocultar a aba também pausa a caçada.

## Navegação para Caçada

O item do menu é localizado prioritariamente pelo título exato `title="Caçada (Alt + C)"`, inclusive quando o atributo está em um ícone ou elemento interno do controle. A navegação inicia em `document_start`, antes de criar o painel do bot. A extensão tenta abrir Caçada uma única vez pelo menu do jogo, aguardando o menu e a tela por até 15 segundos. Só depois exibe o painel, inclusive se for necessário informar uma falha de navegação. Se já estiver nela, não clica. Essa navegação não se repete durante o ciclo ou ao trocar manualmente de aba. Ao clicar em Iniciar, o bot também garante que está na tela correta antes de preparar a caçada. Após a exibição do painel, Pausar ou Ocultar painel cancela uma navegação de preparação em andamento.

## Expedição ativa ao iniciar

Após confirmar **Só o resultado** e validar as configurações, se o bot encontrar **Pausar expedição** ou o aviso **Herói em expedição**, ele pergunta no painel se deseja pausar a expedição. **Cancelar início** mantém a expedição e a caçada não começa.

Com **Pausar expedição e continuar**, o bot aciona o botão na Caçada. Se esse botão apenas abrir Expedição, ele aciona Pausar expedição nessa tela uma única vez e aguarda a confirmação da pausa por até 8 segundos. Depois volta para Caçada pelo menu esquerdo, aguarda a tela carregar, verifica que a expedição não continua ativa e confere **Só o resultado** antes de iniciar o ciclo. Sem confirmação da pausa, a caçada permanece parada. A expedição não é retomada automaticamente.

Pausar, ocultar o painel ou alterar as configurações cancela uma preparação em andamento, inclusive enquanto a pergunta estiver aberta. O fechamento automático de avisos não responde essa pergunta, pois ela fica dentro do painel da extensão.

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

