# AurenBot Alertas para Android — 1.0.0

APK receptor para **Android 8.0 ou posterior**. Funciona com a extensão AurenBot **v3.3.20 ou posterior**, inclusive v3.3.21. Não requer o programa do Windows nem uma chave de IA. O código e os recursos são Java/Android nativos, sem bibliotecas externas dentro do APK, e não incluem código nativo de uma arquitetura específica.

## Instalar e conectar

1. Copie o APK fornecido para o celular, abra-o e autorize sua instalação quando o Android solicitar.
2. Abra **AurenBot Alertas**, toque em **Iniciar receptor** e permita as notificações. Use **Testar notificação neste celular** para conferir som, vibração e volume.
3. Conecte a VPS e o celular à mesma rede Tailscale. Atualize os endereços no aplicativo e escolha o endereço do **celular** `http://100.x.x.x:8765`. Em uma mesma rede Wi-Fi, também é possível usar o IP local do celular.
4. Toque em **Copiar endereço do celular** e **Copiar chave de acesso**. Na extensão v3.3.22 ou posterior, abra **Notificações: Windows e Android** e selecione **Android**. Nas versões v3.3.20/v3.3.21, use o botão antigo **Configurar avisos no Windows**, que também aceita o receptor Android.
5. Ative os avisos, substitua endereço e chave pelos do Android, clique em **Salvar e autorizar endereço** e envie o teste da extensão. A confirmação deve aparecer na extensão e no celular deve chegar uma notificação.
6. Se quiser lembretes, marque a opção de repetir a cada minuto na extensão. Eles param quando a janela da verificação desaparecer.

A configuração atual da extensão aponta para **um receptor por vez**. Ao trocar o endereço do Windows pelo celular, os próximos avisos irão para o celular. Copiar a chave entre dispositivos pode ser feito pelos meios habituais de sua rede; não a publique nem compartilhe com terceiros.

A notificação pede sua interação no jogo; conclua a verificação manualmente pelo VNC. O aplicativo não resolve CAPTCHAs nem recebe imagens deles.

## Receber com a tela apagada

- Deixe o receptor ligado: há uma notificação fixa com a opção **Parar**. Sair da tela do aplicativo não encerra o serviço.
- Nas configurações de bateria, permita execução **sem restrições** para AurenBot Alertas e para Tailscale. Alguns fabricantes também exigem permissão de início/execução em segundo plano. O botão de bateria abre as configurações do Android.
- O serviço mantém a CPU acordada enquanto está ligado, aumentando o consumo de bateria. Isso não impede o Android ou o fabricante de restringir a rede ou encerrar o processo. Teste o envio da VPS depois de deixar a tela apagada por alguns minutos.
- **Não incomodar**, configurações dos canais, volume e o gerenciamento de notificações do Android podem silenciar ou reduzir os avisos. Som e vibração são selecionáveis no app; o Android mantém o controle final sobre os canais.
- Após reiniciar ou forçar o encerramento do aplicativo, abra-o e inicie o receptor novamente. Não há inicialização automática após reiniciar o celular.
- Não há Firebase/push externo. VPS e celular precisam manter conexão de rede entre si. Para celular fora do Wi-Fi, use Tailscale, com as regras permitindo a porta TCP 8765 do celular.

## Segurança e dados

O receptor escuta em todas as interfaces IPv4 na porta **8765**. Use somente rede local ou Tailscale; não encaminhe a porta para a Internet. O HTTP pelo Tailscale trafega dentro do túnel criptografado da VPN. Pela rede Wi-Fi comum, o HTTP não acrescenta criptografia.

Uma chave de 256 bits é gerada na primeira execução e guardada no armazenamento privado do app, junto com a preferência de som e o último evento. A chave só é exibida mascarada e copiada por ação do usuário. Não há painel administrativo HTTP nem endpoint que revele a chave. Desinstalar/limpar os dados do aplicativo gera uma chave diferente na próxima execução; atualize-a na extensão.

