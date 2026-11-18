# PRD — Atlas
Fonte da verdade: prototipo/ (aprovado em 2026-11-18)

Documento do "o quê e por quê". Tecnologia e tarefas não moram aqui (ver SPEC.md e PLAN.md).

## 1. Objetivo
Transformar a linha de produção de subagentes do Claude Code (o kit que hoje constrói apps com o painel do "canteiro") num produto vendido no Brasil inteiro: o **Atlas**. O cliente leigo aprende a desenhar e melhorar o protótipo do sistema que quer; depois o pipeline documenta, planeja, implementa, testa, revisa e publica sozinho, no computador do próprio cliente, e entrega um sistema PWA pronto para o dia a dia.

Sucesso = um leigo constrói e mantém sozinho um sistema de uso próprio, com qualidade de entrega garantida sem depender do Luiz, e com a receita protegida (só quem paga constrói).

## 2. Público
- **Principal (B2B):** dono de pequeno negócio que não programa e tem uma dor clara (barbearia/salão que quer agenda, box de CrossFit que quer sistema de treinos, comércio que quer estoque/financeiro). Venda presencial, direta.
- **Secundário:** pessoa física (não é o foco).
- Público leigo: sem terminal, sem jargão, tudo em português do Brasil, com opção de fala em toda entrada.
- **Administrador:** o Luiz, que vende, acompanha e corrige o kit (painel administrativo).

## 3. Modelo de negócio
- **Implantação:** R$ 4.800 por cliente, preço fixo, pagamento único (cobre curso, treinamento e colocar o Atlas para rodar).
- **Manutenção:** ~R$ 200/mês recorrente (mantém a licença ativa: construir, corrigir no pós-obra, receber atualizações do kit).
- **Claude:** o cliente assina o Claude (Pro/Max) por conta própria; o Claude Code roda na conta dele. O Luiz não paga tokens nem empresta conta.
- **Propriedade:** o sistema e o código construídos são do cliente para sempre. Parar a mensalidade só tira o acesso ao pipeline (novas obras, pós-obra, atualizações); o sistema já entregue continua no ar.

## 4. As 5 partes do produto
1. **Kit (plugin oficial do Claude Code):** o canteiro atual endurecido para leigo.
2. **App do Atlas no Windows:** janela única que conversa com o Claude Code do cliente (telas F02–F17).
3. **Servidor de licenças:** único componente no ar; não roda obra nem usa Claude do Luiz.
4. **Web do Luiz:** vendas, cadastro, portal do cliente, painel admin, e-mails.
5. **Instalador para Windows:** instala Node, Claude Code, plugin e app; cria pasta e atalho.

## 5. Funcionalidades por tela
Cada tela cita o arquivo do protótipo (fonte da verdade). Notas de UX em canvas.json (u00–u17).

### Fase 0 — Vendas e compra
- **Página de vendas** — `prototipo/F00Vendas.dc.html`. Vídeo "Atlas em 2 min" (16:9) com botão de compra; "se dá para explicar, dá para construir" (exemplos: agenda, obra, financeiro, estoque, treinos, vendas, pedidos); canteiro 3D ("você vê a obra subir"); como funciona (a casa em 5 etapas); "você não precisa digitar"; o que você recebe; preço; para quem é e para quem não é; dúvidas; depoimentos (espaço reservado, só reais e autorizados); chamada final. Vídeo e textos editados pelo Luiz conversando com o Claude. Banner de cookies.
- **Cadastro pós-pagamento** — `prototipo/F00bCadastro.dc.html`. Logo após o pagamento confirmado, 4 respostas com microfone: como o Atlas vai te chamar, nome da empresa (se tiver), o que a empresa faz (livre), e-mail. Primeiro contato com "tudo pode ser falado". Dispara o e-mail de boas-vindas personalizado.

### Fase 1 — Instalar e preparar
- **E-mail de boas-vindas** — `prototipo/F01Email.dc.html`. Personalizado (nome, empresa, ramo); botão de instalar com link de uso único (expira ~48 h). Se aberto no celular: "abra no computador onde vai construir".
- **Instalar e ativar** — `prototipo/F02Ativacao.dc.html`. Instalador pede o e-mail da compra, envia código de 6 dígitos a esse e-mail; confirmado, registra o computador e ativa. Durante a espera ensina 3 coisas: tudo pode ser falado, o computador é o canteiro, onde fica a pasta das obras.
- **Conectar o Claude** — `prototipo/F03Claude.dc.html`. Login no Claude passo a passo (abre claude.ai, e-mail, código, Authorize); detecta e explica o plano (Pro/Max). Upgrade é feito no site do Claude, nunca aqui.
- **Abrir as contas** — `prototipo/F04Contas.dc.html`. GitHub, Supabase e Vercel com guia de mão dada (uma conta por vez, um passo por vez, imagem com botão piscando, inglês traduzido, "Não consegui"). O Atlas detecta sozinho quando cada conta ficou pronta. Pagamentos ficam para depois.
- **Acompanhar pelo celular** — `prototipo/F04bCelular.dc.html`. Deixe o computador ligado; acompanhe e dê ordens pelo app do Claude; QR code para instalar e logar na mesma conta; frequência das notícias (30 min, 1 h padrão, 3 h ou por etapa) e quais avisos quer.

