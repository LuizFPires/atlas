# PLAN — Atlas
Fonte da verdade: prototipo/ (aprovado em 2026-11-18)

Ordem dos milestones: fundação → servidor e web do Luiz → app do cliente (instalar, projeto, obra, entrega) → kit. Cada milestone é executável sozinho; detalhe técnico está na seção da SPEC indicada em `spec:`.

## Milestone 1 — Fundação e menu lateral
peso: 2
spec: S1, S2, S21, S12
tela: prototipo/Shell.dc.html
- [x] Criar projeto Vite + React + TS com PWA (vite-plugin-pwa)
- [x] Implementar tokens de cor dos dois temas (escuro A padrão, claro B) e tipografia Geist/Geist Mono
- [x] Criar biblioteca de componentes base (botão, bolinha de ícone, cartão, chips, microfone)
- [x] Implementar o menu lateral Shell com "Falar com o Atlas" e "Ajuda do Atlas" fixos
- [x] Carregar a marca (monograma, nome-atlas, imagem-assinatura do canteiro) de prototipo/assets
- [x] Conferir fidelidade com o protótipo
Notas: Repositório privado LuizFPires/atlas (base main). Decisão: incluir um workflow de CI básico (build/lint do Vite+React+TS) já no M1, para o merge ter checks verdes. Sem decisões de negócio pendentes para o M1 (fundação derivada do protótipo e do design system). Decisão: o emoji 💬 da "Ajuda do Atlas" no protótipo virou SVG de traço (CLAUDE.md e design system proíbem emoji). Ocorrência #1 (billing do Actions) destravada tornando o repo público temporário; CI verde no PR #1; repo volta a privado após o merge do M1. Achados aceitos sem correção (espelham o protótipo): dados fixos do card do plano/licença e microfone/Falar sem comportamento — entram nos milestones de cada tela. QA aprovou após correções (ícones PWA 192/512/maskable, monograma do tema claro via useTema, :focus-visible, aria-current, .at-bolinha com --on-lime, lateral responsiva até 768px). Baixa aberta p/ o Luiz: conferir o tema claro no olho uma vez.

