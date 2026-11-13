# AurenBot

Extensão Chrome de caçada v3.3.22, com abas de Caçada e Expedição, renovação opcional de jornadas e avisos no Windows ou Android quando aparecer uma verificação.

## Instalar

1. Se recebeu o ZIP, extraia seu conteúdo para uma pasta permanente.
2. No Google Chrome, digite `chrome://extensions` na barra de endereços.
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e selecione a pasta `AurenBot` que contém o arquivo `manifest.json`.
5. Desative a versão anterior no Tampermonkey, se estiver instalada. Recarregue a página do Auren para encerrar scripts antigos do console.
6. Ao carregar, a extensão apenas abre Caçada uma única vez e exibe o painel pausado. As demais ações aguardam o clique em Iniciar. Depois disso você pode navegar pelo jogo livremente; não é necessário colar código no console.

## Usar

- Informe o nome exato da criatura disponível na região aberta.
- Escolha o vigor mínimo para atacar e o modo de recuperação.
- Configure os limites da poção de vigor maior e da poção de vigor.
- Ative **Economizar poções** e informe quantos pontos percentuais vale esperar regenerar.
- Para usar na VPS, marque **Continuar quando a aba estiver oculta** antes de clicar em Iniciar.
- Ao carregar, o bot apenas abre **Caçada** e mostra o painel dentro do jogo. Não seleciona a modalidade, não solicita pausa de expedição e não inicia a caçada nesse momento.
- Ao clicar em **Iniciar** no painel, o bot seleciona **Só o resultado** e valida as configurações. Uma expedição ativa pode continuar em paralelo. Se a manutenção de expedições estiver ativada, confere ou inicia a jornada e retorna à **Caçada**, reconfirmando **Só o resultado** antes de continuar.
- Configure a criatura e os limites na aba **Caçada**. Sem uma criatura configurada ou com valores inválidos, Iniciar mantém as duas automações paradas.
- Pausar, ocultar o painel ou alterar qualquer configuração cancela a preparação e a manutenção automática de expedições. Uma jornada que já partiu continua no jogo.
- O resultado da caçada é fechado pelo botão **Continuar**; depois o bot reavalia o vigor e repete o ciclo.
- Para parar, use **Pausar** no painel. **Ocultar painel** também pausa a automação.
- Para reabrir o painel oculto, clique no ícone da extensão. Ele abre diretamente o painel no jogo, sem popup intermediário e sem iniciar a automação.

As configurações são salvas localmente pela extensão neste perfil do Chrome. A cada carregamento, o bot abre Caçada e aguarda Iniciar, mesmo com configurações salvas. Por padrão, ocultar a aba também pausa a caçada.

## Vigor e poções

A leitura prioriza a barra de Vigor da caçada, inclusive quando o cabeçalho mostra uma expedição. A **Poção de vigor** recupera 40 pontos de vigor (40% da barra), e a **Poção de vigor maior** recupera 100 pontos (barra completa). Vigor em zero também permite recuperação, por poções ou regeneração, conforme suas escolhas. Os limites e preferências salvos são preservados: o limite da antiga poção de alívio passa a controlar a poção comum, e o da antiga restauradora passa a controlar a maior.

Na aba **Caçada**, marque **Usar poção comum quando a poção de vigor maior não estiver disponível** para permitir a substituição. Vem desmarcada e fica salva neste perfil. Alterar a opção pausa a automação; clique em **Iniciar** para aplicar.

Quando a decisão for usar a maior, mas seu botão estiver ausente ou indisponível, tenta usar uma única poção comum identificada e habilitada. Se a maior estiver habilitada, ela continua sendo a prioridade. Um botão marcado como ocupado não autoriza substituição. Se a comum também estiver indisponível ou ambígua, espera regenerar. O modo de regeneração e a economia de poções mantêm prioridade. Cada uso da comum aguarda a confirmação de recuperação de 40 pontos antes de reavaliar o vigor; não gasta várias poções de uma vez nem substitui a comum pela maior.

## VPS e aba oculta

A opção **Continuar quando a aba estiver oculta** vem desmarcada e fica salva neste perfil do Chrome. Com ela marcada, o bot mantém o ciclo quando o navegador informa que a aba ficou oculta, inclusive se isso acontecer ao minimizar a janela ou desconectar o RDP. Alterar essa opção pausa a caçada, assim como as demais configurações; clique em **Iniciar** para aplicar.

