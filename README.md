# AurenBot

Extensão Chrome de caçada v3.3.14, com reinício automático opcional após paradas por erro e recuperação da leitura da vida.

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
- Para usar na VPS, marque **Continuar quando a aba estiver oculta** antes de clicar em Iniciar.
- Ao carregar, o bot apenas abre **Caçada** e mostra o painel dentro do jogo. Não seleciona a modalidade, não solicita pausa de expedição e não inicia a caçada nesse momento.
- Ao clicar em **Iniciar** no painel, o bot seleciona **Só o resultado** e valida as configurações. Se houver expedição ativa, pergunta se deseja pausá-la; somente com sua aceitação solicita a pausa, retorna para **Caçada**, reconfirma **Só o resultado** e inicia o ciclo.
- Configure a criatura e os limites no painel. Sem uma criatura configurada ou com valores inválidos, Iniciar mantém a caçada parada, antes de pausar uma expedição.
- Pausar, ocultar o painel ou alterar qualquer configuração cancela a preparação. Recusar a pausa mantém a expedição e não inicia a caçada.
- O resultado da caçada é fechado pelo botão **Continuar**; depois o bot reavalia a vida e repete o ciclo.
- Para parar, use **Pausar** no painel. **Ocultar painel** também pausa a automação.
- Para reabrir o painel oculto, clique no ícone da extensão. Ele abre diretamente o painel no jogo, sem popup intermediário e sem iniciar a automação.

As configurações são salvas localmente pela extensão neste perfil do Chrome. A cada carregamento, o bot abre Caçada e aguarda Iniciar, mesmo com configurações salvas. Uma recusa da pausa cancela a tentativa de início atual. Por padrão, ocultar a aba também pausa a caçada.

## VPS e aba oculta

A opção **Continuar quando a aba estiver oculta** vem desmarcada e fica salva neste perfil do Chrome. Com ela marcada, o bot mantém o ciclo quando o navegador informa que a aba ficou oculta, inclusive se isso acontecer ao minimizar a janela ou desconectar o RDP. Alterar essa opção pausa a caçada, assim como as demais configurações; clique em **Iniciar** para aplicar.

O Chrome e o jogo precisam continuar abertos na VPS. Desconectar o RDP é diferente de sair/encerrar a sessão do Windows, que fecha os aplicativos. O navegador ainda pode reduzir a frequência dos ciclos, congelar ou descartar a aba em segundo plano; esta opção apenas desativa a pausa por visibilidade e não impede essas limitações. Os controles **Pausar** e **Ocultar painel** continuam pausando a caçada, e as verificações de confirmação das ações continuam ativas.

## Falhas temporárias na leitura da vida

Se o bot não conseguir ler a vida do herói e não houver uma ação aguardando confirmação, mantém o ciclo ativo e tenta ler novamente a cada ciclo (intervalo nominal de 2,2 segundos). Enquanto a leitura estiver indisponível, não seleciona criaturas, não ataca nem usa poções. Quando a vida voltar a ser identificada, reavalia as configurações com a leitura atual e continua automaticamente, sem precisar recarregar a página ou clicar em Iniciar.

Os controles Pausar e Ocultar painel continuam interrompendo a caçada, inclusive durante essa espera. As ações já pendentes continuam exigindo confirmação e respeitando seu prazo original, para evitar cliques duplicados. Uma leitura válida de vida zero continua pausando a caçada. A extensão não recarrega a página automaticamente; se a interface não se recuperar, a mensagem de espera permanece no painel.

## Reinício automático após paradas por erro

Marque **Reiniciar automaticamente após uma parada por erro** e clique em **Iniciar** para armar a recuperação. A opção vem desmarcada e fica salva neste perfil. Uma preferência salva não inicia uma nova página por conta própria. Quando uma falha pausa uma caçada que estava em execução, o bot verifica a cada 10 segundos se pode repetir a preparação e retomar com as mesmas escolhas. Se a preparação falhar novamente, mantém as tentativas nesse intervalo.

Para retomar, aguarda uma leitura de vida acima de zero e a confirmação de ações pendentes. Um ataque sem resultado ou uma poção sem recuperação confirmada nunca é repetido apenas porque o prazo expirou. Se a confirmação chegar mais tarde, a recuperação continua sem descartar esse registro. Uma expedição ativa também impede o reinício automático até terminar ou ser pausada no jogo.