### Fase 2 — Projeto e aprovação
- **Minhas obras** — `prototipo/F05Obras.dc.html`. Analogia da casa; começar do zero ou "Já tenho um protótipo"; exemplos de sistemas já feitos; primeira obra vazia com um único botão claro.
- **Nova obra** — `prototipo/F06NovaObra.dc.html`. Perguntas guiadas com microfone (não uma caixa em branco).
- **Projeto 1/3: estilo** — `prototipo/F06bEstilo.dc.html`. Vem antes das telas. Cliente manda 2–3 referências (link, print ou falando) e o que o cliente dele deve sentir; o Atlas propõe 3 estilos; o escolhido vira o design system. "Já tenho a minha identidade visual": sobe logo, cores e manual.
- **Trazer protótipo de outra IA** — `prototipo/F06cTrazer.dc.html`. Recado pronto para copiar e mandar na outra IA; pede prototipo-atlas.zip (telas HTML, design-system.md, telas.md, regras.md, imagens) + link no ar + até 5 linhas do que faltou. O Atlas confere, aponta o que falta e o Claude completa no mesmo estilo.
- **Projeto 2/3: telas** — `prototipo/F07Prototipo.dc.html`. O Claude desenha as telas com o cliente, no estilo escolhido; ajustes falando, vê o celular mudar ao lado; precisa de desfazer e versões.
- **Projeto 3/3: batismo** — `prototipo/F07bBatismo.dc.html`. No fim, com todo o contexto: 3 nomes com logo, slogan e motivo; confere nomes parecidos e se o endereço .app está livre. Quem já tem nome/logo sobe os arquivos.
- **Aprovar e começar a obra** — `prototipo/F08Aprovar.dc.html`. Mostra etapas, prazo no plano do cliente e quanto da cota a obra usa; aviso das lojas (D-U-N-S, testadores); deixa claro que dá para ajustar depois de começar.

### Fase 3 — A obra rodando
- **Obra rodando (painel/canteiro)** — `prototipo/F09Painel.dc.html`. Canteiro 3D (prédio subindo), % de avanço, prazo restante, "agora na obra"; detalhes técnicos escondidos atrás de "ver detalhes". Ao concluir: "Publicar o sistema".
- **Pausa: cota do Claude** — `prototipo/F10Pausa.dc.html`. Pausa por cota não é erro; tom calmo, hora de volta, nenhuma ação obrigatória; retoma sozinha quando a cota renova.
- **Precisa de você** — `prototipo/F11Ocorrencia.dc.html`. Único tipo de parada que exige o cliente (trava externa); passo a passo com prints; aviso no celular/e-mail.
- **Ligou o computador: retomar** — `prototipo/F12Retomar.dc.html`. Ao ligar, o Atlas abre sozinho nesta tela; um botão "Continuar obra"; retomar em até 2 cliques.

### Fase 4 — Entrega, pós-obra, licença, admin
- **Onde o sistema vai morar** — `prototipo/F13aPublicar.dc.html`. 4 opções (uma ou várias): endereço grátis (nome.vercel.app), domínio próprio (Registro.br), app instalável sem loja (PWA), App Store e Google Play. A lista do lado muda conforme o que marca. Pagamentos e "Enviar para revisão" são do cliente; o resto o Atlas faz.
- **Publicando, passo a passo** — `prototipo/F13bPublicando.dc.html`. Guia de mão dada por opção: endereço grátis (5 passos), domínio (8 passos, do Registro.br ao cadeado), app instalável (5 passos), lojas (13 passos). Cada passo diz quem faz (VOCÊ ou O ATLAS), traduz botões em inglês, tem "Não consegui".
- **Entrega do sistema** — `prototipo/F13Entrega.dc.html`. Momento de comemorar: entrega das chaves, QR para instalar no celular, link para mandar à equipe.
- **Pós-obra** — `prototipo/F14PosObra.dc.html`. Cliente descreve a mudança com as palavras dele (pode mandar print); o Atlas explica o que vai fazer antes de mexer e corrige pelo mesmo pipeline.
- **Portal do cliente (web)** — `prototipo/F15Portal.dc.html`. Ver licença, mensalidade, computador ativo; trocar de computador sem depender da máquina antiga (roubo/perda), limite 1 troca/7 dias; cancelar compra (7 dias, CDC art. 49); cancelar mensalidade sem fidelidade.
- **Seu painel (administrador)** — `prototipo/F16Admin.dc.html`. O que o Luiz vê todo dia: receita, inadimplência, ativações, clientes travados, "precisam de atenção" (casos que o Atlas não resolveu).
- **Ajuda do Atlas** — `prototipo/F17Ajuda.dc.html`. Todo o suporte é o próprio Atlas. Abre sozinho quando algo dá errado (já com print e registro do erro), pelo botão no menu ou pelo "Não consegui". Cliente fala/escreve/manda print; responde com passos curtos, traduz botões, oferece "Abrir a página certa"; fecha com "Fiz, deu certo" / "Ainda não deu". Nunca promete atendimento humano.