O Chrome e o jogo precisam continuar abertos na VPS. Desconectar o RDP é diferente de sair/encerrar a sessão do Windows, que fecha os aplicativos. O navegador ainda pode reduzir a frequência dos ciclos, congelar ou descartar a aba em segundo plano; esta opção apenas desativa a pausa por visibilidade e não impede essas limitações. Os controles **Pausar** e **Ocultar painel** continuam pausando a caçada, e as verificações de confirmação das ações continuam ativas.

## Falhas temporárias na leitura do vigor

Se o bot não conseguir ler o vigor do herói e não houver uma ação aguardando confirmação, mantém o ciclo ativo e tenta ler novamente a cada ciclo (intervalo nominal de 2,2 segundos). Enquanto a leitura estiver indisponível, não seleciona criaturas, não ataca nem usa poções. Quando o vigor voltar a ser identificado, reavalia as configurações com a leitura atual e continua automaticamente, sem precisar recarregar a página ou clicar em Iniciar.

Os controles Pausar e Ocultar painel continuam interrompendo a caçada, inclusive durante essa espera. As ações já pendentes continuam exigindo confirmação e respeitando seu prazo original, para evitar cliques duplicados. Uma leitura válida de vigor zero permite recuperação; vigor desconhecido não autoriza atacar nem usar poções. A extensão não recarrega a página automaticamente; se a interface não se recuperar, a mensagem de espera permanece no painel.

## Reinício automático após paradas por erro

Marque **Reiniciar automaticamente após uma parada por erro** e clique em **Iniciar** para armar a recuperação. A opção vem desmarcada e fica salva neste perfil. Uma preferência salva não inicia uma nova página por conta própria. Quando uma falha pausa uma caçada que estava em execução, o bot verifica a cada 10 segundos se pode repetir a preparação e retomar com as mesmas escolhas. Se a preparação falhar novamente, mantém as tentativas nesse intervalo.

Para retomar, aguarda uma leitura válida de vigor entre zero e 100%. Poções sem recuperação confirmada não são repetidas. Para um ataque sem resultado após 45 segundos, procura primeiro o botão **Ver resultados pendentes** e tenta abri-lo uma vez. Se não houver resultados pendentes, exige a tela de Caçada, Só o resultado confirmado, a criatura configurada selecionada, o botão de caçar habilitado e nenhum diálogo aberto. Após 10 segundos de estabilidade desses controles, encerra a espera pelo resultado ausente e reavalia um novo ciclo com o vigor atual. Isso confirma que a interface libera outro ciclo, sem afirmar se o ataque anterior foi processado. Mudanças nos controles, bloqueios e verificações reiniciam a observação. Se essas condições não forem atendidas, continua aguardando sem atacar. Expedições ativas não bloqueiam a caçada nem o reinício.

**Pausar**, **Ocultar painel**, **Conferir jogo** e alterações nas configurações cancelam a recuperação; clique em **Iniciar** para armá-la de novo. A pausa por aba oculta continua sendo respeitada; para usar em segundo plano, marque também **Continuar quando a aba estiver oculta**. Não recarrega a página nem reinicia um navegador fechado ou congelado.

## Notificações no Windows e Android

Para receber no Windows, execute o **AurenBot Alertas** no PC que receberá o aviso. O receptor abre uma página local com seu endereço, chave de acesso, teste de som e últimos avisos. As instruções completas e os comandos para compilar estão em [windows-alertas/README.md](windows-alertas/README.md).

No painel da extensão, clique em **Notificações: Windows e Android**. Em **Receber notificações em**, escolha **Windows** ou **Android**. Ative o envio de avisos, informe o endereço do receptor e sua chave, salve, autorize o acesso a esse endereço e envie um teste. Se o jogo roda na VPS, use o IP **Tailscale do dispositivo receptor** (PC ou celular), e mantenha ambos conectados à mesma rede Tailscale. `127.0.0.1` só serve quando jogo e receptor estão no mesmo computador.

Detecta as janelas **A guarda pede um sinal** e **De quem é esta sombra?**, inclusive com a caçada pausada ou o painel oculto. O PC mostra uma notificação nativa e emite um som, se habilitado no receptor. Por padrão, repete a cada minuto enquanto a janela permanecer aberta; essa repetição pode ser desmarcada. Após falhas de conexão, tenta novamente em 30 segundos. O painel informa quando o receptor confirmou o aviso ou quando houve falha. A confirmação significa que o receptor aceitou o evento, não que o Windows exibiu o balão ou que o usuário ouviu o som.

