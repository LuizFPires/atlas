# Atlas — briefing do produto

Data: 17/11/2026 · Autor da ideia: Luiz Felipe · Status: aprovado como briefing em 18/11/2026 (nome definido: Atlas)

## 1. Intenção e porquê

Atlas é o produto que transforma a "linha de produção" de subagentes do Luiz (o kit que hoje constrói o PACE e outros apps dentro do Claude Code, com o painel visual do canteiro) num produto vendido no Brasil inteiro.

O Luiz percebeu que construir software ficou muito mais fácil com esse pipeline e quer ajudar outras pessoas a fazer o mesmo. O cliente aprende com ele a desenhar e melhorar o protótipo do sistema que quer; depois o pipeline faz o desenvolvimento por completo, sozinho, no computador do cliente.

## 2. Para quem é

- **Cliente principal (B2B):** dono de pequeno negócio que não sabe programar e tem uma dor clara — barbearia ou salão que quer agenda, box de CrossFit que quer sistema de treinos, etc. O Luiz vende direto, presencialmente ("chega no salão e apresenta").
- **Secundário:** pessoa física pode comprar, mas não é o foco.
- Público leigo: sem terminal, sem jargão, tudo em português do Brasil.

## 3. Modelo de negócio (decidido pelo Luiz)

- **Implantação:** R$ 4.800 por cliente, preço fixo, pagamento único. Cobre curso, treinamento e colocar o Atlas para rodar.
- **Manutenção:** ~R$ 200/mês recorrente. Mantém a licença ativa (construir, corrigir no pós-obra e receber atualizações do kit).
- **Claude:** o cliente assina o Claude por conta própria (Pro/Max) e o Claude Code roda com a conta dele. O Luiz não paga tokens, não empresta a conta dele e não tem nenhuma ligação com o consumo do cliente.

## 4. A linha completa (analogia da obra)

1. **Curso** — o Luiz ensina a desenhar e melhorar o protótipo (conteúdo do Luiz; fora do software).
2. **Projeto** — o cliente faz o protótipo conversando com o Claude dentro do kit (etapa /prototipo já existente): descreve o negócio, o Claude desenha as telas, ele vê no navegador e pede ajustes. Nenhuma ferramenta de design para aprender.
3. **Obra** — o pipeline documenta, planeja, implementa, testa, revisa e publica sozinho, milestone a milestone. O cliente acompanha pelo painel do canteiro (prédio subindo, % de avanço, prazo restante).
4. **Entrega** — o sistema sai como **site PWA** que o cliente instala no celular e usa no dia a dia. Loja de aplicativos (App Store / Google Play) fica fora do caminho principal: no máximo uma ferramenta adicional opcional, mais tarde.
5. **Pós-obra** — quando o cliente quer uma mudança ou algo quebra, abre o pós-obra, descreve em português; o Claude dele investiga, explica e corrige pelo mesmo pipeline (teste, revisão, publicação).

## 5. Objetivos, não objetivos e anti-objetivos

**Objetivos**
- Leigo constrói e mantém sozinho um sistema de uso próprio que resolve uma dor do dia a dia e aumenta a produtividade.
- Todas as etapas "cercadas": qualidade de entrega sem depender do Luiz.
- Receita protegida: só quem paga constrói; cópia casual bloqueada; vazamento rastreável.

**Não objetivos (por agora)**
- App nativo publicado em loja.
- Versão web hospedada que roda as obras nos servidores do Luiz.
- Público programador.
- Plano mínimo do Claude (o cliente escolhe; ver 8.5).

**Anti-objetivos (seria fracasso mesmo funcionando)**
- O Luiz virar suporte técnico: cliente ligando para resolver erro, publicação travada, app reprovado em loja.
- Qualquer custo ou risco atrelado ao Claude/conta do Luiz; sobrecarga ou indisponibilidade por volume nacional.
- Proteção que atrapalhe o cliente pagante (falso bloqueio, trava que dispara por engano).

## 6. Restrições

