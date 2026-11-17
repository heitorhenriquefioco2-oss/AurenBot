# AurenBot

Extensão Chrome de caçada v3.3.29, com abas de Caçada, Expedição e Pausas, renovação opcional de jornadas e avisos no Windows ou Android quando aparecer uma verificação.

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
- Escolha até qual porcentagem de vigor usar a poção comum. Para usar a maior, ative o controle de fadiga.
- Ative **Economizar poções** e informe quantos pontos percentuais vale esperar regenerar.
- Para usar na VPS, marque **Continuar mesmo sem olhar a aba do jogo** antes de clicar em Iniciar.
- Ao carregar, o bot apenas abre **Caçada** e mostra o painel dentro do jogo. Não seleciona a modalidade, não solicita pausa de expedição e não inicia a caçada nesse momento.
- Ao clicar em **Iniciar** no painel, o bot seleciona **Só o resultado** e valida as configurações. Uma expedição ativa pode continuar em paralelo. Se a manutenção de expedições estiver ativada, confere ou inicia a jornada e retorna à **Caçada**, reconfirmando **Só o resultado** antes de continuar.
- Configure a criatura e os limites na aba **Caçada**. Sem uma criatura configurada ou com valores inválidos, Iniciar mantém as duas automações paradas.
- Pausar, ocultar o painel ou alterar qualquer configuração cancela a preparação e a manutenção automática de expedições. Uma jornada que já partiu continua no jogo.
- O resultado da caçada é fechado pelo botão **Continuar**; depois o bot reavalia o vigor e repete o ciclo.
- Para parar, use **Pausar** no painel. **Ocultar painel** também pausa a automação.
- Para reabrir o painel oculto, clique no ícone da extensão. Ele abre diretamente o painel no jogo, sem popup intermediário e sem iniciar a automação.

As configurações são salvas localmente pela extensão neste perfil do Chrome. A cada carregamento, o bot abre Caçada e aguarda Iniciar, mesmo com configurações salvas. Por padrão, ocultar a aba também pausa a caçada.

## Vigor e poções

A leitura prioriza a barra de Vigor da caçada, inclusive quando o cabeçalho mostra uma expedição. A **Poção de vigor** recupera 40 pontos de vigor. É a única poção escolhida para recuperar vigor, mesmo com o controle de fadiga desligado. Se acabar ou não puder ser usada, o bot espera a regeneração.

A **Poção de vigor maior** fica reservada para reduzir a fadiga quando o controle estiver ligado. Ela também enche o vigor, mas vigor baixo sozinho nunca autoriza seu uso. O campo **Usar a poção maior até (%)** e a opção de substituição foram removidos; preferências antigas desses campos são ignoradas. Cada poção usada ainda exige a confirmação do jogo antes da próxima ação.

## VPS e aba oculta

A opção **Continuar mesmo sem olhar a aba do jogo** vem desmarcada e fica salva neste perfil do Chrome. Com ela marcada, o bot mantém o ciclo quando o navegador informa que a aba ficou oculta, inclusive se isso acontecer ao minimizar a janela ou desconectar o RDP. Alterar essa opção pausa a caçada, assim como as demais configurações; clique em **Iniciar** para aplicar.

O Chrome e o jogo precisam continuar abertos na VPS. Desconectar o RDP é diferente de sair/encerrar a sessão do Windows, que fecha os aplicativos. O navegador ainda pode reduzir a frequência dos ciclos, congelar ou descartar a aba em segundo plano; esta opção apenas desativa a pausa por visibilidade e não impede essas limitações. Os controles **Pausar** e **Ocultar painel** continuam pausando a caçada, e as verificações de confirmação das ações continuam ativas.

## Falhas temporárias na leitura do vigor