A configuração dos avisos pode ser alterada sem pausar a caçada. Nenhuma imagem, resposta de CAPTCHA, chave de IA ou dado do personagem é enviado: somente um identificador aleatório e o tipo de verificação. A chave do receptor é enviada no cabeçalho de autenticação. Use na rede local ou por Tailscale; não exponha a porta diretamente à Internet.

O executável precisa permanecer em execução, com o PC ligado e sem suspensão. Fechar a aba de configuração do receptor não encerra a aplicação. Os prazos e a automação aguardam a resolução manual da verificação.

A escolha **Android** exibe as instruções de instalação/conexão e identifica os campos do celular. O menu **Windows** mantém as instruções do PC. As configurações anteriores de endereço, chave, ativação e repetição são preservadas. Ao trocar o dispositivo, confira o endereço e a chave; o envio usa um receptor por vez. Alterações precisam ser salvas antes de enviar um teste. Configurar notificações não pausa a caçada.

## Receptor Android (APK)

O aplicativo **AurenBot Alertas para Android 1.0.0** recebe os mesmos avisos, com notificação nativa, som e vibração opcionais. Requer Android 8 ou posterior e funciona com a extensão v3.3.20 ou posterior, sem alterar a automação.

Instale o APK no celular, permita notificações e toque em **Iniciar receptor**. Conecte o celular e a VPS ao Tailscale e copie o endereço e a chave exibidos no aplicativo para o menu **Notificações: Windows e Android** da extensão, selecionando **Android**. Salve, autorize o endereço e envie um teste. A extensão envia para um receptor por vez; usar o endereço do celular substitui o destino Windows.

Para receber com a tela apagada, mantenha o serviço ligado e permita uso de bateria sem restrições para o aplicativo e o Tailscale. O receptor mantém a CPU acordada enquanto ligado, consumindo mais bateria; as políticas de rede e bateria do Android/fabricante ainda se aplicam. Não usa push externo. Após reiniciar o celular, abra o aplicativo e inicie novamente. Consulte [as instruções e o código do APK](android-alertas/README.md).

## Verificação do Cloudflare

Quando a janela **A guarda pede um sinal** aparece, o bot aguarda e não aciona ataques, poções, seleção de criaturas ou avisos atrás dela. O tempo em que a janela permanece aberta não consome os prazos de confirmação de ações e de preparação da caçada. Ao desaparecer, o acompanhamento continua com as ações pendentes preservadas. Pausar e Ocultar painel continuam interrompendo a caçada.

A extensão não interage com o CAPTCHA nem resolve desafios. Conclua a validação e clique manualmente em **Apresentar o selo**: o jogo exige um clique manual confiável mesmo quando o widget mostra Sucesso. O painel avisa quando o botão está pronto. A extensão não tenta simular esse clique nem acessa a resposta do widget.

Uma ação ainda sem confirmação depois da verificação continua sujeita ao prazo original de 45 segundos fora da verificação. A recuperação de ataques depende das condições descritas acima; poções continuam exigindo confirmação. As mensagens indicam o tipo da ação pendente, e **Conferir jogo** mostra também há quantos segundos ativos ela está aguardando. O diagnóstico não registra a resposta do Cloudflare.

## Mover o painel

Arraste o título do painel com o mouse ou o dedo para posicioná-lo onde preferir. Os campos e botões continuam funcionando normalmente. O título fica dentro da tela para você poder mover o painel de novo. Ao recarregar o jogo, ele volta à posição inicial.

## Navegação para Caçada

O item do menu é localizado prioritariamente pelo título exato `title="Caçada (Alt + C)"`, inclusive quando o atributo está em um ícone ou elemento interno do controle. A navegação inicia em `document_start`, antes de criar o painel do bot. A extensão tenta abrir Caçada uma única vez pelo menu do jogo, aguardando o menu e a tela por até 15 segundos. Só depois exibe o painel, inclusive se for necessário informar uma falha de navegação. Se já estiver nela, não clica. Essa navegação não se repete durante o ciclo ou ao trocar manualmente de aba. Ao clicar em Iniciar, o bot também garante que está na tela correta antes de preparar a caçada. Após a exibição do painel, Pausar ou Ocultar painel cancela uma navegação de preparação em andamento.

## Aba Expedição

Caçadas e expedições podem acontecer juntas. O bot não solicita nem aciona Pausar expedição para caçar.

Na aba **Expedição**, marque **Manter sempre em expedição** e escolha **15 minutos**, **1 hora** ou **4 horas**. Antes de ativar, selecione no jogo o território, grau e estratégia desejados para suas jornadas. A automação usa esse destino; não escolhe outro território nem muda sua estratégia. Clique em **Iniciar** para aplicar as escolhas junto com a caçada.