- **Regras da Anthropic:** produtos de terceiros não podem usar o login de assinatura Claude (Pro/Max) do cliente; isso só vale para os produtos oficiais da Anthropic. Por isso o pipeline roda **dentro do Claude Code oficial** do cliente, como plugin, e não num programa do Luiz que comanda o Claude por trás. (Fontes: docs do Agent SDK e "Legal and compliance" do Claude Code; regra explicitada em fev/2026.)
- O kit é feito de textos (instruções de agentes e skills) que o Claude precisa ler; não há como criptografá-los no computador do cliente. Proteção total é impossível; o objetivo é dificultar, rastrear e fazer pagar valer mais a pena.
- Windows é o sistema principal do público (o kit atual já roda em Windows com .bat). Mac é desejável.
- Serviços externos que o sistema construído usa (GitHub, Supabase, Vercel) exigem contas do cliente; é onde o leigo mais trava.
- LGPD: nada de coletar ou enviar dados do cliente sem consentimento.

## 7. Abordagens consideradas

1. **Plugin oficial do Claude Code + servidor de licenças do Luiz — ESCOLHIDA.** O kit vira plugin distribuído por um marketplace privado; as instruções dos agentes são entregues pelo servidor a cada obra, só com licença ativa. Usa o caminho oficial (sem risco com as regras), reaproveita ~80% do kit atual, servidor pequeno e barato.
2. **Programa próprio "Atlas" que comanda o Claude Code por trás.** Melhor experiência para leigo, mas projeto muito maior e zona cinzenta das regras de uso de assinatura por terceiros. Descartada por agora; pode virar "casca" depois, se a Anthropic permitir formalmente.
3. **Kit em arquivos com checagem de licença ao iniciar.** Rápido, mas proteção fraca (basta apagar a checagem). Descartada.
4. (Avaliada e descartada) **Sistema web do Luiz rodando as obras com chave de API do cliente.** Funciona dentro das regras, mas o cliente pagaria por uso (custo variável) e o Luiz teria infraestrutura e responsabilidade de rodar as obras — contraria o anti-objetivo de risco/custo.

## 8. O que o Luiz decidiu sobre o "como"

### 8.1 Componentes
- **Plugin Atlas (no computador do cliente):** os agentes, skills e hooks do kit atual, adaptados para leigo e para o fluxo de licença. Painel do canteiro local (navegador) como tela principal de acompanhamento.
- **Instalador para Windows:** instala o que for preciso (Claude Code, Node, plugin) e faz a ativação. O cliente nunca mexe na pasta do kit.
- **Servidor de licenças do Luiz (único componente no ar):** login, licenças, ativação de computador, entrega do kit, marca d'água, painel administrativo do Luiz. Não roda obra nenhuma, não usa Claude do Luiz.
- **Portal web do cliente:** ver licença, mensalidade, computador ativo; desativar computador para trocar de máquina.

### 8.2 Licença e ativação
- **Uma licença = um computador ativo.**
- Ativação: o Luiz cadastra o cliente (e-mail da compra) → cliente recebe e-mail com **link de instalação de uso único** (expira em ~48 h) → instalador pede o e-mail da compra e envia **código de 6 dígitos** a esse e-mail → confirmado, registra uma identificação do computador e ativa.
- Link repassado (WhatsApp etc.) não funciona: já usado/expirado e o terceiro não recebe o código no e-mail do cliente.
- **Troca de computador:** pelo portal web (não depende da máquina antiga, caso de roubo/perda): entra com e-mail + código, desativa o computador atual, ativa no novo. Reaproveita a licença quantas vezes precisar. Limite de trocas: ver 8.6.
- **Conferência a cada obra e a cada pós-obra:** o kit só é baixado com licença em dia e no computador ativado. Mensalidade atrasada → não constrói nem corrige; o sistema já entregue do cliente continua no ar.

### 8.3 Proteção contra cópia
- Instruções dos agentes **não ficam salvas** no disco de forma permanente: entregues pelo servidor a cada obra.
- **Marca d'água** por cliente em cada cópia entregue (identifica quem vazou).
- **Aviso de licença visível** no topo de cada arquivo (software proprietário, licenciado a X, Lei 9.609/98). IAs sérias se recusam a ajudar a burlar licença com esse aviso claro.
- **Contrato** de licença de uso com multa por repasse; registro do software no INPI.
- **Rejeitado:** armadilhas escondidas para a IA "denunciar", sabotar ou enviar dados (não confiável, pode atingir o cliente pagante, risco LGPD).

