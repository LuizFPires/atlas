# App desktop (Electron) — pendências para /entregar

O CI (ubuntu) só roda eslint, tsc, vitest e o build do front. `electron` e `electron-builder` NÃO são dependências do projeto (mantém o `npm ci` leve); `app/` (main.cjs, preload.cjs, cofre.cjs) não é compilado nem linta no CI. A API do Electron fica atrás de `src/app/ponte.ts` (interface testável).

- **Cofre real (Windows Credential Manager / DPAPI).** `app/cofre.cjs` só tem o cofre em memória e falha fechado sem `ATLAS_COFRE=fixture`. Falta o adaptador nativo (ex.: `@napi-rs/keyring` ou `keytar`) implementando `guardar/ler/apagar` para a chave `atlas/dispositivo`. O token do dispositivo NUNCA pode ir para arquivo, localStorage ou log. Sem ele, o app pede ativação a cada abertura.
- **Empacotar e assinar.** `npm run build:app` gera `dist-app/` (caminhos relativos, sem PWA). Falta empacotar `app/` + `dist-app/` como `Atlas.exe` (electron-builder, versão exata), assinar (Azure Trusted Signing, ver `instalador/PENDENTE-ENTREGAR.md`) e testar em Windows limpo. O instalador (M8) já chama `Atlas.exe --tela=F02`.
- **Token do link de instalação.** `/ativar/confirmar` exige o token de uso único do link (~48 h). O app lê `--token=...` da linha de comando; o instalador (M8) ainda precisa repassar esse valor ao abrir o app (hoje só passa `--tela=F02`). Sem token a tela avisa com um recado amigo.
- **Reconhecimento de voz no Electron.** O `SpeechRecognition` do Chromium dentro do Electron não funciona sem chaves do Google. Para "tudo pode ser falado" valer no app é preciso um motor de transcrição (ex.: Whisper local ou serviço do Atlas). A interface (`useVoz`) já isola isso; no navegador funciona.
- **Progresso da instalação.** `Ativacao` aceita `progresso` (percentual/restante); falta o instalador (M8) publicar o andamento real para o app.
- **Ids reais do plugin e PLUGIN_SHA256** (`instalador/passos.ts`): seguem placeholder (empacotamento do kit como plugin fica para o M26); o instalador falha fechado.
- **Bloqueio de sono na obra.** `useImpedirSono` está ligado durante a instalação; o M-da-obra deve chamá-lo enquanto houver obra rodando.

## M10 — Conectar o Claude (F03)
- **Adaptador real do `PonteClaude`** (`src/app/ponte-claude.ts`): hoje só existe o mock `criarClaudeFixture` (modo fixture) e `claudeIndisponivel` (produção sem adaptador: não finge conexão). Falta, no Electron (preload + main), implementar: `abrirLogin` (abrir claude.ai/login no navegador do cliente e iniciar o login do Claude Code do PRÓPRIO cliente; o Atlas nunca vê senha, código nem token), `abrirSite('criar-conta'|'planos')` (`shell.openExternal` só com URLs fixas do claude.ai), `estado` (rodar o CLI do Claude e ler conta e plano Pro/Max), `renovarConexao` (reentrar/renovar a sessão para o plano novo aparecer). Expor em `window.atlasDesktop.claude`/injetar em `AppDesktop` (prop `claude`). NÃO guardar segredo em arquivo; o CLI guarda a credencial no cofre dele.
- **Confirmar como o CLI expõe o plano** (comando/arquivo de estado) e se o upgrade só aparece após reentrar; o app já trata os dois casos (polling de 15 s + botão "Já fiz o upgrade").
- **Vídeo "Ver este passo em vídeo (40 s)"**: o botão existe, falta gravar/hospedar os vídeos por passo e ligá-lo.
- **"Pedir ajuda ao Atlas (mande um print)"** leva hoje à tela Ajuda do shell (F17 ainda não existe).
- **Links** "Criar no site do Claude" e "Ver os planos" dependem do `abrirSite` real (URLs a confirmar).