Se já houver uma jornada ativa, ela continua com sua duração original. Quando terminar, a próxima usa a duração configurada. Se houver uma jornada pausada, tenta retomá-la, preservando sua duração. Sem jornada ativa ou pausada, abre Expedição, confirma a duração e clica uma única vez em Explorar. Aguarda o jogo confirmar a partida, retorna para Caçada e reconfirma Só o resultado.

Enquanto a caçada está ativa, verifica a necessidade de uma nova jornada a cada 30 segundos, entre as ações da caçada. Não navega com um ataque, poção ou resultado ainda aguardando confirmação. Durante a navegação da expedição, o ciclo não clica na caçada. A alternância entre as abas do painel não pausa o bot; mudar as configurações pausa para aguardar um novo Iniciar.

Se não conseguir preparar uma jornada, informa a falha na aba Expedição e tenta voltar à Caçada. Uma partida ou retomada enviada mas ainda sem confirmação não é repetida automaticamente. O registro é preservado também na retomada após atualização do jogo. Confira a jornada no jogo se essa espera continuar. Falhas para retornar à Caçada pausam a automação para não atuar na tela errada.

**Pausar** e **Ocultar painel** interrompem as duas automações, incluindo navegações em andamento. Não cancelam nem abandonam uma expedição que já foi iniciada. A verificação do Cloudflare continua exigindo interação manual e suspende os prazos de preparação enquanto estiver aberta.

## Fechamento automático de avisos

O fechamento inicia em `document_start`, antes do painel, e faz uma primeira verificação imediatamente. Um observador detecta alterações na página, com uma verificação adicional a cada 700 ms e antes de cada ciclo da caçada. Ele continua ativo com a caçada pausada ou o painel oculto.

- Resultados de atividades, incluindo vitória e derrota da Arena Livre: usa o botão `activity-result-continue` dentro de `activity-result-dialog`.
- Check-in diário: reconhece o título e os textos do painel e aciona seu botão de fechar, inclusive quando a janela não tem marcação de diálogo ou o botão usa apenas um ícone X reconhecido. Não clica em Receber nem em recompensas. Funciona também com a caçada pausada ou o painel do bot oculto.
- Avisos em diálogos, modais e notificações: reconhece um único botão de dispensar, como Fechar, Entendi, OK ou ×. Também reconhece Entendi em tutoriais inline.
- O resultado da própria caçada permanece sob controle do ciclo original, para preservar a confirmação do ataque.
- Aguarda botões habilitados e limita tentativas de fechamento. Enquanto um aviso reconhecido permanece aberto, o ciclo não clica por trás dele.

O observador atua assim que a janela entra na página; não impede que o jogo a crie. O aviso **Nova versão disponível**, com o texto de atualização do Auren Online, é reconhecido mesmo sem marcação de diálogo. O bot clica no botão **Atualizar**, que recarrega o jogo. Se a caçada estava ativa, guarda temporariamente as escolhas e a ação pendente nesta aba e retoma após a recarga. Se estava pausada, continua aguardando Iniciar. A retomada vale por até dois minutos, é usada uma única vez e não se aplica a recargas comuns. Ações ainda sem confirmação continuam sendo acompanhadas para evitar repetir ataques ou poções. Botões genéricos de confirmar ou comprar não são acionados.

Pausar e Ocultar painel interrompem apenas a caçada. Para interromper também o fechamento de avisos, desative a extensão e recarregue o jogo.

## Exemplo

Ataque em 80%, poção de vigor maior até 30%, poção de vigor até 70%, economia de 5 pontos:

- Vigor a partir de 80%: atacar.
- Vigor até 30%: poção de vigor maior.
- Vigor acima de 30% e até 70%: poção de vigor.
- Vigor acima de 70% e abaixo de 80%: aguardar regeneração.
- A margem de economia e o modo somente regeneração têm prioridade sobre o uso de poções.

## Observações

A automação atua somente em `https://auren-online.com/` e `https://www.auren-online.com/`, pela interface visível. Usa armazenamento local. Os avisos opcionais solicitam acesso ao endereço do receptor informado pelo usuário; o envio parte do service worker da extensão. As demais configurações da automação permanecem locais.

Não execute o script de console junto com a extensão, nem duas versões da extensão na mesma página. Em uma atualização, clique em Recarregar na página de extensões e depois recarregue o jogo.

O painel e as regras vêm da versão 3.3. Alterações futuras na interface do jogo podem exigir atualização dos seletores. A extensão mantém a pausa diante de elementos ambíguos ou falta de confirmação.