### 8.4 Foco do que o pipeline entrega
- Sistemas de uso próprio do cliente, entregues como **site PWA**.
- Etapa guiada de **"abrir as contas"** (GitHub, Supabase, Vercel) com passo a passo em tela, em português.
- Ocorrências (travas externas) explicadas em linguagem simples, dizendo o que o cliente precisa fazer.

### 8.5 Decisões do Luiz após a revisão (17/11)
1. **Sistemas sem travas:** o cliente pode construir sistemas completos, inclusive com usuários externos (clientes da barbearia fazendo login, conferindo agenda, pagando online). O pipeline precisa saber construir login de usuários finais, notificações e pagamento online — com o pagamento caindo na conta do próprio cliente (conta dele no gateway), nunca passando pelo Luiz. LGPD do sistema construído é responsabilidade do cliente; o pipeline gera o básico (termos, consentimento, exclusão de conta).
2. **Autonomia total:** instalação, abertura de contas e uso têm de funcionar sozinhos, sem o Luiz presente e sem intervenção dele. Instalador e assistente de contas autoexplicativos ("se auto-ensinar"). O Luiz pode acompanhar presencialmente os primeiros clientes, mas o produto não depende disso.
3. **Sem plano mínimo do Claude:** o cliente escolhe. O Atlas identifica o plano dele (Pro, Max…) e comunica antes e durante a obra: quanto da cota a obra deve consumir, quando provavelmente vai parar por limite, quando a cota renova e quanto tempo a obra deve levar naquele plano. A obra pausa sozinha no limite e retoma quando renovar (como já acontece no PACE).
4. **Escala desde o início:** preparado para ~100 clientes novos por mês, crescendo sem teto conhecido. Cobrança recorrente automática, cadastro e ativação self-service, portal do cliente, painel administrativo do Luiz e servidor de licenças robusto (alta disponibilidade, sem gargalo) desde a primeira versão. Nada que dependa de operação manual do Luiz por cliente.
5. **Propriedade:** o sistema e o código construídos são do cliente para sempre, mesmo depois de parar de pagar. Ao parar a mensalidade, perde só o acesso ao pipeline (novas obras, pós-obra, atualizações). O kit não fica no repositório do cliente.

### 8.6 Decisões do Claude (o Luiz pode corrigir)
- O cliente usa o Claude Code pelo **app de desktop do Claude (aba Code)**, nunca pelo terminal. O construtor deve confirmar o que essa superfície suporta (plugins, hooks, comandos) e desenhar em torno disso.
- Hospedagem dos sistemas entregues em serviços cujo plano gratuito permite uso comercial e não pausa com uso diário (ex.: Cloudflare Pages + Supabase), com aviso claro de quando o cliente precisa migrar para plano pago.
- Troca de computador: limite de 1 troca a cada 7 dias, com liberação manual pelo Luiz em caso urgente.

## 9. O que fica para o construtor decidir
- Stack do servidor de licenças e do portal (sugestão: mesma stack que o pipeline já domina — Supabase + Vercel).
- Gateway de pagamento da mensalidade e cobrança recorrente (Asaas, Mercado Pago, Stripe etc.) e o que acontece em atraso (carência).
- Como o plugin busca as instruções no servidor (MCP do Canteiro, download por obra com expiração, etc.) e como funciona sem internet por pouco tempo.
- Formato da marca d'água e identificação do computador.
- Tecnologia do instalador (assinado digitalmente).
- Quanto do kit atual precisa ser reescrito para linguagem de leigo.


## 10. Nome
- O produto se chama **Atlas** (decidido pelo Luiz em 18/11/2026). O painel visual da obra continua sendo o "canteiro" dentro do Atlas.

## 12. Upgrade de plano reconhecido sozinho

- O cliente faz o upgrade (Pro → Max) no site do Claude. No Atlas não existe escolha de plano: ele só lê o plano que o cliente assina.
- A velocidade nova vale na hora, porque o limite de uso é controlado pela Anthropic, não pelo Atlas.
- O Atlas confere o plano ao abrir, antes de cada obra e a cada pausa por cota. Quando muda, avisa: "Vimos que agora você está no Max. A previsão da obra foi atualizada."
- A testar na implementação: se o Claude Code só mostra o plano novo depois de entrar de novo, o Atlas renova a conexão sozinho. Se não der, mostra um único botão "Já fiz o upgrade", que reconecta em 1 clique.