## Milestone 2 — Servidor de licenças: dados e APIs
peso: 3
spec: S3, S4, S5
tela:
- [x] Criar o schema Supabase (clientes, licencas, ativacoes, trocas, links, codigos, entregas_kit, pagamentos, ocorrencias_admin)
- [x] Implementar geração de link de instalação de uso único (~48 h)
- [x] Implementar ativação por e-mail + código de 6 dígitos (1 licença = 1 computador)
- [x] Implementar troca de computador com limite 1/7 dias e override manual
- [x] Implementar /verificar (licença em dia + computador ativado) com tolerância curta offline
- [x] Implementar /entregar-kit com marca d'água por cliente, sem persistir no disco
Notas: ⏩ Auto (recomendado): sem decisões de negócio pendentes — regras vêm dos invariantes (1 licença = 1 computador, link uso único ~48h, troca 1/7 dias, marca d'água por cliente, nunca persistir segredo no disco) e de S3/S4/S5. Implementação como migrations Supabase + edge functions com fixtures/testes, sem deploy em produção (deploy é da etapa /entregar). Revisão de segurança reprovou (1 alto + 3 médios); decisões (auto — recomendado): (1) limite de emissão de código 3/15 min por cliente e por IP, falhas contadas por cliente+finalidade em janela (429), invalidar códigos abertos ao emitir novo, hash do código via HMAC; (2) credencial do app = segredo por ativação (device token), implementado como bearer token sobre TLS (cabeçalho X-Atlas-Dispositivo), guardado só como hash e comparado em tempo constante — o "desafio/HMAC" não cabe porque o servidor só guarda o hash; token rotaciona na troca/reativação; exigido em /verificar e /entregar-kit, negação genérica sem credencial; (3) status 'atrasada' com pausa nula = negar por padrão (allowlist fail-closed); (4) assinatura do /verificar migra para Ed25519 no servidor já neste milestone (contrato entregue agora), watermark segue HMAC. Pendente p/ /entregar (precisa de credenciais): adaptadores_supabase.ts, ATLAS_SEGREDO, ATLAS_SERVICO_TOKEN. Verificação offline + chave pública embutida ficam p/ o milestone do app. Re-QA aprovou após as correções (fix 2f42dcb). Endurecimento adicional (baixos baratos): IP do hop confiável da plataforma (não XFF à esquerda); token só pelo cabeçalho X-Atlas-Dispositivo (sem fallback no corpo); RLS sem expor token_hash ao portal. Decisão (auto — recomendado): o DoS dirigido por e-mail conhecido (gastar as 3 emissões/10 tentativas de um cliente em 15 min) é tradeoff aceito da proteção por conta. Requisito do milestone do app: token_dispositivo guardado no cofre do SO (Windows Credential Manager/DPAPI), nunca em arquivo. Pendente p/ /entregar: validar a migration 0002 em Postgres real e adicionar job de purga das chaves de limite; escolher o header de IP confiável da plataforma de deploy (ex.: x-real-ip do gateway Supabase) e o nº de proxies confiáveis — o teto de IP é defesa secundária, pois os tetos por cliente e por falhas do cliente já barram o brute-force (achado de IP reconhecido como baixa, não bloqueia o M2).

## Milestone 3 — Pagamento e cobrança recorrente
peso: 2
spec: S6, S4
tela:
- [x] Integrar a Stripe (Checkout + Billing: Pix + assinatura recorrente) — gateway decidido em 18/11/2026
- [x] Implementar webhook de pagamento (implantação e mensalidade) atualizando licenças
- [x] Implementar fluxo de atraso: aviso por e-mail e pausa do pipeline em 7 dias
- [x] Implementar cancelar compra (7 dias, CDC art. 49) e cancelar mensalidade sem fidelidade
Notas: ⏩ Auto (recomendado): gateway = Stripe (decidido 18/11). Invariante: a conta Stripe é SEMPRE do cliente (as credenciais/webhook são dele; nunca passam pelo Luiz). Implementação em modo teste/fixture (sem chaves ao vivo, sem deploy — deploy é /entregar). Pix + assinatura recorrente via Stripe Checkout + Billing; webhook assinado atualiza licenças; atraso→aviso+pausa em 7 dias liga no M2 (status 'atrasada'/pausa_prevista_em); cancelamento CDC art. 49 (7 dias) e mensalidade sem fidelidade. Impl: contas_gateway guarda só segredo_ref; chave STRIPE_<ref>_SK e webhook STRIPE_<ref>_WHSEC vêm do ambiente; webhook por conta em /webhook/stripe/:conta_id (sem conta central). Pix só na implantação (Stripe não cobra Pix em assinatura — mensalidade é cartão; Pix Automático fica pendente). Atraso: aviso 1 na 1ª falha + pausa em 7 dias; job /admin/processar-atrasos manda avisos 2 e 3 e pausa no dia 7 (cron agendado no /entregar). Migration 0004 esconde refs do gateway do portal. Pendente p/ /entregar: adaptador Supabase dos novos métodos, enviarAvisoAtraso (e-mail S10), cadastro das contas, segredos no ambiente, cron do atraso, Smart Retries na Stripe de cada cliente. Revisão de segurança reprovou (1 alto + 5 médios: bypass de validação de pagamento, cross-tenant no webhook/estorno, open redirect, TOCTOU no atraso, recompra pós-arrependimento). Decisões (auto — recomendado, A CONFIRMAR no checkpoint): (1) só conceder licença com payment_status=paid, metadata.atlas_tipo='implantacao', metadata.atlas_conta=contaId, currency='brl' e amount_total>=VALOR_IMPLANTACAO (config hoje R$48,00 — PREÇO A CONFIRMAR); (2) no_payment_required (cupom 100%) NÃO concede licença (fail-closed); (3) recompra pós-arrependimento = reativar a licença cancelada com novo comprada_em (nova janela 7 dias); (4) success/cancel URL montadas no servidor por conta (contas_gateway.base_retorno), ignorar valores do cliente; + escopar pagamentos por (conta_gateway_id, gateway_ref) com unique; UPDATE condicional por campo no atraso/webhook/cancelamento. Re-QA pendente. Rotas de retorno /compra/sucesso e /compra/cancelada (montadas de contas_gateway.base_retorno) a confirmar no milestone do portal. troca.ts ainda usa salvarLicenca (fora do escopo deste fix). Re-QA aprovou, mas revisão achou 2 novos no caminho da recompra: [ALTO] abuso de estorno (cancelarCompra estorna todos os pagamentos, inclui compras antigas) → estornar só pago_em>=comprada_em novo; [MÉDIO] TOCTOU → decidir reativação pelo resultado atômico do upsert (WHERE status<>'estornado'). CONFIRMADO pelo usuário no checkpoint M1–M3 (18/11): piso VALOR_IMPLANTACAO=R$4.800; sem desconto/cupom por ora (fail-closed mantido); recompra pós-arrependimento reativa a licença (mantido). Baixas registradas p/ /entregar: conta_gateway_id SET NOT NULL após backfill; preservar 'estornado' no upsert; alerta/ocorrência em conta_divergente (cliente pagou sem licença); janela ms no e-mail de atraso; não atualizar pago_em quando o status anterior já era 'pago' (reentrega); charge.refunded antes do pagamento existir. QA focada aprovou o fix de estorno/recompra (commit 9fb3fb8).

## Milestone 4 — Web: página de vendas e cadastro
peso: 3
spec: S7, S21
tela: prototipo/F00Vendas.dc.html
- [x] Montar a página de vendas (hero com vídeo 16:9, o que dá para construir, canteiro 3D, como funciona, você não precisa digitar, o que você recebe, preço, para quem é/não é, dúvidas, depoimentos reservados, chamada final)
- [x] Implementar o botão de compra ligado ao gateway e o banner de cookies
- [x] Construir o cadastro pós-pagamento (F00bCadastro) com as 4 respostas por microfone
- [x] Ligar o cadastro ao POST /cadastro e ao disparo do e-mail de boas-vindas
- [x] Conferir fidelidade com o protótipo (F00Vendas e F00bCadastro)
Notas: ⏩ Auto (recomendado): frontend derivado do protótipo (F00Vendas, F00bCadastro) e do design system. Preço confirmado R$4.800. Botão de compra liga no Stripe Checkout do M3; POST /cadastro e e-mail de boas-vindas (S10) implementados em modo fixture (envio real fica p/ /entregar). Microfone em toda entrada de texto (as 4 respostas do cadastro). Banner de cookies: opção mais privada por padrão. Divergências do protótipo (aceitas): "Quero construir" abre modal de e-mail → Stripe Checkout → cadastro; VIDEO_URL vazia com espaço reservado (nota u00); emojis → SVG. Vendas aprovada. Cadastro reprovou na segurança — decisões (auto — recomendado): vincular o cadastro ao session_id do Stripe (success_url ganha ?session_id=...; cliente derivado do session_id; e-mail do corpo vira só confirmação, acesso vai sempre ao e-mail da compra); resposta genérica única sem prova válida (anti-enumeração); allowlist em nome/empresa/ramo no e-mail de boas-vindas; invalidar links antigos ao reemitir; Pix pendente ("espere") só com prova válida. Pendente p/ /entregar ou go-live: adaptadores_supabase.ts (salvarCadastro atômico, reabrirCadastro, envio real), migration 0006, envs (ATLAS_WEB_ORIGEM, VITE_API_URL, VITE_CONTA_ID) em .env.example; conteúdo do rodapé: Termos/Licença/Privacidade/Contato, CNPJ, URL do vídeo, depoimentos reais (a política de privacidade precisa existir antes do go-live, por LGPD).

## Milestone 5 — E-mails do Atlas
peso: 1
spec: S10
tela: prototipo/F01Email.dc.html
- [x] Montar o e-mail de boas-vindas personalizado (nome, empresa, ramo) com botão de instalar
- [x] Implementar o link de uso único e o aviso "abra no computador" quando aberto no celular
- [x] Montar os e-mails de código de ativação e de aviso de atraso antes da pausa
- [x] Conferir fidelidade com o protótipo
Notas: ⏩ Auto (recomendado): reusa e consolida supabase/functions/_shared/emails.ts (montarBoasVindas do M4), mantendo a sanitização de texto livre. E-mails em HTML fiéis ao protótipo F01Email; link de uso único (~48h) com aviso "abra no computador onde vai construir" quando aberto no celular; e-mail de código de ativação (liga no M2) e de aviso de atraso antes da pausa (liga no M3). Nunca promete atendimento humano. Modo fixture: envio real fica p/ /entregar. Divergências aceitas (auto — recomendado): logo do protótipo vira wordmark "ATLAS" (o _blob só existe no canvas) e o e-mail tem moldura única (hero escuro + corpo claro), sem versão do tema B — aceitável para e-mail. Limites mantidos: reenvio 3/h por cliente, abertura 30/IP a cada 15 min. QA reprovou por 1 médio (reenvio invalidava todos os links antes do envio); corrigido: só invalida o antigo após o envio dar certo. Pendente p/ /entregar: montar link_instalacao a partir do token no reenvio; adaptadores de envio.

## Milestone 6 — Portal do cliente (web)
peso: 2
spec: S8, S4
tela: prototipo/F15Portal.dc.html
- [x] Implementar auth própria do portal (independente do Claude) em /conta
- [x] Mostrar licença, mensalidade/pagamentos e computador ativo
- [x] Implementar troca de computador por e-mail + código (independe da máquina antiga)
- [x] Implementar cancelar compra e cancelar mensalidade
- [x] Conferir fidelidade com o protótipo
Notas: ⏩ Auto (recomendado): auth própria do portal via Supabase Auth (independente do login do Claude), em /conta; o portal só lê/age sobre os dados do cliente logado (RLS, sem cross-tenant; não expor refs do gateway nem token_hash). Reaproveita M2 (licença, troca por e-mail+código) e M3 (cancelar compra CDC art.49 / cancelar mensalidade). Troca de computador independe da máquina antiga (roubo/perda), limite 1/7 dias. Ações de pagamento passam pela conta Stripe do cliente. Modo fixture, sem deploy. QA aprovou (sem alto/médio; IDOR/cross-tenant/anti-enumeração conferidos). Divergências do protótipo (auto — recomendado): computador mostrado como "Seu computador · Ativado em dd/mm" (guardamos só o hash, mais privado) em vez do nome "DESKTOP-ZE"; forma de pagamento e última atividade não exibidas por ora — nome amigável do PC e forma de pagamento ficam p/ quando o app capturar (M9/M18) ou ler da Stripe; cancelar compra segue só com confirmação (CDC pede cancelamento fácil). Migration 0008 tira gateway_ref/pi do RLS do portal. Baixas p/ /entregar/go-live: restringir a coluna computador_hash no REST; rate-limit do OTP e limpeza de usuários Auth sem cliente; CSP p/ o token em sessionStorage; teste de integração do adaptador real. Env novas: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (.env.example).

## Milestone 7 — Painel do administrador
peso: 2
spec: S9
tela: prototipo/F16Admin.dc.html
- [x] Montar os indicadores (receita, inadimplência, ativações, clientes travados)
- [x] Montar a lista "precisam de atenção" a partir de ocorrencias_admin
- [x] Implementar ações do admin (liberar troca urgente, ver entregas/marca d'água, cadastros)
- [x] Conferir fidelidade com o protótipo
Notas: ⏩ Auto (recomendado): painel só do admin (Luiz) — todas as rotas /admin/* exigem identidade de admin (papel/allowlist configurável, nunca um cliente comum; JWT validado no servidor). Lê os dados do PRÓPRIO Atlas (vendas do Atlas: receita, inadimplência, ativações, clientes travados; ocorrencias_admin), não os pagamentos das obras dos clientes (esses são do gateway do cliente). Ações: liberar troca urgente (override 1/7 dias), ver entregas/marca d'água, ver cadastros. Modo fixture, sem deploy. Nunca expor segredo; admin vê agregados e dados operacionais, não chaves. QA aprovou (sem alto/médio; gate de admin, não-vazamento e auditoria conferidos). Decisão (auto — recomendado): a mensalidade de licença atrasada conta no recorrente_mensal. Baixas p/ /entregar/scale: paginação/RPC de agregação acima de 5000 registros; condição troca_liberada_em is null no liberar (evita 2ª linha de auditoria em clique simultâneo); rate-limit de JWT inválido. Env: ATLAS_ADMIN_EMAILS (.env.example).

## Milestone 8 — Instalador para Windows
peso: 3
spec: S11
tela:
- [x] Gerar o instalador NSIS com electron-builder e assiná-lo com Azure Trusted Signing — decidido 18/11/2026
- [x] Instalar Node, Claude Code, plugin Atlas e app
- [x] Criar a pasta C:\Users\<nome>\Atlas\Obras e o atalho na Área de Trabalho
- [x] Encadear o instalador ao fluxo de ativação (abre em F02)
Notas: ⏩ Auto (recomendado): NSIS via electron-builder + Azure Trusted Signing (decidido 18/11). Monta a config do electron-builder (target nsis), os scripts de instalação (Node, Claude Code CLI, plugin Atlas, app), a criação de C:\Users\<nome>\Atlas\Obras (nunca Desktop/Documentos por causa do OneDrive) + atalho na Área de Trabalho, e o encadeamento à ativação (abre F02). Lógica testável onde der. O build assinado real exige credenciais Azure Trusted Signing + runner Windows → fica p/ /entregar; o CI (ubuntu) NÃO builda o instalador, mantém lint/test/build. Nota de ordem: o app Electron é empacotado no M9; o M8 monta a infra do instalador referenciando o app que o M9 detalha. Decisão (auto — recomendado, A CONFERIR): instala só o Claude Code CLI (via npm), não o app de desktop — o leigo usa a interface do Atlas, que dirige o Claude Code headless; ele nunca vê o Claude Code direto. Se a intenção for instalar também o app de desktop (aba Code), ajustar. App abre com --tela=F02 (M9 honra a flag). Pendente p/ /entregar: credenciais Azure Trusted Signing, runner Windows, build assinado testado em Windows limpo com OneDrive, ícone, ids reais do plugin/app (M9). Ver instalador/PENDENTE-ENTREGAR.md. QA reprovou (médios: ps1 não empacotado, falhas nativas não abortavam, passo do plugin sempre passava, passos.ts testáveis não eram usados pelo que roda de verdade; + 2 supply-chain: electron-builder@latest e plugin não-fixado). Fix: empacotar instalar.ps1 (extraResources); ps1 checa $LASTEXITCODE e aborta (MessageBox dispara), refresh do PATH após Node; o ps1 instala Node e depois roda executarPlano (node) p/ claude code+plugin+app — assim o que é testado é o que roda; verificação real do plugin; pinar electron-builder (versão exata, sem @latest/--yes); empacotar o plugin local com checksum. CLI-only CONFIRMADO coerente pelo QA (PRD §24-25); S11 a atualizar. Re-QA aprovou. Baixa p/ /entregar/M9: exigir Node >=24 (ou >=22.6) no instalar.ps1 por causa do --experimental-strip-types; PLUGIN_SHA256 real + ids do plugin/app vêm do M9 (instalador falha fechado até lá); teste do instalador em Windows limpo.

## Milestone 9 — App: shell e ativação
peso: 2
spec: S12, S13, S4
tela: prototipo/F02Ativacao.dc.html
- [x] Empacotar o app desktop (abre com o Windows, impede dormir na obra, microfone em tudo)
- [x] Montar a tela de instalar e ativar (e-mail da compra → código de 6 dígitos)
- [x] Ligar a ativação ao servidor de licenças (registra o computador)
- [x] Ensinar as 3 coisas durante a espera (fala, canteiro, pasta)
- [x] Conferir fidelidade com o protótipo
Notas: ⏩ Auto (recomendado): app Electron que reaproveita o front (vite) servido no app; abre com o Windows (M8 encadeia F02), impede dormir durante a obra (power save blocker), microfone em tudo. Tela de instalar+ativar (F02): e-mail da compra → código de 6 dígitos, ligando na ativação do M2 (bearer token por dispositivo, registra o computador). Ensina as 3 coisas na espera (tudo pode ser falado; o computador é o canteiro; pasta das obras). Honra --tela=F02 e telaInicial (F05 se já ativado). CI (ubuntu) NÃO builda o Electron — mantém front build + testes de lógica. Coordenação com o M8: definir os ids reais do plugin/app e o PLUGIN_SHA256 (hoje placeholder; se o empacotamento do kit ficar p/ o M26, segue placeholder e o instalador falha fechado). Divergência (SPEC S13): a tela ganha um passo "E-mail da compra" antes do código (o protótipo começava no código) — aceito. Token do dispositivo só no cofre (port Cofre; falha fechado sem ATLAS_COFRE=fixture). Pendências importantes p/ /entregar: (1) adaptador DPAPI real; (2) empacotar Atlas.exe assinado e testar em Windows limpo; (3) o instalador do M8 precisa repassar --token=<link de uso único> ao abrir o app (hoje só --tela=F02), senão /ativar/confirmar não funciona; (4) a fala no Electron precisa de motor de transcrição (Whisper) — SpeechRecognition do Chromium não roda sem chaves Google (impacta o invariante "tudo pode ser falado" no app); (5) progresso real na barra; (6) bloquear o sono também durante a obra. QA aprovou (token no cofre, M2, fidelidade F02 ok). Baixas p/ /entregar/hardening: mensagem amigável quando o cofre falha (hoje tela de erro crua); return após app.quit() no requestSingleInstanceLock; ocultar ?desktop=1 no site de produção.

## Milestone 10 — App: conectar o Claude e detectar o plano
peso: 2
spec: S13, S20
tela: prototipo/F03Claude.dc.html
- [x] Montar o passo a passo de login no Claude (claude.ai, e-mail, código, Authorize)
- [x] Detectar e explicar o plano (Pro/Max) ao conectar
- [x] Reconhecer upgrade sozinho ou com o botão "Já fiz o upgrade" (1 clique)
- [x] Conferir fidelidade com o protótipo
Notas: ⏩ Auto (recomendado): login guiado do Claude (F03): passo a passo abrindo claude.ai, e-mail, código, Authorize — é o login DO PRÓPRIO CLIENTE, sem OAuth de assinatura (regra Anthropic). O Atlas só DETECTA o plano (Pro/Max) e explica; nunca escolhe plano; upgrade é no site do Claude. Reconhece o upgrade sozinho (polling leve) ou com "Já fiz o upgrade" (1 clique). A interação real com o Claude Code CLI fica atrás de um port (PonteClaude) com mock em fixture; o adaptador real (rodar o CLI, ler o plano) fica p/ /entregar. Cada palavra em inglês vem traduzida; "Não consegui" abre ajuda do passo. QA aprovou (invariantes ponto a ponto: sem campo de senha/token na F03; PonteClaude só abrirLogin/abrirSite sem URL de dado; Atlas só detecta). Baixa p/ /entregar: try/catch no claude.estado() do adaptador real; shell.openExternal só com URLs fixas do claude.ai.

## Milestone 11 — App: abrir as contas
peso: 2
spec: S13, S21
tela: prototipo/F04Contas.dc.html
- [x] Montar o guia de mão dada (imagem com botão piscando, inglês traduzido, VOCÊ/O ATLAS)
- [x] Implementar o fluxo GitHub, Supabase e Vercel, uma conta por vez
- [x] Detectar sozinho quando cada conta ficou pronta
- [x] Ligar "Não consegui" à Ajuda do Atlas
- [x] Conferir fidelidade com o protótipo
Notas: ⏩ Auto (recomendado): guia de mão dada (F04Contas) para o cliente abrir as contas DELE — GitHub, Supabase e Vercel, uma por vez, com imagem do site, botão certo piscando, inglês traduzido e selo VOCÊ/O ATLAS por passo. O Atlas NÃO cria conta nem digita credencial do cliente; ele guia e DETECTA sozinho quando cada conta ficou pronta (port de detecção, mock em fixture; adaptador real p/ /entregar). "Não consegui" abre a Ajuda do Atlas com o print do passo. Os nomes dos botões dos sites reais precisam ser conferidos no /entregar. QA reprovou por 1 médio: corrida retomada×polling usa conta velha → passo undefined → crash da F04 (teste intermitente; CI passou por sorte). Fix: checar id da conta atual no then do polling (ref) e proteger passo com Math.min; cobrir o caso "3 contas já prontas" (primeira=-1); conferir pronta antes de marcar feita.

## Milestone 12 — App: acompanhar pelo celular
peso: 1
spec: S13, S20
tela: prototipo/F04bCelular.dc.html
- [x] Montar a tela "computador ligado, acompanhe pelo celular" com QR para o app do Claude
- [x] Implementar a escolha de frequência de notícias (30 min / 1 h / 3 h / por etapa)
- [x] Implementar a escolha dos avisos (precisa de você, etapa terminou, obra pronta)
- [x] Conferir fidelidade com o protótipo
Notas: ⏩ Auto (recomendado): tela F04bCelular — "computador ligado, acompanhe pelo celular" com QR para o app do Claude; escolha da frequência de notícias (30 min / 1 h / 3 h / por etapa) e dos avisos (precisa de você, etapa terminou, obra pronta), preferências guardadas. A conexão real da sessão do computador com o app do celular (Remote Control) o próprio protótipo marca como "a confirmar na implementação" → fica atrás de um port com mock em fixture; adaptador real p/ /entregar. Modo fixture, sem deploy.

## Milestone 13 — App: minhas obras e nova obra
peso: 2
spec: S14
tela: prototipo/F05Obras.dc.html
- [x] Montar a lista de obras com a analogia da casa e exemplos de sistemas
- [x] Implementar "começar do zero" e "Já tenho um protótipo" (leva ao F06c)
- [x] Criar a subpasta da obra em Atlas\Obras ao iniciar
- [x] Montar a nova obra (F06NovaObra) com perguntas guiadas e microfone
- [x] Conferir fidelidade com o protótipo (F05Obras e F06NovaObra)
Notas: ⏩ Auto (recomendado): F05Obras (lista com analogia da casa + exemplos; primeira obra vazia com um botão claro) e F06NovaObra (perguntas guiadas em vez de caixa em branco, microfone com transcrição editável). "Começar do zero" e "Já tenho um protótipo" (leva ao F06c do M15). Criar a subpasta da obra em C:\Users\<nome>\Atlas\Obras ao iniciar — filesystem atrás de um port (mock em fixture; adaptador real p/ /entregar, sem segredo em arquivo). Modo fixture, sem deploy.

## Milestone 14 — App: projeto 1/3 (estilo)
peso: 2
spec: S14, S21
tela: prototipo/F06bEstilo.dc.html
- [x] Receber 2–3 referências (link, print ou fala) e o sentimento desejado
- [x] Propor 3 estilos e transformar o escolhido no design system
- [x] Implementar "Já tenho identidade visual" (subir logo, cores, manual ou design-system.md)
- [x] Conferir fidelidade com o protótipo
Notas: ⏩ Auto (recomendado): F06bEstilo — receber 2-3 referências (link, print ou fala) + o sentimento desejado; o Atlas propõe 3 estilos e o escolhido vira o design system da obra. "Já tenho identidade visual": subir logo, cores, manual ou um design-system.md pronto. A geração dos 3 estilos é o Claude por baixo → atrás de um port (PonteEstilo/PonteClaude) com mock em fixture; adaptador real p/ /entregar. Upload de arquivos (logo/manual) atrás do port de filesystem; nunca segredo em arquivo. Modo fixture, sem deploy. QA reprovou (3 médios). Decisões (auto — recomendado): (1) o design-system.md PRONTO do cliente PREVALECE — é copiado como veio, o esqueleto só é gerado quando se cria do zero; nunca sobrescrever (prontoDS rastreado pelo nome realmente gravado); (2) PonteArquivos.guardar passa a receber um token/handle do arquivo escolhido (não um descritor do renderer) e revalida extensão/20MB no adaptador; destino 'raiz' só aceita .md; (3) conteúdo do cliente (design-system.md pronto, cores, sentimento) é tratado como DADO não confiável quando o Claude ler (delimitado, sem seguir instruções, sem invocar ferramentas) — risco de injeção; o texto livre entra escapado/delimitado no .md. Baixas: rejeitar SVG como logo (ou sanitizar); corrigir o texto "ficam só no seu computador" (o Claude lê); path.resolve/symlink/COPYFILE_EXCL + teste de contrato (traversal/ADS) p/ o adaptador real.

## Milestone 15 — App: trazer protótipo de outra IA
peso: 2
spec: S14
tela: prototipo/F06cTrazer.dc.html
- [x] Mostrar o recado pronto para copiar e mandar na outra IA
- [x] Receber o prototipo-atlas.zip (telas HTML, design-system.md, telas.md, regras.md, imagens) e o link
- [x] Conferir o que chegou e apontar o que falta para o Claude completar
- [x] Conferir fidelidade com o protótipo
Notas: ⏩ Auto (recomendado): F06cTrazer — recado pronto pra copiar e mandar na outra IA; receber o prototipo-atlas.zip (telas HTML, design-system.md, telas.md, regras.md, imagens) + o link do protótipo no ar; conferir o que chegou e apontar o que falta, para o Claude completar no mesmo estilo. SEGURANÇA: o .zip é não confiável — o descompactar fica atrás de um port com defesas obrigatórias (sem zip-slip/traversal, sem symlink, limite de tamanho/entradas contra zip-bomb, só tipos esperados, dentro de Atlas\Obras\<obra>); o conteúdo (HTML/md) é DADO para o Claude, tratado como no M14 (delimitado, não-instrução). Mock em fixture; adaptador real p/ /entregar. Modo fixture, sem deploy. QA aprovou (sem alto/médio; validarPacote com 81 testes de ataque). Baixas corrigidas: ignorar .DS_Store/__MACOSX (zip do Mac não recusa mais o pacote); criar a subpasta só após validar (sem pasta vazia em falha); recado honesto quando não há adaptador. PENDENTE do adaptador real ampliado: zip criptografado, zip64/extra fields, cabeçalho local × central, entradas duplicadas/sobrepostas (overlap bomb), colisão arquivo×pasta após sanitizar; e, se checar o link, resolver DNS e bloquear IP interno (nip.io/foo.localhost) — SSRF.

## Milestone 16 — App: projeto 2/3 (telas com o Claude)
peso: 3
spec: S14
tela: prototipo/F07Prototipo.dc.html
- [x] Desenhar as telas com o Claude no estilo escolhido
- [x] Implementar ajustes por fala com preview do celular ao lado
- [x] Implementar desfazer e versões do protótipo
- [x] Conferir fidelidade com o protótipo
Notas: ⏩ Auto (recomendado): F07Prototipo — o Claude desenha as telas da obra no estilo escolhido (M14); o cliente pede ajustes falando e vê o preview do celular mudar ao lado; desfazer e versões do protótipo (histórico na pasta da obra). A geração é o Claude por baixo → atrás de um port (PontePrototipo) com mock em fixture; adaptador real p/ /entregar. SEGURANÇA: o preview das telas (HTML gerado/importado) renderiza em iframe sandbox sem scripts; os pedidos do cliente (fala/texto) são DADO para o Claude (delimitado, não-instrução, como M14/M15). Versões ficam na pasta da obra; nunca segredo em arquivo. Modo fixture, sem deploy. QA aprovou (sandbox sólido). Baixas p/ /entregar/go-live: bloquear navegação do iframe (meta-refresh/link — sanitizar ou pedir ao Claude que não gere); CSP no próprio app (index.html/vercel.json, preexistente).

## Milestone 17 — App: projeto 3/3 (batismo)
peso: 2
spec: S14
tela: prototipo/F07bBatismo.dc.html
- [x] Sugerir 3 nomes com logo, slogan e motivo
- [x] Conferir nomes parecidos e se o endereço .app está livre
- [x] Implementar subir nome e logo próprios
- [x] Conferir fidelidade com o protótipo
Notas: ⏩ Auto (recomendado): F07bBatismo (no fim do projeto, com todo o contexto): o Claude sugere 3 nomes com logo, slogan e motivo (PonteBatismo, mock em fixture). Conferir nomes parecidos e se o endereço (.app/.com.br) está livre — checagem de domínio atrás de um port (mock em fixture; adaptador real p/ /entregar, resolvendo via serviço oficial, sem SSRF). Quem já tem nome/logo sobe os arquivos (PonteArquivos do M14; SVG recusado como logo). Nomes sugeridos e entrada do cliente tratados com cuidado; nunca segredo em arquivo. Modo fixture, sem deploy. QA aprovou (sem alto/médio). Baixas p/ /entregar/hardening: revalidar logo.arquivo no batizar (sem 
/separador); usar hasOwnProperty (não `in`) ao aceitar o id da logo vinda do Claude; enderecos vazio = livre:null; limite de tamanho de slogan/porque no PENDENTE.

## Milestone 18 — App: aprovar e começar a obra
peso: 2
spec: S14, S20
tela: prototipo/F08Aprovar.dc.html
- [x] Mostrar etapas, prazo no plano do cliente e consumo da cota
- [x] Mostrar o aviso das lojas (D-U-N-S, 12 testadores/14 dias)
- [x] Oferecer a escolha do modo da obra: "automático do começo ao fim, sem me chamar" (destaque/recomendado) ou "me chamar para aprovar cada etapa"; guardar a escolha na obra e explicar em linguagem de leigo
- [x] Gerar o PLAN.md da obra do cliente (formato obrigatório) e iniciar a construção no modo escolhido
- [x] Conferir fidelidade com o protótipo
Notas: Decisão do usuário (18/11): o Atlas deve deixar o cliente escolher entre AUTOMÁTICO (roda do M1 ao fim sem intervenção — o grande valor do negócio, opção em destaque) e PASSO A PASSO (aprova cada etapa). A engine do kit já tem os dois modos (manual × roteiro automático/recomendado.json); falta a escolha na UI. O automático só para nas travas reais: ocorrência que exige o cliente (F11), pausa por cota (F10) e billing/credencial. Dá para trocar o modo depois (no painel da obra). Isto estende o protótipo F08Aprovar (registrar a divergência; a UI segue o design system).

## Milestone 19 — App: painel da obra (canteiro)
peso: 3
spec: S15, S19
tela: prototipo/F09Painel.dc.html
- [x] Integrar o canteiro 3D (cena real de .claude/canteiro) ao painel
- [x] Mostrar % ponderado (lido do PLAN), prazo restante e "agora na obra"
- [x] Esconder detalhes técnicos atrás de "ver detalhes"
- [x] Respeitar o modo da obra (M18): no automático, seguir etapa após etapa sem pedir aprovação (parar só em ocorrência/pausa/billing); no passo a passo, parar ao fim de cada etapa e pedir o OK; permitir trocar o modo aqui a qualquer momento
- [x] Mostrar "Publicar o sistema" ao concluir
- [x] Conferir fidelidade com o protótipo
Notas: Ver decisão do modo automático × passo a passo no M18. O painel honra a escolha e deixa trocar a qualquer momento. QA aprovou. Canteiro por iframe (127.0.0.1, origem distinta => allow-same-origin seguro); % com paridade testada com plano.cjs; sem modo.json o painel pede a escolha. Baixas p/ /entregar: reverter modo.json se aplicarModo falhar; retry/ignorar liberacao em parada no aprovarEtapa; fluxo 'publicar' ao sair pelo menu.

## Milestone 20 — App: pausa por cota e ocorrência
peso: 2
spec: S15, S20
tela: prototipo/F10Pausa.dc.html
- [x] Montar a pausa por cota (tom calmo, hora de volta, nenhuma ação obrigatória)
- [x] Implementar a retomada sozinha quando a cota renova
- [x] Montar a ocorrência (F11Ocorrencia) com passo a passo e prints e aviso no celular/e-mail
- [x] Conferir fidelidade com o protótipo (F10Pausa e F11Ocorrencia)
Notas: ⏩ Auto (recomendado): F10Pausa (pausa por cota: tom calmo, hora de volta, nenhuma ação obrigatória — "pausa por cota não é erro") e retomada sozinha quando a cota renova; F11Ocorrencia (único tipo de parada que exige o cliente: passo a passo com prints, aviso no celular/e-mail). Liga no sistema de ocorrências do kit (ocorrencias.cjs/docs/ocorrencias.json) e na detecção de cota do plano (M10), atrás de ports (mock em fixture; adaptador real p/ /entregar). Pausa por cota e ocorrência valem nos dois modos (automático e passo a passo). Modo fixture, sem deploy. QA aprovou (pausa calma; ocorrência para nos 2 modos; conteúdo externo como dado; chave no cofre). Baixas p/ /entregar: condicionar o aviso 'no celular' à existência do adaptador; garantir 'avisar uma vez' no adaptador real.

## Milestone 21 — App: retomar a obra
peso: 1
spec: S15
tela: prototipo/F12Retomar.dc.html
- [x] Abrir o Atlas nesta tela ao ligar o computador
- [x] Implementar "Continuar obra" (retomar em até 2 cliques)
- [x] Conferir fidelidade com o protótipo
Notas: ⏩ Auto (recomendado): F12Retomar — ao ligar o computador o Atlas abre sozinho nesta tela (liga no login item do M9/setLoginItemSettings e no telaInicial: se há obra em andamento, abre F12); "Continuar obra" retoma em até 2 cliques (religa a linha de produção via PonteConstrucao/PonteCota). Desligar o auto-início: Configurações → Abrir com o Windows (nota do protótipo). Mock em fixture; adaptador real p/ /entregar. Modo fixture, sem deploy. QA aprovou (telaInicial com paridade instalador/app; Continuar em 1 clique; religar nao contorna ocorrencia). Baixas p/ /entregar: F12 so em fixture ate o adaptador; tela de Configuracoes 'Abrir com o Windows'.

## Milestone 22 — App: publicação (escolha e guias)
peso: 3
spec: S16, S19
tela: prototipo/F13aPublicar.dc.html
- [ ] Montar a escolha "onde o sistema vai morar" (4 opções, multiescolha, lista lateral dinâmica)
- [ ] Implementar o guia endereço grátis (5 passos) e app instalável (5 passos)
- [ ] Implementar o guia de domínio (8 passos; ler DNS atual da Vercel na hora)
- [ ] Implementar o guia das lojas (13 passos; VOCÊ/O ATLAS, tradução, "Não consegui")
- [ ] Montar o F13bPublicando com o padrão do guia de mão dada
- [ ] Conferir fidelidade com o protótipo (F13aPublicar e F13bPublicando)
Notas: ⏩ Auto (recomendado): F13aPublicar (escolha "onde o sistema vai morar": 4 opções multiescolha — endereço grátis Vercel, domínio próprio Registro.br, app instalável PWA, lojas Apple/Google — com lista lateral dinâmica conforme o que marca) e F13bPublicando (guia de mão dada passo a passo, com selo VOCÊ/O ATLAS, inglês traduzido e "Não consegui"). Invariante: pagamentos e "Enviar para revisão" são SEMPRE do cliente; o resto o Atlas faz. Serviços externos (Vercel, Registro.br, lojas) atrás de ports (mock em fixture; adaptador real p/ /entregar — resolver só hosts oficiais, sem SSRF; nomes/telas/URLs reais a conferir). Modo fixture, sem deploy.

## Milestone 23 — App: entrega do sistema
peso: 1
spec: S16
tela: prototipo/F13Entrega.dc.html
- [ ] Montar a entrega das chaves (momento de comemorar)
- [ ] Gerar o QR para instalar no celular e o link para a equipe
- [ ] Conferir fidelidade com o protótipo
Notas:

## Milestone 24 — App: pós-obra
peso: 2
spec: S17
tela: prototipo/F14PosObra.dc.html
- [ ] Receber a mudança por fala, texto ou print
- [ ] Explicar o que vai fazer antes de mexer
- [ ] Rodar a correção pelo mesmo pipeline exigindo licença em dia
- [ ] Conferir fidelidade com o protótipo
Notas:

## Milestone 25 — App: Ajuda do Atlas
peso: 2
spec: S18, S9
tela: prototipo/F17Ajuda.dc.html
- [ ] Montar o painel lateral de 520 px (print, conversa, botões, microfone)
- [ ] Abrir sozinho ao dar erro (com print e registro), pelo menu e pelo "Não consegui"
- [ ] Implementar passos curtos, tradução, "Abrir a página certa" e "Fiz/Ainda não deu"
- [ ] Enviar casos não resolvidos ao painel admin
- [ ] Conferir fidelidade com o protótipo
Notas:

## Milestone 26 — Kit: endurecimento para leigo e lacunas
peso: 3
spec: S19, S16
tela:
- [ ] Reescrever textos de agentes e skills em linguagem simples (tom de voz do Atlas)
- [ ] Adicionar capacidades ao pipeline (login de usuários finais, notificações, pagamento na conta do cliente, LGPD básico)
- [ ] Fechar as lacunas de publicação (PWA/TWA por padrão, Expo+EAS p/ iOS; guia leigo de domínio) — decidido 18/11/2026
- [ ] Garantir que o PLAN.md das obras do cliente siga o formato obrigatório do painel
- [ ] Integrar a entrega do kit por obra com marca d'água e aviso de licença no topo dos arquivos
Notas:
