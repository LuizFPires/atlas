# SPEC — Atlas
Fonte da verdade: prototipo/ (aprovado em 2026-11-18)

Documento do "como". Justificativa de negócio não mora aqui (ver PRD.md). Seções numeradas para o PLAN referenciar.

## S1 — Arquitetura geral e as 5 partes
O Atlas é composto por 5 partes independentes que conversam entre si:
1. **Kit (plugin do Claude Code):** agentes (.claude/agents/), skills (.claude/skills/), hooks (.claude/hooks/), painel do canteiro (.claude/canteiro/, servidor Node local + cena 3D Three.js). Já existe neste repositório; é endurecido para leigo.
2. **App Atlas (Windows):** janela desktop que renderiza as telas F02–F17 e orquestra a conversa com o Claude Code do cliente. Não faz login de assinatura (proibido pela Anthropic) — usa o Claude Code oficial do cliente.
3. **Servidor de licenças (único componente no ar):** API de ativação, licenças, troca de computador, entrega do kit com marca d'água, bloqueio por atraso. Não roda obra nem usa Claude.
4. **Web do Luiz:** vendas (F00), cadastro (F00b), portal do cliente (F15), painel admin (F16), e-mails (F01).
5. **Instalador Windows:** instala Node, Claude Code, plugin e app; cria pasta C:\Users\<nome>\Atlas\Obras e atalho.

Fronteira de segurança: nenhum segredo em arquivo; instruções dos agentes entregues por obra e não persistidas; pagamentos/assinaturas sempre do cliente; código das obras no GitHub do cliente.

## S2 — Stack e convenções
- **Front web e app:** Vite + React + TypeScript; PWA com vite-plugin-pwa (mesmo padrão do kit atual). Tema escuro padrão e claro (ver S21).
- **App Windows:** empacotamento desktop sobre o mesmo front com Electron (decidido 18/11/2026) — abre com o Windows, impede dormir durante a obra (wake lock equivalente), microfone em tudo.
- **Backend (licenças + portal + admin):** Supabase (Postgres + Auth + Edge Functions) e deploy na Vercel (stack que o pipeline já domina). Alta disponibilidade, sem gargalo para ~100 clientes novos/mês.
- **Pagamento:** Stripe (Pix + assinatura recorrente via Stripe Billing). DECIDIDO 18/11/2026.
- **Transcrição de voz:** serviço de speech-to-text; transcrição sempre editável.
- **Idioma:** pt-BR em todo texto de usuário; números e rótulos em Geist Mono.
- **Domínio:** atlas-ia.app.br (site raiz, /conta portal, /comecar cadastro).

## S3 — Servidor de licenças: modelo de dados
Tabelas (Supabase/Postgres), nomes finais a ajustar:
- `clientes` (id, email_compra, nome_tratamento, empresa, ramo, criado_em).
- `licencas` (id, cliente_id, status [ativa|atrasada|pausada|cancelada], plano_valor, criada_em, pausa_prevista_em).
- `ativacoes` (id, licenca_id, computador_hash, ativo [bool], ativado_em, desativado_em).
- `trocas_computador` (id, licenca_id, de_hash, para_hash, feita_em) — regra 1/7 dias.
- `links_instalacao` (id, cliente_id, token, expira_em [~48h], usado_em).
- `codigos` (id, cliente_id, codigo_6dig, expira_em, usado_em) — ativação e troca.
- `entregas_kit` (id, licenca_id, obra_id, marca_dagua, baixado_em) — rastreio de vazamento.
- `pagamentos` (id, licenca_id, tipo [implantacao|mensalidade], valor, status, gateway_ref, competencia).
- `ocorrencias_admin` (id, cliente_id, tipo, descricao, resolvida) — "precisam de atenção".
Identificação do computador: SHA-256 do `MachineGuid` do Windows (HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid) — estável por instalação (decidido 18/11/2026).

## S4 — Servidor de licenças: APIs
Edge Functions (todas exigem licença válida quando aplicável):
- `POST /cadastro` — cria cliente após pagamento confirmado (webhook do gateway), grava 4 respostas, dispara e-mail (S10).
- `POST /link-instalacao` — gera token de uso único (~48 h).
- `POST /ativar/solicitar-codigo` — recebe e-mail da compra, envia código de 6 dígitos ao e-mail.
- `POST /ativar/confirmar` — valida código + token, registra computador_hash, ativa (1 licença = 1 computador).
- `POST /trocar-computador` — pelo portal, valida e-mail+código, desativa atual, ativa novo; checa limite 1/7 dias (override manual admin).
- `POST /verificar` — chamado a cada obra e pós-obra: retorna se pode construir (licença em dia + computador ativado).
- `POST /entregar-kit` — devolve as instruções dos agentes da obra, com marca d'água do cliente; registra em `entregas_kit`; não persiste no disco do cliente.
- Webhooks do gateway → atualizam `pagamentos` e status da licença (atraso → pausa em 7 dias com aviso por e-mail).

## S5 — Proteção, marca d'água e entrega do kit por obra
- Instruções dos agentes buscadas do servidor a cada obra (via S4 `/entregar-kit`), mantidas em memória, não salvas permanentemente no disco.
- Marca d'água por cliente embutida em cada cópia entregue (identifica quem vazou): hash da licença injetado como constante no build + metadado (decidido 18/11/2026).
- Aviso de licença no topo de cada arquivo entregue (software proprietário, licenciado a X, Lei 9.609/98).
- Sem armadilhas de "denúncia"/sabotagem/envio de dados (risco LGPD e falso bloqueio).
- Sem internet por pouco tempo: definir janela de tolerância do `/verificar` (cache curto) sem permitir uso offline prolongado.

## S6 — Pagamento e cobrança recorrente
- Implantação R$ 4.800 (único) + mensalidade ~R$ 200 (recorrente). Pix e cartão via Stripe (Checkout + Billing).
- Atraso → aviso por e-mail → pausa do pipeline em 7 dias (sistema entregue continua no ar).
- Cancelar compra: botão no portal, arrependimento 7 dias (CDC art. 49). Cancelar mensalidade: sem fidelidade.
- Gateway: Stripe (Checkout + Billing). Carência: 7 dias com Smart Retries e 3 avisos por e-mail, depois pausa (decidido 18/11/2026).

## S7 — Web: página de vendas (F00) e cadastro (F00b)
- `prototipo/F00Vendas.dc.html`: hero com vídeo 16:9 (placeholder do Luiz) + botão de compra; seções "o que dá para construir", canteiro 3D (cena real do .claude/canteiro ou imagem-assinatura), "como funciona" (5 etapas), "você não precisa digitar", "o que você recebe", preço, "para quem é/não é", dúvidas, depoimentos (reservado), chamada final; banner de cookies. Textos/vídeo editáveis pelo Luiz via Claude (sem painel de edição).
- `prototipo/F00bCadastro.dc.html`: após pagamento confirmado, 4 campos com microfone (tratamento, empresa, ramo livre, e-mail); POST `/cadastro`; dispara e-mail de boas-vindas.

## S8 — Web: portal do cliente (F15)
`prototipo/F15Portal.dc.html` em /conta: licença, mensalidade/pagamentos, computador ativo; trocar de computador (e-mail+código, independe da máquina antiga, limite 1/7 dias); cancelar compra (7 dias) e cancelar mensalidade. Auth própria (não a do Claude).

## S9 — Web: painel do administrador (F16)
`prototipo/F16Admin.dc.html`: receita, inadimplência, ativações, clientes travados, "precisam de atenção" (ocorrencias_admin). Ações: liberar troca urgente, ver entregas/marca d'água, acompanhar cadastros.

## S10 — E-mails (F01)
`prototipo/F01Email.dc.html`: boas-vindas personalizado (nome, empresa, ramo) com botão de instalar (link de uso único ~48 h); se aberto no celular, orienta abrir no computador e reenviar. Demais e-mails: código de ativação, aviso de atraso antes da pausa.

## S11 — Instalador Windows
Instalador NSIS (electron-builder) assinado com Azure Trusted Signing: instala Node, Claude Code (app de desktop, aba Code), plugin Atlas e app; cria C:\Users\<nome>\Atlas\Obras e atalho "Atlas · minhas obras"; dispara o fluxo de ativação (F02). Autoexplicativo (funciona sem o Luiz presente). Decidido 18/11/2026.

## S12 — App Atlas: shell, navegação e voz
`prototipo/Shell.dc.html`: menu lateral (sempre escuro) com "Falar com o Atlas" e "Ajuda do Atlas" fixos. Abre com o Windows; impede o computador de dormir durante a obra; microfone em toda entrada de texto (botão vermelho pulsando ao gravar, transcrição editável — ver S21). Navegação entre as telas F02–F17.

## S13 — App: instalação, ativação, Claude e contas (F02–F04b)
- `F02Ativacao`: pede e-mail da compra → código 6 dígitos → ativa; durante a espera ensina 3 coisas (fala, canteiro, pasta). Chama S4.
- `F03Claude`: passo a passo de login no Claude (claude.ai, e-mail, código, Authorize); detecta o plano (Pro/Max) e explica; reconhece upgrade sozinho ou botão "Já fiz o upgrade" (ver S20).
- `F04Contas`: guia de mão dada (S21) para GitHub, Supabase e Vercel, uma conta por vez; detecta conclusão de cada conta sozinho; pagamentos ficam para depois.
- `F04bCelular`: QR para instalar o app do Claude e logar na mesma conta; escolha de frequência de notícias (30 min / 1 h padrão / 3 h / por etapa) e quais avisos.

## S14 — App: projeto (estilo, telas, batismo, trazer) e aprovação (F05–F08)
- `F05Obras`: lista de obras + exemplos; "começar do zero" e "Já tenho um protótipo" (→ F06c). Pasta Atlas\Obras (uma subpasta por obra).
- `F06NovaObra`: perguntas guiadas com microfone.
- `F06bEstilo` (projeto 1/3): 2–3 referências + sentimento desejado → 3 estilos → design system; ou "Já tenho identidade visual" (sobe logo/cores/manual/design-system.md).
- `F06cTrazer`: recado pronto para outra IA; recebe prototipo-atlas.zip (telas HTML, design-system.md, telas.md, regras.md, imagens) + link; confere o que chegou, aponta faltas, Claude completa.
- `F07Prototipo` (projeto 2/3): telas desenhadas com o Claude no estilo escolhido; ajustes por fala; preview do celular ao lado; desfazer e versões.
- `F07bBatismo` (projeto 3/3): 3 nomes com logo/slogan/motivo; checa nomes parecidos e .app livre; ou sobe nome/logo próprios.
- `F08Aprovar`: etapas, prazo no plano do cliente, consumo da cota, aviso das lojas (D-U-N-S, 12 testadores/14 dias); aprovação gera PLAN.md da obra do cliente e inicia a construção.

## S15 — App: a obra rodando (F09–F12)
- `F09Painel`: canteiro 3D (cena real de .claude/canteiro), % ponderado (lido do PLAN do cliente no formato obrigatório), prazo restante, "agora na obra"; detalhes técnicos atrás de "ver detalhes"; ao concluir, "Publicar o sistema". Progresso vem dos hooks do canteiro (.claude/hooks/progresso.cjs, plano.cjs, etapa.cjs).
- `F10Pausa`: pausa por cota (não é erro); tom calmo, hora de volta, retoma sozinha ao renovar (ver S20).
- `F11Ocorrencia`: trava externa que exige o cliente; passo a passo com prints; aviso no celular/e-mail.
- `F12Retomar`: ao ligar o computador, o Atlas abre nesta tela; botão "Continuar obra" (retomar em ≤2 cliques).