## 13. Conhecer o cliente (logo depois do pagamento)

- Na página de vendas, assim que o pagamento é confirmado, o cliente responde 4 perguntas, todas com microfone: "Como o Atlas vai te chamar?", "Qual o nome da sua empresa? (se tiver)", "O que a sua empresa faz? (com as suas palavras)" e "Qual o seu e-mail?".
- O e-mail de boas-vindas sai já personalizado, com nome, empresa e ramo.
- É o primeiro contato com a regra "tudo pode ser falado".
- Os dados servem para chamar o cliente pelo nome, sugerir ideias do ramo, dar contexto ao Claude e aparecer no painel do administrador.
- Durante a instalação, o Atlas usa o tempo de espera para ensinar 3 coisas: tudo pode ser falado, o computador é o canteiro (deixe ligado e acompanhe pelo celular) e onde fica a pasta das obras.

## 14. Tudo pode ser falado (regra de produto)

- Toda comunicação do cliente com o Atlas tem opção de fala: perguntas, protótipo, pedidos de mudança, pós-obra. O Atlas transcreve e mostra o texto para o cliente corrigir se quiser.
- Isso fica claro desde o primeiro contato: no e-mail de boas-vindas e no início da instalação ("Aqui tudo pode ser falado").
- O tom é sempre: converse como se estivesse com um amigo na mesa de um restaurante. Não precisa falar certo nem bonito.
- O menu lateral tem sempre o botão "Falar com o Atlas". Digitar continua possível, como alternativa.

## 15. Computador ligado, acompanhamento pelo celular

- Mensagem para o cliente: "Deixe o computador ligado e acompanhe pelo app do Claude, de onde estiver."
- Por quê: o computador é o canteiro. Os arquivos e as ferramentas da obra ficam nele, então ele precisa ficar ligado enquanto a obra roda.
- Último passo do primeiro uso ("Acompanhar pelo celular"): QR code para baixar o app do Claude, com login na mesma conta.
- O cliente escolhe de quanto em quanto tempo recebe notícias: a cada 30 min, a cada 1 h (padrão), a cada 3 h ou só quando terminar uma etapa.
- Avisos ligáveis: quando a obra precisar dele, quando uma etapa terminar, quando a obra ficar pronta.
- Pelo app ele responde e dá ordens, falando ou escrevendo: "pausa a obra", "troca a cor do botão", "como está?".
- A confirmar na implementação: o recurso do Claude Code que liga a sessão do computador ao app do celular, as notificações e o agendamento das notícias.

## 16. Fase de projeto em 3 etapas: estilo, telas, batismo

1. **Estilo (design system).** Vem antes das telas.
   - O cliente manda 2 ou 3 sites ou apps que acha bonitos (link, print ou falando).
   - Diz o que o cliente dele deve sentir (confiança, tradição, elegância…).
   - O Atlas propõe 3 estilos. O escolhido vira o design system: cores, letras, botões.
   - Quem já tem identidade visual sobe a logomarca, as cores e o manual, e o Atlas monta o design system a partir disso.
2. **Telas (protótipo).** O Claude desenha as telas com o cliente, já no estilo escolhido.
3. **Batismo (nome e logomarca).** Vem no fim, quando já existe todo o contexto: o que o sistema entrega e para quem.
   - O Atlas sugere 3 nomes, cada um com logo, slogan e o motivo.
   - Antes de o cliente decidir, o Atlas procura nomes parecidos e confere se o endereço .app está livre.
   - O cliente pode usar a sugestão ou subir o nome e a logomarca que já tem.
- Depois das 3 etapas vem a aprovação (etapas e prazo da obra).

## 17. Trazer o que o cliente já tem

