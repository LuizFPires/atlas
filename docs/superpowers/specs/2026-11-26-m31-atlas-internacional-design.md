# M31 — Atlas em inglês e em dólar (desenho)

Data: 26/11/2026 · Decisões do Luiz nesta conversa (05:05–05:24, horário de Brasília).

## Por quê

Vender o Atlas fora do Brasil. Quem está aqui continua vendo tudo em português e em real, como hoje. Quem está fora vê
tudo em inglês e em dólar, do site até a obra pronta, sem achar que caiu num site brasileiro.

## Metas

1. **Um site só, com dois endereços.** atlas-ia.app.br = português e real. use-atlas-ai.com (comprado em 26/11/2026) = inglês e dólar.
   Mesmo código, mesma Vercel, mesmo servidor.
2. **Cada pessoa cai na porta certa.**
   - O endereço digitado decide o idioma.
   - Na primeira visita, a localização leva quem está fora para o .com e quem está no Brasil para o .app.br.
   - A **bandeirinha** no topo troca de um endereço para o outro e o site lembra a escolha. A escolha da pessoa vale mais
     que a localização.
3. **O idioma segue a pessoa depois da compra.** A licença guarda o idioma. O instalador, o app, os e-mails, a Ajuda e
   a linha de produção (agentes, briefing, PLAN, canteiro) saem nesse idioma.
   Depois da compra o idioma não muda mais (decisão do Luiz, 26/11/2026, 05:51): quem comprou em inglês usa o Atlas
   em inglês para sempre; não há troca de idioma dentro do app.
4. **Preço próprio em dólar:** US$ 1.700 de implantação + US$ 70/mês. Não é conversão de câmbio.
   App pronto da vitrine ("Comece pronto"): US$ 2.400 (decisão do Luiz, 26/11/2026), com a mesma mensalidade de US$ 70.
5. **Real só com CPF.** A bandeira troca o idioma, mas a moeda é decidida no pagamento: em real só com CPF (Pix ou cartão
   brasileiro); sem CPF, em dólar. Um brasileiro que mora fora pode usar em inglês e pagar em real com o CPF dele.

## Não metas (agora)

- Outros idiomas além de português e inglês (a camada nasce pronta para um terceiro, mas não fazemos agora).
- Outras moedas além de real e dólar.
- Atendimento humano em inglês. Continua valendo a regra de sempre: o suporte é a Ajuda do Atlas, que responde no idioma
  da pessoa.

## Anti-metas (seria um fracasso mesmo funcionando)

- Inglês "traduzido": o tom "amigo na mesa de um restaurante, explicando como para uma criança de 5 anos" tem que existir
  em inglês, escrito para americano, não traduzido palavra por palavra.
- Um americano que pague em real, ou um brasileiro que seja cobrado em dólar sem querer.
- Um texto esquecido em português no meio da versão em inglês (um teste falha se faltar tradução).
- Mudar alguma coisa para quem está no Brasil.

## Como (minhas escolhas técnicas, para você corrigir)

**Camada de idioma: dicionário próprio, com tipos.** Cada texto vira uma chave com versão `pt` e `en`, num arquivo por
área (vendas, app, e-mails...). O TypeScript acusa erro se faltar a versão em inglês de alguma chave.
- Alternativa descartada: biblioteca pronta (i18next / react-intl). Funciona, mas pesa mais e não acusa a tradução que
  falta tão cedo. Para dois idiomas, o dicionário próprio basta.
- Datas, dinheiro e números usam o formato do país: R$ 4.800,00 / US$ 1,700.00, e 26/11 / Nov 26.

**Endereço e bandeira.** A Vercel informa o país de quem acessa. A regra de primeira visita (sem a escolha guardada)
fica na configuração da Vercel, sem servidor novo. A versão em inglês também responde em atlas-ia.app.br/en, que funciona
desde já, antes da compra do .com, e ajuda o Google a mostrar a versão certa para cada país.

**Pagamento.** O Stripe já cobra o Atlas e aceita dólar com preços próprios. O checkout recebe o mercado:
`br` (exige CPF; Pix ou cartão) ou `us` (sem CPF; cartão em dólar). Mantém a mesma trava de integridade de hoje.

**Licença e app.** A licença ganha o campo `idioma` (`pt` | `en`), gravado na compra. O instalador e o app lêem esse
campo na ativação. Vale para Windows e Mac: o instalador do Windows e o do Mac saem em duas versões cada (português e inglês), e a página do link (que já reconhece Mac ou Windows, M47) entrega a certa para o sistema e o idioma da pessoa.

**Linha de produção.** As instruções dos agentes já vêm do servidor a cada obra (não ficam no computador do cliente).
O servidor passa a entregar a versão no idioma da licença. O briefing, o PLAN, o canteiro e as mensagens da obra saem
nesse idioma. Os sistemas que o cliente constrói seguem o idioma que ele pedir para o sistema dele, que pode ser
diferente.

## Ordem (cada parte é testável sozinha)

1. **Protótipo primeiro** (regra do projeto): página de vendas em inglês e a bandeirinha. Você aprova antes do código.
2. Camada de idioma + página de vendas em inglês (/en), bandeira, regra da primeira visita.
3. Pagamento em dólar com a regra do CPF; e-mails da compra em inglês; licença guarda o idioma.
4. Instalador em inglês e o app inteiro em inglês (a parte maior: ~70 telas).
5. Linha de produção em inglês (agentes, canteiro, Ajuda).
6. Textos legais de fora (termos e privacidade) e a ligação do .com quando ele existir.

## O que depende de você (não decido sozinho)

- **Domínio .com:** comprado e ligado na Vercel pelo Luiz em 26/11/2026: **use-atlas-ai.com** (o sem www manda para
  www.use-atlas-ai.com). Qualquer acesso por esse domínio abre em inglês.
- **Marca "Atlas" nos EUA:** existem muitas empresas "Atlas" de IA. Vale um advogado conferir antes de investir lá fora.
- **Termos e privacidade em inglês:** fora do Brasil a LGPD não vale (GDPR na Europa, CCPA na Califórnia). Advogado.
- **Impostos das vendas em dólar** (nota fiscal de exportação de serviço, impostos lá fora): contador.
- **O tom em inglês:** eu escrevo e você aprova no protótipo.

## Riscos

- O app tem ~4.800 linhas com texto em português fixo. A troca é mecânica, mas é grande; um teste procura texto em
  português que ficou fora do dicionário.
- A linha de produção em inglês precisa ser testada com uma obra de verdade do começo ao fim.