## S16 — App: entrega e publicação (F13a, F13b, F13)
- `F13aPublicar`: 4 opções (endereço grátis Vercel, domínio Registro.br, PWA instalável, App Store/Google Play); multiescolha; a lista lateral muda conforme marcação.
- `F13bPublicando`: guia de mão dada por opção, até o último estágio:
  - Endereço grátis (5 passos): vistoria, confirmar nome .vercel.app, Atlas publica e liga o banco, teste por QR, no ar.
  - Domínio (8 passos): conferir nome livre, abrir Registro.br, cliente registra (CPF/CNPJ) e paga Pix, abrir DNS, colar 2 linhas (ler valores atuais da Vercel na hora, não fixos), Atlas confere a cada 5 min, cadeado, avisa no celular.
  - App instalável (5 passos): ícone/nome, testar Android (Chrome→Instalar), testar iPhone (Safari→Compartilhar→Adicionar à Tela de Início), cartaz com QR, pronto.
  - Lojas (13 passos): transformar em app (Apple recusa site embrulhado), contas Apple (US$99, D-U-N-S) e Google Play (US$25), textos/telas/ícone/privacidade, criar app, login Apple ID, build na nuvem (EAS/TestFlight + teste interno), teste, Google 12 testadores/14 dias, formulários de privacidade/classificação, "Enviar para revisão", acompanhar e corrigir, publicado. Cada passo: VOCÊ ou O ATLAS, tradução de botões, "Não consegui" → Ajuda.
  - Lacunas do kit a fechar: para loja, PWA no caso comum / TWA só Android / Expo + EAS quando exigir iOS ou nativo (decidido 18/11/2026); guia leigo para comprar domínio; aviso D-U-N-S e testadores cedo; traduzir passos técnicos do corretor. Reaproveita skill `entregar` + agentes vistoriador, implantador, corretor.
- `F13Entrega`: entrega das chaves, QR para instalar, link para a equipe.

## S17 — App: pós-obra (F14)
`prototipo/F14PosObra.dc.html`: cliente descreve a mudança (fala/texto/print); o Atlas explica o que vai fazer antes de mexer; corrige pelo mesmo pipeline (teste, revisão, publicação); exige licença em dia (S4 `/verificar`).

## S18 — Ajuda do Atlas (F17)
`prototipo/F17Ajuda.dc.html`: painel lateral de 520 px com print da tela, conversa, botões de ação e entrada com microfone (S21). Abre sozinho ao dar erro (com print + registro), pelo botão do menu, ou pelo "Não consegui" de cada passo guiado. Passos curtos, traduz botões, "Abrir a página certa", fecha com "Fiz, deu certo"/"Ainda não deu". Problemas do lado do Atlas: resolve sozinho e só avisa; casos não resolvidos → painel admin (S9). Nunca promete atendimento humano.

## S19 — Kit (plugin): agentes, skills, hooks
Base existente em .claude/ (agents, skills, hooks, canteiro). Endurecimento para leigo:
- Linguagem simples (tom de voz S21) em todos os textos de agentes/skills.
- Ajuda do Atlas (S18), notícias para o celular (S20), retomada da obra (F12), pasta Atlas\Obras.
- Capacidades novas do pipeline: login de usuários finais, notificações e pagamento online (na conta do cliente), LGPD básico (termos, consentimento, exclusão de conta).
- Fechar lacunas de publicação (S16).
- O PLAN.md de cada obra do cliente segue o mesmo formato obrigatório deste repositório (o painel lê peso/spec/tela).

## S20 — Detecção de plano, cota e notícias ao celular
- Detectar o plano do Claude (Pro/Max) ao abrir, antes de cada obra e a cada pausa por cota; comunicar previsão (dias de obra), consumo esperado, quando deve parar e quando a cota renova.
- Pausa automática no limite e retomada ao renovar (como no PACE).
- Upgrade reconhecido sozinho; se o Claude Code só reflete após reentrar, renovar a conexão sozinho ou botão "Já fiz o upgrade" (1 clique).
- Notícias ao celular pelo Remote Control do Claude Code, que liga a sessão do computador à conta claude.ai e ao app Claude no celular, com notificações push (confirmado 18/11/2026): frequência configurável (S13 F04b) e avisos (precisa de você, etapa terminou, obra pronta).

## S21 — Design system aplicado e componentes compartilhados
Fonte única: docs/design-system.md (tokens de cor, tipografia Geist/Geist Mono, marca, componentes e tom de voz). Não repetir valores aqui — consultar o design-system. Esta seção só registra como ele se aplica ao produto:
- Os mesmos componentes servem a web (F00, F15, F16) e ao app (F02–F17): botão de ação, bolinha de ícone (SVG, nunca emoji), cartão, chips/etapas, microfone (transcrição editável), guia de mão dada e painel Ajuda do Atlas (520 px).
- Dois temas por tokens (escuro A padrão, claro B); menu lateral sempre escuro.
- Imagem-assinatura = canteiro 3D (nunca 2D) de prototipo/assets/; no app, a cena real de .claude/canteiro.