- **Design system pronto:** em "Estilo → Já tenho a minha identidade visual" o cliente sobe a logomarca, as cores, o manual ou um design system pronto (PDF, link do Figma ou design-system.md).
- **Protótipo pronto, feito em outra IA** (Claude, ChatGPT, Codex, Lovable…): em "Minhas obras → Já tenho um protótipo".
  1. O Atlas mostra um recado pronto para o cliente copiar e mandar na conversa onde fez o protótipo.
  2. O recado pede: um prototipo-atlas.zip (telas/ em HTML que abrem sozinhas, design-system.md, telas.md, regras.md, imagens/), o protótipo publicado num link que abra no celular, e até 5 linhas sobre o que ficou faltando ou de mentirinha.
  3. O cliente sobe o .zip e o link. O Atlas confere o que chegou e aponta o que falta, e o Claude completa no mesmo estilo. Depois o fluxo segue normal: ajuste das telas, batismo, aprovação.

## 18. Pasta das obras no computador do cliente

- O instalador cria a pasta **C:\Users\<nome>\Atlas\Obras**, com um atalho "Atlas · minhas obras" na Área de Trabalho. É o equivalente ao Desktop\Claude do Luiz.
- Fica fora da Área de Trabalho e de Documentos de propósito. No Windows 11 essas pastas costumam ser sincronizadas pelo OneDrive, que trava e corrompe repositórios git durante a obra.
- Cada obra ganha uma subpasta com nome simples (ex.: agenda-barbearia-do-ze). Dentro ficam o projeto (estilo, protótipo, nome e marca), o código ligado ao GitHub do cliente e as entregas.
- O cliente não precisa mexer na pasta. O Atlas tem o botão "Abrir a pasta" para quem quiser ver.
- A cópia oficial do código é o GitHub do cliente. Se o computador quebrar, a obra volta inteira no computador novo.

## 19. Página de vendas (protótipo)

- **Entrada:** título, subtítulo e logo abaixo o vídeo explicativo do Luiz (16:9, "o Atlas em 2 minutos"), com o botão de compra embaixo.
- **O que dá para construir:** "Se dá para explicar, dá para construir." Exemplos: agenda de barbearia, controle de obra, sistema financeiro, estoque, app de treinos, vendas e clientes, pedidos e cardápio, a sua ideia. Os sistemas funcionam no celular (como aplicativo) e no computador (pelo navegador), com login para a equipe e os clientes.
- **Canteiro 3D:** "Você vê a obra subir."
- **Seções seguintes:** como funciona (a casa em 5 etapas), "você não precisa digitar", o que você recebe e preço.
- **Para quem é e para quem não é:**
  - É para quem sabe explicar o próprio negócio, hoje controla tudo no papel, em planilhas ou no WhatsApp, quer o sistema do seu jeito e topa participar.
  - Não é para quem quer que façam tudo sem participar, precisa de um sistema para amanhã, não tem computador com Windows para deixar ligado, quer só um site de vitrine ou não quer assinar o Claude.
- **Fim da página:** dúvidas, depoimentos (só reais e autorizados, até lá fica um espaço reservado) e chamada final.
- **Edição:** vídeo e textos são trocados pelo Luiz aqui, conversando com o Claude. Não há painel de edição na página.
- **A definir:** forma de pagamento, razão social e CNPJ, Termos, Licença e Privacidade.

## 20. Todo suporte é o próprio Atlas

- Não existe atendimento humano. Toda ajuda é a "Ajuda do Atlas": o Claude por dentro, com a cara e o tom do Atlas.
- Formas de abrir a ajuda:
  - Sozinha, quando algo dá errado, já com o print da tela e o registro do erro.
  - Pelo botão "Ajuda do Atlas" no menu lateral.
  - Pelo "Não consegui" de cada passo guiado.
- O cliente fala, escreve ou manda print. O Atlas responde com passos curtos, traduz os botões em inglês e oferece "Abrir a página certa". No fim pergunta "Fiz, deu certo" ou "Ainda não deu" e, se preciso, tenta outro caminho.
- Quando o problema é do lado do Atlas (comando, configuração, publicação), ele resolve sozinho e só avisa.
- Casos que o Atlas não resolve aparecem no painel do administrador ("Precisam de atenção"), para o Luiz corrigir no kit e mandar a correção a todos os clientes.

## 21. Publicação de ponta a ponta