### Componente
- **Menu lateral (Shell)** — `prototipo/Shell.dc.html`. Navegação do app com "Falar com o Atlas" e "Ajuda do Atlas" sempre presentes.

## 6. Regras de negócio
- **Uma licença = um computador ativo.** Ativação por e-mail + código de 6 dígitos; registra uma identificação do computador.
- **Link de instalação:** uso único, expira em ~48 h; repasse não funciona (já usado/expirado e o terceiro não recebe o código).
- **Troca de computador:** pelo portal (não depende da máquina antiga), limite 1 a cada 7 dias, liberação manual pelo Luiz em caso urgente.
- **Conferência a cada obra e pós-obra:** o kit só é baixado com licença em dia e no computador ativado. Mensalidade atrasada → não constrói nem corrige (pausa em 7 dias, com aviso por e-mail antes); o sistema já entregue continua no ar.
- **Proteção contra cópia:** instruções dos agentes não ficam salvas de forma permanente (entregues pelo servidor a cada obra); marca d'água por cliente em cada cópia; aviso de licença no topo de cada arquivo (proprietário, Lei 9.609/98); contrato com multa por repasse; registro no INPI. Sem armadilhas que "denunciem" ou enviem dados.
- **Plano do Claude:** sem plano mínimo; o Atlas só detecta (Pro/Max) e comunica previsão, consumo e renovação. A obra pausa sozinha no limite e retoma quando a cota renova. Upgrade reconhecido sozinho (ou botão "Já fiz o upgrade" em 1 clique).
- **Pagamentos do sistema construído:** sempre na conta do próprio cliente (gateway dele), nunca passando pelo Luiz.
- **Pasta das obras:** C:\Users\<nome>\Atlas\Obras (fora de Desktop/Documentos por causa do OneDrive), com atalho na Área de Trabalho; a cópia oficial do código é o GitHub do cliente.
- **Tudo pode ser falado:** microfone em toda entrada, transcrição editável; tom de "amigo na mesa de um restaurante".
- **Escala:** preparado para ~100 clientes novos/mês desde o início; cadastro, ativação, cobrança e portal self-service, sem operação manual por cliente.
- **Legal:** empresa PL Engenharia; domínio atlas-ia.app.br (site, /conta, /comecar); rascunhos em docs/legal/ (termos, licença, privacidade) com revisão de advogado antes de publicar; botão "Cancelar compra", cancelamento sem fidelidade, aviso antes da pausa, banner de cookies.

## 7. Fora de escopo (v1)
- App nativo do Atlas publicado em loja (produto é plugin oficial + app Windows).
- Versão web hospedada que roda as obras nos servidores do Luiz (obra roda no computador do cliente).
- Público programador / uso por terminal (só o app de desktop do Claude, aba Code).
- Mac (desejável, não v1 — Windows é o principal).
- Hospedagem dos sistemas entregues fora de Vercel/Supabase/Fly (fica de fora na v1).
- Luiz como suporte técnico humano (todo suporte é o próprio Atlas).

## 8. Dúvidas abertas (herdadas do briefing, decidir na obra)
**Decididas (18/11/2026):**
- **Gateway:** Stripe (Pix + assinatura recorrente via Stripe Billing).
- **Carência no atraso:** 7 dias. Smart Retries da Stripe + 3 e-mails de aviso (dia 0, 3, 6); dia 7 pausa a licença (não cancela; o sistema entregue continua no ar). Pagou → reativa pelo webhook.
- **App desktop + instalador:** Electron + electron-builder (instalador NSIS), assinado com Azure Trusted Signing (evita o alerta do SmartScreen). Hash do computador = SHA-256 do `MachineGuid` do Windows. Marca d'água = hash da licença injetado como constante no build entregue + metadado.
- **Lojas:** PWA para o caso comum; TWA quando for só Android; Expo + EAS quando exigir iOS ou recurso nativo (único caminho de build iOS sem Mac, e já coberto pelo agente `corretor`).
- **Recurso PC↔celular (S20):** confirmado — é o Remote Control do Claude Code (liga a sessão à conta claude.ai; acompanha/comanda pelo app Claude no celular, com notificações push).

**Ainda pendentes (valores que só o Luiz tem):**
- CNPJ, endereço, e-mail de contato e do encarregado de dados (LGPD); cidade do foro. Recomendado: emitir com CNPJ (MEI/ME serve), foro na comarca da sede, e-mails `contato@` e `privacidade@`, e uma passada de advogado nos rascunhos de `docs/legal/`.
- Vídeo da página de vendas.