Se o bot não conseguir ler o vigor do herói e não houver uma ação aguardando confirmação, mantém o ciclo ativo e tenta ler novamente a cada ciclo (intervalo nominal de 2,2 segundos). Enquanto a leitura estiver indisponível, não seleciona criaturas, não ataca nem usa poções. Quando o vigor voltar a ser identificado, reavalia as configurações com a leitura atual e continua automaticamente, sem precisar recarregar a página ou clicar em Iniciar.

Os controles Pausar e Ocultar painel continuam interrompendo a caçada, inclusive durante essa espera. As ações já pendentes continuam exigindo confirmação e respeitando seu prazo original, para evitar cliques duplicados. Uma leitura válida de vigor zero permite recuperação; vigor desconhecido não autoriza atacar nem usar poções. A extensão não recarrega a página automaticamente; se a interface não se recuperar, a mensagem de espera permanece no painel.

## Reinício automático após paradas por erro

Marque **Tentar continuar sozinho após um erro** e clique em **Iniciar** para armar a recuperação. A opção vem desmarcada e fica salva neste perfil. Uma preferência salva não inicia uma nova página por conta própria. Quando uma falha pausa uma caçada que estava em execução, o bot verifica a cada 10 segundos se pode repetir a preparação e retomar com as mesmas escolhas. Se a preparação falhar novamente, mantém as tentativas nesse intervalo.

Para retomar, aguarda uma leitura válida de vigor entre zero e 100%. Poções sem recuperação confirmada não são repetidas. Para um ataque sem resultado após 45 segundos, procura primeiro o botão **Ver resultados pendentes** e tenta abri-lo uma vez. Se não houver resultados pendentes, exige a tela de Caçada, Só o resultado confirmado, a criatura configurada selecionada, o botão de caçar habilitado e nenhum diálogo aberto. Após 10 segundos de estabilidade desses controles, encerra a espera pelo resultado ausente e reavalia um novo ciclo com o vigor atual. Isso confirma que a interface libera outro ciclo, sem afirmar se o ataque anterior foi processado. Mudanças nos controles, bloqueios e verificações reiniciam a observação. Se essas condições não forem atendidas, continua aguardando sem atacar. Expedições ativas não bloqueiam a caçada nem o reinício.

**Pausar**, **Ocultar painel**, **Pausar e conferir** e alterações nas configurações cancelam a recuperação; clique em **Iniciar** para armá-la de novo. A pausa por aba oculta continua sendo respeitada; para usar em segundo plano, marque também **Continuar mesmo sem olhar a aba do jogo**. Não recarrega a página nem reinicia um navegador fechado ou congelado.

## Limite de fadiga

Na aba **Caçada**, marque **Manter a fadiga abaixo do limite** e preencha **Limite de fadiga, em pontos**. A opção vem desligada e fica salva neste perfil do Chrome. Clique em **Iniciar** para aplicar. Use um número inteiro de 2 ou mais; esse valor é uma contagem de pontos, não uma porcentagem de vigor.

O vigor e a fadiga são controles diferentes. Com esta opção ligada:

- Só a **poção comum** é escolhida para recuperar vigor, conforme seu modo de recuperação, vigor mínimo, limite da comum e economia de poções. Se ela acabar, o bot espera; não gasta a maior só para recuperar vigor.
- A **poção maior** é reservada para baixar a fadiga. No jogo atual, reduz até 15 pontos e também recupera 100 de vigor. Ela pode ser usada para fadiga mesmo se você escolheu esperar o vigor voltar sozinho.
- Cada vitória soma 1 de fadiga. Antes de lutar, o bot confere se a próxima vitória alcançaria o limite. Com limite **100**, por exemplo, só luta quando a vitória ainda deixa a fadiga em no máximo **99**. Se estiver em 99, tenta baixar a fadiga primeiro. Limites pequenos podem gastar mais poções maiores.
- A confirmação da maior depende de a fadiga cair para o valor previsto nos detalhes do jogo. Encher o vigor, sozinho, não libera outro clique. Mantém as regras de espera, erro e retomada, inclusive após a atualização do jogo.

**Limitação do jogo:** a poção maior fica indisponível com vigor cheio. Se isso acontecer, o bot aguarda para não iniciar uma luta que alcance o limite. Quando ela acaba, também aguarda, a menos que você ative a fabricação automática descrita abaixo. Se você já estiver muito acima do limite, uma única poção pode não ser suficiente: o bot não faz lutas acima do limite para tentar liberar mais poções. Ajuste o limite ou reduza a fadiga no jogo antes de continuar, se necessário.

A leitura abre os **Detalhes do Vigor** pela interface do jogo e usa o valor atual da fadiga, não o custo em vigor, a porcentagem da barra, a previsão após a poção ou o total de caçadas do dia. A categoria **Descansado** não é tratada como zero, pois também inclui pontos de fadiga. Quando não encontra uma leitura exata, aguarda sem lutar nem usar poções. Não consulta dados internos do personagem nem faz chamadas diretas às APIs do jogo.

Desligar o controle de fadiga interrompe o uso automático da poção maior. A recuperação de vigor continua usando apenas a comum. As pausas programadas esperam uma poção pendente terminar; após o descanso, a fadiga é conferida de novo antes da próxima ação. Os avisos de verificação e as expedições continuam seguindo suas próprias opções.

## Fabricar poções maiores

Na aba **Caçada**, ative o controle de fadiga e marque **Fabricar poções de vigor maior se necessário**. A escolha fica salva. Quando a fadiga exigir uma poção maior e o estoque estiver zerado, o bot vai à **Oficina**, escolhe **Caldeirão → Poções → Poção de vigor maior** e seleciona **uma unidade**.

Antes de preencher a receita, confere se você tem **1 Olho de corvo ou 1 Coração de serpente, mais 1.900 de ouro**. Mantém a parte sugerida se ela for uma dessas duas e estiver disponível. Caso contrário, procura a outra opção no seletor de ingredientes. Preenche, confere os encaixes e confirma a fabricação uma vez. Depois que o jogo confirma o resultado ou mostra a nova poção no estoque, volta à **Caçada**, marca **Só o resultado** e confere a fadiga. Não compra ingredientes.

**Se as duas partes estiverem em falta ou não houver ouro suficiente**, volta à Caçada e ignora o limite de fadiga enquanto não puder fabricar. Continua recuperando vigor só com a poção comum, conforme suas escolhas. Se a fadiga ainda exigir uma poção maior, confere os recursos novamente a cada minuto, entre as ações do jogo. Se receber uma poção maior ou voltar a ter ingredientes, aplica o limite de fadiga de novo. Desmarcar a fabricação automática também encerra essa exceção.

Uma leitura incompleta, receita diferente ou botão bloqueado não é tratada como falta de recursos. Nesses casos o bot espera ou pausa e explica o que precisa ser conferido. Se o jogo não confirmar a fabricação, preserva a ação em espera para evitar outro gasto de ingredientes e ouro. Pausar e alterar opções interrompem a navegação. As verificações do jogo continuam exigindo sua resposta e não contam no tempo de espera da fabricação.

## Pausas automáticas

Na aba **Pausas**, marque **Fazer pausas automáticas**. Escolha duas faixas em minutos:

- **Tempo antes da pausa**: o mínimo e o máximo de tempo que o bot deve ficar ligado antes de descansar. O padrão é de 20 a 40 minutos.
- **Tempo de descanso**: o mínimo e o máximo que cada pausa pode durar. O padrão é de 2 a 5 minutos.

Use números inteiros de 1 a 1440 minutos, sempre com o mínimo igual ou menor que o máximo. O sorteio inclui os valores mínimo e máximo. Para um tempo fixo, coloque o mesmo número nos campos mínimo e máximo.

Clique em **Iniciar** para aplicar. A opção vem desligada, e os campos ficam salvos neste perfil do Chrome. O bot sorteia os dois tempos quando a caçada começa. Ao terminar o descanso, confere o jogo e sorteia novamente para a próxima pausa. A aba mostra quanto falta e a duração sorteada; durante o descanso, o painel informa **Em pausa**.

A pausa só começa entre as ações. O bot espera o ataque, a poção ou o fechamento do resultado terminar. As mesmas regras de espera e erro continuam valendo: uma ação sem confirmação não é abandonada para entrar em descanso. Por isso, a pausa pode começar depois do horário previsto.

Durante o descanso, não luta, não usa poções e não inicia ou retoma expedições. Uma expedição que já partiu continua no jogo; se terminar, a próxima aguarda o fim do descanso. Os avisos que você ativou e o fechamento de avisos do jogo continuam funcionando. Se uma verificação estiver aberta ao terminar o descanso, o bot espera sua resposta antes de voltar.

**Pausar**, **Ocultar painel**, **Pausar e conferir** ou mudar uma opção cancela os horários sorteados e impede a volta sozinha. Clique em **Iniciar** para sortear de novo. A opção **Continuar mesmo sem olhar a aba do jogo** também continua sendo respeitada, inclusive ao preparar a volta do descanso.

Uma recarga comum mantém o bot parado. Na atualização do jogo acionada pelo bot, ele guarda o horário da pausa e, se estiver descansando, mantém o tempo restante sem iniciar ações ou navegar antes da hora. Essa retomada usa a mesma janela de dois minutos descrita na atualização automática. O relógio do computador e a disponibilidade do Chrome determinam os horários; uma aba lenta ou suspensa pode atrasá-los.

## Notificações no Windows e Android

Para receber no Windows, execute o **AurenBot Alertas** no PC que receberá o aviso. O receptor abre uma página local com seu endereço, chave de acesso, teste de som e últimos avisos. As instruções completas e os comandos para compilar estão em [windows-alertas/README.md](windows-alertas/README.md).

No painel da extensão, abra **Configurar avisos**. Ative **Receber avisos** e marque **Enviar para o PC**, **Enviar para o celular** ou os dois. Cada dispositivo possui seus próprios campos de endereço e chave. Preencha os dados de ambos, clique em **Salvar configurações** e permita acesso aos endereços escolhidos. Use **Testar no PC**, **Testar no celular** ou **Testar avisos** para verificar cada conexão.

A partir da v3.3.23, os dois dispositivos recebem simultaneamente. O endereço e a chave de cada um ficam salvos localmente neste perfil do Chrome, inclusive quando seu envio é desmarcado ou quando as notificações são desativadas. Reabrir a página restaura os dois perfis; não é necessário copiar os dados novamente ao alternar o envio.

A configuração antiga de um único receptor é recuperada no perfil Windows ou Android conforme a escolha que estava salva. Se não havia uma escolha registrada, mantém os dados em Windows. O outro perfil fica vazio e desmarcado para você preencher. Nada é copiado entre as chaves dos dois dispositivos. Clique em Salvar para gravar o formato novo.

Se o jogo roda na VPS, use o IP **Tailscale de cada receptor** e mantenha a VPS, o PC e o celular conectados à mesma rede Tailscale. `127.0.0.1` só serve quando jogo e receptor estão no mesmo computador. O executável do Windows e o APK Android existentes continuam compatíveis; não precisam ser reinstalados para usar o envio simultâneo.

Detecta as janelas **A guarda pede um sinal** e **De quem é esta sombra?**, inclusive com a caçada pausada ou o painel oculto. Cada receptor mostra uma notificação nativa e usa o som conforme suas configurações locais. Por padrão, repete a cada minuto enquanto a janela permanecer aberta; essa repetição pode ser desmarcada. Cada dispositivo tem seus próprios prazos de tentativa e confirmação. Após uma falha, tenta novamente aquele receptor em 30 segundos, preservando o identificador da tentativa para evitar duplicação caso a confirmação tenha se perdido. O dispositivo que já confirmou continua recebendo seus lembretes normalmente, mesmo se o outro estiver offline.

O painel e os testes mostram o resultado por dispositivo. A confirmação significa que o receptor aceitou o evento, não que o sistema exibiu a notificação ou que o usuário ouviu o som. Fechar a verificação encerra os lembretes e novas tentativas nos dois destinos.

A configuração dos avisos pode ser alterada sem pausar a caçada. Nenhuma imagem, resposta de CAPTCHA, chave de IA ou dado do personagem é enviado: somente um identificador aleatório e o tipo de verificação. A chave de cada receptor é enviada somente no cabeçalho de autenticação de sua própria conexão. Use na rede local ou por Tailscale; não exponha a porta diretamente à Internet.

Os receptores precisam permanecer ligados. Fechar a aba de configuração do Windows não encerra sua aplicação. Os prazos e a automação aguardam a resolução manual da verificação. Alterações na página de configuração precisam ser salvas antes de enviar um teste.

## Receptor Android (APK)

O aplicativo **AurenBot Alertas para Android 1.0.0** recebe os mesmos avisos, com notificação nativa, som e vibração opcionais. Requer Android 8 ou posterior e funciona com a extensão v3.3.20 ou posterior, sem alterar a automação.

Instale o APK no celular, permita notificações e toque em **Ligar avisos**. Conecte o celular e a VPS ao Tailscale e copie o endereço e a chave exibidos no aplicativo para o menu **Configurar avisos** da extensão, marcando **Enviar para o celular** e preenchendo os campos do celular. Salve, autorize o endereço e envie um teste. Marque também Windows para receber nos dois ao mesmo tempo.

Para receber com a tela apagada, mantenha o serviço ligado e permita uso de bateria sem restrições para o aplicativo e o Tailscale. O receptor mantém a CPU acordada enquanto ligado, consumindo mais bateria; as políticas de rede e bateria do Android/fabricante ainda se aplicam. Não usa push externo. Após reiniciar o celular, abra o aplicativo e inicie novamente. Consulte [as instruções e o código do APK](android-alertas/README.md).

## Verificação do Cloudflare

Quando a janela **A guarda pede um sinal** aparece, o bot aguarda e não aciona ataques, poções, seleção de criaturas ou avisos atrás dela. O tempo em que a janela permanece aberta não consome os prazos de confirmação de ações e de preparação da caçada. Ao desaparecer, o acompanhamento continua com as ações pendentes preservadas. Pausar e Ocultar painel continuam interrompendo a caçada.

A extensão não interage com o CAPTCHA nem resolve desafios. Conclua a validação e clique manualmente em **Apresentar o selo**: o jogo exige um clique manual confiável mesmo quando o widget mostra Sucesso. O painel avisa quando o botão está pronto. A extensão não tenta simular esse clique nem acessa a resposta do widget.

Uma ação ainda sem confirmação depois da verificação continua sujeita ao prazo original de 45 segundos fora da verificação. A recuperação de ataques depende das condições descritas acima; poções continuam exigindo confirmação. As mensagens indicam o tipo da ação pendente, e **Pausar e conferir** mostra também há quantos segundos ativos ela está aguardando. O diagnóstico não registra a resposta do Cloudflare.

## Mover o painel

Arraste o título do painel com o mouse ou o dedo para posicioná-lo onde preferir. Os campos e botões continuam funcionando normalmente. O título fica dentro da tela para você poder mover o painel de novo. Ao recarregar o jogo, ele volta à posição inicial.

## Navegação para Caçada

O item do menu é localizado prioritariamente pelo título exato `title="Caçada (Alt + C)"`, inclusive quando o atributo está em um ícone ou elemento interno do controle. A navegação inicia em `document_start`, antes de criar o painel do bot. A extensão tenta abrir Caçada uma única vez pelo menu do jogo, aguardando o menu e a tela por até 15 segundos. Só depois exibe o painel, inclusive se for necessário informar uma falha de navegação. Se já estiver nela, não clica. Essa navegação não se repete durante o ciclo ou ao trocar manualmente de aba. Ao clicar em Iniciar, o bot também garante que está na tela correta antes de preparar a caçada. Após a exibição do painel, Pausar ou Ocultar painel cancela uma navegação de preparação em andamento.