O que o cliente escolhe, numa tela só, uma ou várias opções:
- Endereço grátis (nome.vercel.app).
- Domínio próprio (.com.br pelo Registro.br, ou outro registrador).
- App instalável sem loja (PWA).
- App Store e Google Play.

Pagamentos, contas de desenvolvedor, verificação em duas etapas e "Enviar para revisão" são sempre do cliente. O resto o Atlas faz.

**O que o kit já cobre (skill entregar + vistoriador, implantador e corretor):**
- Vistoria final.
- Deploy em Vercel, Supabase e Fly.io, com homologação antes da produção.
- PWA (projetos Vite com vite-plugin-pwa).
- App Expo enviado ao TestFlight e ao teste interno do Google Play, com build iOS na nuvem pelo EAS, que funciona no Windows.
- Textos, privacidade e prints da loja em store/.
- Domínio: o implantador diz o que cadastrar no DNS.

**Lacunas a fechar no kit antes de vender:**
1. **Sistema web nas lojas.** O corretor só publica app feito em Expo. Para um sistema web (PWA) chegar às lojas é preciso empacotar (Capacitor, ou TWA no Android), ou decidir no projeto que a obra terá app Expo. Risco: a Apple costuma recusar app que é só um site embrulhado (regra 4.2, funcionalidade mínima). O Atlas precisa avisar isso e recomendar o caminho certo.
2. **Comprar domínio, guiado para leigo.** Hoje o kit só diz o que cadastrar no DNS. Falta o passo a passo: conferir se o nome está livre, abrir o Registro.br, o cliente paga, e o Atlas leva até a tela de DNS ou usa os servidores da Vercel.
3. **Google Play com conta pessoal nova.** Precisa de teste fechado com 12 testadores por 14 dias antes de publicar. O Atlas precisa avisar antes e ajudar a juntar os testadores.
4. **Conta Apple de empresa.** Exige número D-U-N-S, que pode levar dias. Avisar cedo, ainda no projeto.
5. **Linguagem.** Os passos do corretor estão em linguagem técnica (ex.: "! npx eas-cli ..."). Para o cliente, tudo vira passo guiado com imagem, como na tela de abrir as contas.
6. **Hospedagem fora de Vercel, Supabase e Fly.** Hoje não há. Decidir se entra ou fica de fora (sugestão: fica de fora na v1).

## 22. Publicar com guia de mão dada, até o último estágio

- Depois de escolher onde o sistema vai morar, cada opção vira um guia passo a passo, no mesmo formato da tela de abrir as contas:
  - imagem da tela com o botão certo piscando;
  - "Fiz isso" para avançar;
  - "Não consegui" abre a Ajuda do Atlas;
  - cada passo diz quem faz: VOCÊ ou O ATLAS.
- **Exemplo do domínio .com.br (Registro.br):**
  1. O Atlas confere se o nome está livre.
  2. Abre o Registro.br com o nome já pesquisado.
  3. O cliente clica em Registrar e entra com CPF ou CNPJ (ou cria a conta).
  4. Paga com Pix.
  5. Abre o domínio e o DNS.
  6. Cola as 2 linhas que o Atlas preparou (A @ 76.76.21.21 e CNAME www cname.vercel-dns.com) e salva.
  7. O Atlas confere a cada 5 minutos até o endereço responder, liga o cadeado e avisa no celular.
- Os outros guias seguem o mesmo padrão: app instalável e lojas (contas de desenvolvedor, pagamento, teste, "Enviar para revisão", acompanhamento da revisão até a publicação).
- **A conferir na implementação:** os nomes exatos dos botões no site do Registro.br e os valores de DNS atuais da Vercel (o kit deve ler esses valores da Vercel na hora, não deixá-los fixos).

### 22.1 Os 4 guias de publicação (protótipo, tela 13b)

- **Endereço grátis (5 passos):**
  1. Vistoria final.
  2. O cliente confirma o nome .vercel.app.
  3. O Atlas publica e liga o banco de dados.
  4. O cliente testa no celular pelo QR code.
  5. No ar.
