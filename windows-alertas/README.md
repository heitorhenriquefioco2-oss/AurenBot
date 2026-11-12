# AurenBot Alertas para Windows

Receptor portátil de notificações da extensão AurenBot v3.3.20. Execute no **PC Windows que deve tocar o som**; o jogo pode continuar na VPS Ubuntu. Não requer Python, Node, chave de IA ou instalação de bibliotecas. O executável fornecido é para Windows x64.

## Configurar

1. Extraia o pacote e execute **AurenBot-Alertas.exe** no PC Windows, dentro da sua sessão de usuário. Ele abre o painel em **http://127.0.0.1:8765**.
2. Clique em **Testar notificação do Windows**. Deixe **Emitir aviso sonoro neste PC** marcado.
3. Se o jogo roda na VPS, conecte a VPS e o PC Windows à mesma rede Tailscale. No painel do receptor, selecione o endereço `http://100.x.x.x:8765` do **PC Windows**. Na mesma rede física, pode usar o IP local do PC. Se jogo e receptor rodam no mesmo PC, use `http://127.0.0.1:8765`.
4. Atualize/recarregue a extensão no Chrome onde o jogo roda e recarregue o jogo. No painel do bot, clique em **Configurar avisos no Windows**.
5. Marque **Enviar avisos ao meu PC**, cole o endereço e a chave copiados do receptor, clique em **Salvar e autorizar endereço** e aceite a permissão de acesso ao receptor.
6. Clique em **Enviar aviso de teste** na extensão. Ela deve confirmar o recebimento, e o PC Windows deve emitir o alerta. Esse teste verifica também a conexão entre VPS e PC.

O receptor avisa sobre **A guarda pede um sinal** e **De quem é esta sombra?**. A resolução continua manual no jogo; use o VNC no PC ou no Android. O aviso também funciona com a caçada pausada. A repetição a cada minuto pode ser desativada na extensão.

Você pode fechar a aba do navegador do receptor: o executável continua ligado. Para abrir o painel novamente, acesse http://127.0.0.1:8765. Para parar, clique em **Encerrar receptor**. Depois de reiniciar o PC, abra o executável novamente. Opcionalmente, coloque um atalho para ele em `shell:startup` (Win+R) para iniciar após entrar no Windows.

## Se o teste não chegar

- Confirme que o receptor está aberto e que o PC está ligado, conectado e sem suspensão.
- Se usar Tailscale, confira se ambos estão conectados e se as regras da sua rede permitem a conexão da VPS para o PC na porta TCP 8765.
- Na VPS, não use `127.0.0.1`: esse endereço aponta para a própria VPS.
- Confira a chave e salve novamente para conceder a permissão do endereço à extensão.
- Se o receptor confirmar mas o balão não aparecer, confira **Não incomodar/Assistente de foco**, as notificações e o volume do Windows. O teste local ajuda a separar áudio/notificações de problemas de rede. A aceitação HTTP não comprova que o balão foi exibido.
- Se o firewall do Windows bloquear o receptor, permita sua entrada na porta TCP 8765 somente pelas redes usadas. Um exemplo no PowerShell **como administrador**, para LAN/Tailscale, é:

```powershell
New-NetFirewallRule -DisplayName "AurenBot Alertas" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8765 -RemoteAddress LocalSubnet,100.64.0.0/10
```

Não abra/encaminhe essa porta no roteador para a Internet. O HTTP deve ficar restrito à rede local ou ao túnel criptografado do Tailscale. Não envie a chave a terceiros.

## Dados e funcionamento

- A primeira execução gera uma chave aleatória, salva com a preferência de som em `%AppData%\AurenBotAlertas\config.json`.
- Para trocar a chave, encerre o receptor, remova esse arquivo e abra novamente. Atualize a chave na extensão em seguida.
- O painel de configuração e a chave só ficam disponíveis por loopback, no próprio PC. O endpoint de avisos aceita conexões de rede com autenticação Bearer.
- Recebe somente `{ "id": "identificador", "tipo": "cloudflare ou sombra" }`. Não recebe imagens, resposta da verificação, dados do personagem ou chaves de IA.
- Guarda os últimos 50 eventos em memória. Ao encerrar, esse histórico é perdido. IDs repetidos não geram novo aviso por até 24 horas enquanto o processo estiver aberto. Há um limite de um aviso novo a cada 10 segundos.
- O executável incorpora sua página de configuração. Ele escuta em todas as interfaces IPv4, na porta 8765, para receber da VPS ou de outro PC. O acesso depende também do firewall e das regras do Tailscale.
- O Windows usa notificações nativas da área de notificação e seu som de alerta. Não depende de uma aba do navegador aberta ou da permissão de notificações de um site.

## Compilar a partir do código

Para desenvolvimento, use Go 1.22 ou posterior. Não há dependências externas.

No PowerShell, dentro da pasta `windows-alertas`:

```powershell
go test -race ./...
$env:GOOS = "windows"
$env:GOARCH = "amd64"
$env:CGO_ENABLED = "0"
go build -trimpath -ldflags="-s -w -H=windowsgui" -o AurenBot-Alertas.exe .
```

O teste com `-race` exige um compilador C disponível; sem ele, use `go test ./...`. A compilação do executável não exige C.

A versão Linux do servidor permite verificar HTTP e o painel, mas **não gera notificações ou som no Windows remoto**. Para isso, execute o receptor no Windows.

Argumentos opcionais: `-port 8765`, `-headless` (não abre o painel) e `-config caminho-do-arquivo.json`. Se mudar a porta, use a mesma no endereço informado à extensão e no firewall.