## Aba Expedição

Caçadas e expedições podem acontecer juntas. O bot não solicita nem aciona Pausar expedição para caçar.

Na aba **Expedição**, marque **Iniciar outra expedição quando a atual terminar** e escolha **15 minutos**, **1 hora** ou **4 horas**. Antes de ativar, selecione no jogo o território, grau e estratégia desejados para suas jornadas. A automação usa esse destino; não escolhe outro território nem muda sua estratégia. Clique em **Iniciar** para aplicar as escolhas junto com a caçada.

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

Com o controle de fadiga desligado:

Ataque em 80%, poção comum até 70%, economia de 5 pontos:

- Vigor a partir de 80%: atacar.
- Vigor até 70%: poção comum. Se ela acabar, aguarda regeneração.
- Vigor acima de 70% e abaixo de 80%: aguardar regeneração.
- A margem de economia e o modo somente regeneração têm prioridade sobre o uso de poções.

## Observações

A automação atua somente em `https://auren-online.com/` e `https://www.auren-online.com/`, pela interface visível. Usa armazenamento local. Os avisos opcionais solicitam acesso ao endereço do receptor informado pelo usuário; o envio parte do service worker da extensão. As demais configurações da automação permanecem locais.

Não execute o script de console junto com a extensão, nem duas versões da extensão na mesma página. Em uma atualização, clique em Recarregar na página de extensões e depois recarregue o jogo.

O painel e as regras vêm da versão 3.3. Alterações futuras na interface do jogo podem exigir atualização dos seletores. A extensão mantém a pausa diante de elementos ambíguos ou falta de confirmação.


## Testes de notificações

Os testes do envio simultâneo e da migração usam Node.js 20 ou posterior, sem dependências externas:

```bash
node --test tests/notificacoes-background.cjs
```

Para os testes de interface e do observador, instale Playwright no seu ambiente de desenvolvimento e seu Chromium. É possível informar `PLAYWRIGHT_MODULE` com o caminho do módulo e `CHROMIUM_PATH` com o executável, ou usar a instalação padrão:

```bash
node tests/notificacoes-ui.cjs
node tests/notificacoes-observador.cjs
```

A integração `tests/notificacoes-receptores.cjs` usa o receptor Go na porta 18765 e a fixture Java `ProtocolTest serve` na porta 18766. Informe `WINDOWS_TEST_CONFIG` com o caminho do arquivo de configuração de teste do Go. A fixture Java usa somente uma chave fixa de teste; não a configure em um celular real. Essa integração verifica protocolo e recebimento, sem validar som ou notificações nativas dos dispositivos.

## Testes das pausas

Os testes usam Playwright com o relógio acelerado e páginas de jogo simuladas, sem agir em uma conta real. Use a instalação e as variáveis de ambiente descritas nos testes de notificações:

```bash
node tests/pausas.cjs
node tests/pausas-expedicao.cjs
```

Para executar um cenário específico do primeiro arquivo, informe `TEST_FILTER` com parte do nome do teste.

## Testes do controle de fadiga

Com a mesma instalação de Playwright dos testes anteriores:

```bash
node tests/fadiga.cjs
```

Os cenários usam páginas simuladas com o painel de detalhes e o componente de janela do navegador, baseados na interface pública do jogo. Cobrem leitura dos pontos, limite estrito antes da vitória, função de cada poção, falta de estoque, vigor cheio, confirmação e retomada, além de pausas e recargas. Não realizam ações em uma conta real.

## Testes da fabricação

```bash
node tests/fabricacao.cjs
```

Usam uma oficina simulada com os controles da interface pública: estoque, receita, quantidade, ingredientes, ouro, confirmação, retorno à caçada, falta de recursos, nova conferência e interrupções. Não gastam recursos de uma conta real.