- **Domínio próprio (8 passos):** do Registro.br até o cadeado, como na seção 22.
- **App instalável, sem loja (5 passos):**
  1. O Atlas prepara o ícone e o nome.
  2. O cliente testa a instalação no Android (Chrome → Instalar app).
  3. O cliente testa no iPhone (Safari → Compartilhar → Adicionar à Tela de Início).
  4. O Atlas gera um cartaz com QR code e instruções para os clientes.
  5. Pronto.
- **App Store e Google Play (13 passos):**
  1. O Atlas transforma o sistema num app de celular próprio (a Apple recusa site embrulhado).
  2. O cliente cria a conta Apple Developer (US$ 99/ano; empresa precisa do D-U-N-S).
  3. O cliente cria a conta Google Play Console (US$ 25, uma vez, com documento).
  4. O Atlas prepara textos, telas, ícone e privacidade.
  5. O cliente cria o app no App Store Connect, colando nome e identificador.
  6. O cliente faz o primeiro login com o Apple ID (código no iPhone).
  7. O Atlas monta o app na nuvem e envia para teste (TestFlight e teste interno).
  8. O cliente testa no celular.
  9. Google, conta pessoal nova: 12 testadores por 14 dias (o Atlas prepara a mensagem e conta os dias).
  10. O cliente confere os formulários de privacidade e de classificação etária.
  11. O cliente aperta "Enviar para revisão".
  12. O Atlas acompanha a revisão e corrige o que a loja pedir.
  13. Publicado.
- Cada passo diz se é VOCÊ ou O ATLAS, traduz os botões em inglês e tem "Não consegui", que abre a Ajuda do Atlas.
- Pendência de kit: hoje o corretor só publica app feito em Expo. Ou toda obra que for para loja nasce com app Expo (decidir no projeto), ou o kit ganha o empacotamento do sistema web.

## 23. As partes do produto (para o escritor dividir a obra)

O Atlas não é um app só. São 5 partes, que podem virar blocos de milestones nesta ordem:

1. **Kit (plugin oficial do Claude Code).** O canteiro que já existe em .claude/, endurecido para leigo:
   - lacunas da seção 21;
   - linguagem simples;
   - Ajuda do Atlas;
   - notícias para o celular;
   - retomada da obra;
   - pasta Atlas\Obras.
2. **App do Atlas no Windows.** As telas 02 a 17 do protótipo: uma janela única que conversa com o Claude Code do cliente.
   - Restrição: o login é o do próprio Claude Code (a Anthropic não permite OAuth de assinatura em app de terceiros).
   - Abre com o Windows, impede o computador de dormir durante a obra e tem microfone em tudo.
3. **Servidor de licenças do Luiz.**
   - Ativação por e-mail e código.
   - 1 licença por computador, com troca a cada 7 dias.
   - Entrega do kit por obra, com marca d'água.
   - Bloqueio quando a mensalidade atrasa (pausa em 7 dias).
4. **Web do Luiz:**
   - página de vendas (F00);
   - cadastro pós-pagamento (F00b);
   - portal do cliente (F15);
   - painel do administrador (F16);
   - e-mails (F01).
5. **Instalador para Windows.** Instala Node, Claude Code, o plugin e o app, e cria a pasta e o atalho.

Restrições gerais:
- Nunca guardar segredo em arquivo.
- O que é pagamento ou assinatura é sempre do cliente.
- O código das obras é do cliente.
- Escala de ~100 clientes novos por mês desde o início.

Decisões já tomadas pelo Luiz (18/11/2026):
- domínio do Atlas: **atlas-ia.app.br** (site, portal em /conta, cadastro em /comecar);
- empresa: **PL Engenharia** (CNPJ a informar);
- textos legais: rascunhos em docs/legal/ (termos-de-uso.md, licenca-de-uso.md, politica-de-privacidade.md), com os campos entre colchetes para completar e revisão de advogado antes de publicar.

Decisões ainda pendentes:
- gateway de pagamento (Pix e recorrência);
- CNPJ, endereço e e-mail de contato e do encarregado de dados (LGPD);
- cidade do foro;
- vídeo da página de vendas.
- Pontos que o legal exige do produto: botão "Cancelar compra" no portal (arrependimento de 7 dias, CDC art. 49), cancelamento da mensalidade sem fidelidade, aviso por e-mail antes da pausa por atraso, banner de cookies no site.