Recebe somente o identificador aleatório do evento e seu tipo (`cloudflare` ou `sombra`). Aplica autenticação Bearer, limite de corpo de 4096 bytes, deduplicação por até 24 horas durante a vida do serviço e limite de um novo aviso por dez segundos. Mantém até 4096 identificadores em memória; reiniciar o serviço limpa essa deduplicação. O último aviso recebido fica salvo localmente até limpar os dados/desinstalar.

A resposta HTTP de sucesso confirma que a notificação foi solicitada ao Android. Não confirma que apareceu na tela, que fez som ou que foi lida. As configurações do sistema continuam tendo prioridade.

Permissões: rede, estado da rede, serviço em primeiro plano para comunicação com outro dispositivo, notificações, vibração e manutenção da CPU acordada. `CHANGE_NETWORK_STATE` é um pré-requisito normal do tipo de serviço Android usado; o app não altera configurações de rede. Não usa câmera, contatos, acessibilidade, localização ou captura de tela.

## Compilar

Use Linux/macOS com Bash, Java 17+ e Android SDK **Platform 35 / Build Tools 35.0.0**, disponíveis pelo Android Studio/SDK Manager oficial. O APK pode ser compilado com `javac`; alternativamente, informe `ECJ_JAR` apontando para o compilador Eclipse ECJ 3.41.0. O ambiente de desenvolvimento desta versão usou Java 21 e ECJ, com os pacotes SDK oficiais verificados pelos checksums do repositório do Android.

O script requer uma chave de assinatura PKCS12 com alias `aurenbot` e senha da chave igual à do armazenamento. Crie-a fora do repositório com `keytool`. Guarde a chave e sua senha com segurança: instalar uma atualização sobre um APK existente exige a mesma assinatura. A chave privada do APK fornecido não é publicada no repositório.

```bash
export ANDROID_JAR="$ANDROID_SDK_ROOT/platforms/android-35/android.jar"
export BUILD_TOOLS="$ANDROID_SDK_ROOT/build-tools/35.0.0"
export KEYSTORE="/caminho/privado/aurenbot.p12"
export KEYSTORE_PASSWORD_FILE="/caminho/privado/senha.txt"
# Opcional: export ECJ_JAR="/caminho/ecj-3.41.0.jar"
# Opcional: export OUTPUT_APK="/caminho/AurenBot-Alertas.apk"
./build.sh
```

A compilação empacota recursos com AAPT2, compila Java 8, converte com D8, alinha e assina o APK com os utilitários oficiais do SDK. O script verifica a assinatura e o alinhamento. Os arquivos em `build/` e chaves não devem ser versionados.

## Testes

Os testes Java usam a implementação real do servidor HTTP e da validação/deduplicação. Para executá-los, obtenha **JSON-java 20240303** (`org.json:json`, usado somente nos testes; no APK a implementação vem do próprio Android), informe `JSON_TEST_JAR` e execute:

```bash
export JSON_TEST_JAR="/caminho/json-20240303.jar"
./tests/run.sh
```

A integração opcional usa Node.js 20+ e o `background.js` real da extensão. Ela abre temporariamente o servidor de teste em `127.0.0.1:18766` com uma chave fixa de teste, encerrando-o no fim. Execute dentro desta pasta:

```bash
java -cp "build/tests:$JSON_TEST_JAR" com.aurenbot.alertas.ProtocolTest serve &
receiver_pid=$!
trap 'kill "$receiver_pid" 2>/dev/null || true' EXIT
node tests/background-integration.cjs
```

Validação realizada: 23 cenários de protocolo/estado, cinco verificações de comunicação com o código da extensão e verificação da assinatura/estrutura do APK. Não foi executado em aparelho/emulador Android neste ambiente; notificação, som, execução em segundo plano e acesso Tailscale devem ser conferidos no celular pelos dois botões de teste.