**Pausar**, **Ocultar painel**, **Conferir jogo** e alterações nas configurações cancelam a recuperação; clique em **Iniciar** para armá-la de novo. A pausa por aba oculta continua sendo respeitada; para usar em segundo plano, marque também **Continuar quando a aba estiver oculta**. Não recarrega a página nem reinicia um navegador fechado ou congelado.

## Mover o painel

Arraste o título do painel com o mouse ou o dedo para posicioná-lo onde preferir. Os campos e botões continuam funcionando normalmente. O título fica dentro da tela para você poder mover o painel de novo. Ao recarregar o jogo, ele volta à posição inicial.

## Navegação para Caçada

O item do menu é localizado prioritariamente pelo título exato `title="Caçada (Alt + C)"`, inclusive quando o atributo está em um ícone ou elemento interno do controle. A navegação inicia em `document_start`, antes de criar o painel do bot. A extensão tenta abrir Caçada uma única vez pelo menu do jogo, aguardando o menu e a tela por até 15 segundos. Só depois exibe o painel, inclusive se for necessário informar uma falha de navegação. Se já estiver nela, não clica. Essa navegação não se repete durante o ciclo ou ao trocar manualmente de aba. Ao clicar em Iniciar, o bot também garante que está na tela correta antes de preparar a caçada. Após a exibição do painel, Pausar ou Ocultar painel cancela uma navegação de preparação em andamento.

## Expedição ativa ao iniciar

Após confirmar **Só o resultado** e validar as configurações, se o bot encontrar **Pausar expedição** ou o aviso **Herói em expedição**, ele pergunta no painel se deseja pausar a expedição. **Não, manter a expedição** mantém a expedição e a caçada não começa.

Com **Sim, pausar e começar a caçar**, o bot aciona o botão na Caçada. Se esse botão apenas abrir Expedição, ele aciona Pausar expedição nessa tela uma única vez e aguarda a confirmação da pausa por até 8 segundos. Depois volta para Caçada pelo menu esquerdo, aguarda a tela carregar, verifica que a expedição não continua ativa e confere **Só o resultado** antes de iniciar o ciclo. Sem confirmação da pausa, a caçada permanece parada. A expedição não é retomada automaticamente.

Pausar, ocultar o painel ou alterar as configurações cancela uma preparação em andamento, inclusive enquanto a pergunta estiver aberta. O fechamento automático de avisos não responde essa pergunta, pois ela fica dentro do painel da extensão.

## Fechamento automático de avisos

O fechamento inicia em `document_start`, antes do painel, e faz uma primeira verificação imediatamente. Um observador detecta alterações na página, com uma verificação adicional a cada 700 ms e antes de cada ciclo da caçada. Ele continua ativo com a caçada pausada ou o painel oculto.

- Resultados de atividades, incluindo vitória e derrota da Arena Livre: usa o botão `activity-result-continue` dentro de `activity-result-dialog`.
- Avisos em diálogos, modais e notificações: reconhece um único botão de dispensar, como Fechar, Entendi, OK ou ×. Também reconhece Entendi em tutoriais inline.
- O resultado da própria caçada permanece sob controle do ciclo original, para preservar a confirmação do ataque.
- Aguarda botões habilitados e limita tentativas de fechamento. Enquanto um aviso reconhecido permanece aberto, o ciclo não clica por trás dele.

O observador atua assim que a janela entra na página; não impede que o jogo a crie. O aviso **Nova versão disponível**, com o texto de atualização do Auren Online, é reconhecido mesmo sem marcação de diálogo. O bot clica no botão **Atualizar**, que recarrega o jogo. Se a caçada estava ativa, guarda temporariamente as escolhas e a ação pendente nesta aba e retoma após a recarga. Se estava pausada, continua aguardando Iniciar. A retomada vale por até dois minutos, é usada uma única vez e não se aplica a recargas comuns. Ações ainda sem confirmação continuam sendo acompanhadas para evitar repetir ataques ou poções. Botões genéricos de confirmar ou comprar não são acionados.

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

