# M31 — Atlas em inglês e em dólar: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O Atlas vendido e usado em inglês e em dólar fora do Brasil, sem mudar nada para quem está no Brasil.

**Architecture:** Um site com dois endereços: atlas-ia.app.br (e /en) e use-atlas-ai.com (comprado em 26/11/2026, já ligado na Vercel). O idioma vem do endereço,
da localização na primeira visita e da bandeirinha (que vale mais). Os textos ficam num dicionário tipado `pt`/`en`. O
checkout recebe o mercado (`br` com CPF, `us` em dólar). A licença guarda o idioma, e o app, o instalador e a linha de
produção seguem esse idioma.

**Tech Stack:** Vite + React + TS (vitest), Electron (node --test), Supabase edge functions (Deno, vitest em
supabase/tests), Stripe, Vercel (vercel.json).

**Spec:** docs/superpowers/specs/2026-11-26-m31-atlas-internacional-design.md

## Global Constraints

- Preço em dólar: US$ 1.700 de implantação (uma vez) + US$ 70/mês; app pronto US$ 2.400 + US$ 70/mês. Em real continua R$ 4.800 (app pronto R$ 7.300) + R$ 200/mês.
- Real só com CPF. Sem CPF, a cobrança é em dólar.
- A bandeirinha vale mais que a localização; a escolha fica guardada no cookie `atlas_idioma` (`pt` | `en`).
- Nada muda para quem está no Brasil: os testes atuais em português continuam passando sem alteração.
- Protótipo primeiro: nenhum código de tela antes do "aprovado" do Luiz no protótipo (Task 1).
- PLAN.md: não mudar o formato (peso/spec/tela; `- [ ]`); divergências vão nas Notas.
- Commits com as linhas de coautoria da sessão; PR via gh REST; merge só com CI verde.

## Review Focus

1. Alguém de fora com a bandeira do Brasil tenta pagar em real sem CPF → o checkout precisa recusar ou mandar para dólar.
2. Chave de texto sem versão em inglês → erro de TypeScript, nunca um texto em português aparecendo no /en.
3. Primeira visita de quem está no Brasil com cookie `en` guardado → continua em inglês (a escolha vence a localização).
4. Robôs do Google sem cookie → o redirecionamento por país não pode esconder a versão em português do Brasil (usar `hreflang`).
5. Formato de dinheiro: `US$ 1,700` no inglês e `R$ 4.800` no português, nunca misturados.

---

### Task 1: Protótipo (o Luiz aprova antes de qualquer código de tela)

Decisão do Luiz (26/11/2026): o idioma é escolhido na página de vendas e na compra e não muda mais depois; o app não tem troca de idioma.

**Files:**
- Create: `prototipo/F00VendasEN.dc.html` (cópia do F00 com todos os textos em inglês, escritos para americano, e o preço US$)
- Modify: `prototipo/F00Vendas.dc.html` (bandeirinhas Brasil / EUA no topo, à direita do menu)

- [ ] Escrever o F00VendasEN com o mesmo layout e todas as seções. Tom: "a friend at a restaurant table", frases curtas.
- [ ] Bandeirinhas: SVG de traço (nunca emoji), a ativa com borda lime, `aria-label` "Português (Brasil)" e "English (US)".
- [ ] Publicar as 2 telas para o Luiz ver (artifact) e esperar o "aprovado". Registrar a aprovação nas Notas do M31.
- [ ] Commit: `M31: protótipo da página em inglês, bandeirinhas e idioma no app`.

**Vitrine "Comece pronto" em inglês:** entra, com o app pronto a US$ 2.400 + US$ 70/mês (decisão do Luiz, 26/11/2026).

### Task 2: Camada de idioma

**Files:**
- Create: `src/i18n/idioma.ts`, `src/i18n/idioma.test.ts`

**Interfaces — Produces:**
- `type Idioma = 'pt' | 'en'`
- `idiomaDaPagina(o: { caminho: string; host: string; cookie: string | null }): Idioma`: o cookie vence; depois o caminho
  `/en` ou o host `.com`; senão `pt`.
- `dinheiro(valorCentavos: number, idioma: Idioma): string` → `R$ 4.800` / `US$ 1,700`
- `type Dicionario<T> = { pt: T; en: T }`

- [ ] Testes, escritos antes: o cookie `en` em atlas-ia.app.br/ → `en`; `/en` sem cookie → `en`; o host `www.use-atlas-ai.com` e `use-atlas-ai.com` → `en`;
  o cookie `pt` em /en → `pt`; `dinheiro(480000,'pt') === 'R$ 4.800'`; `dinheiro(170000,'en') === 'US$ 1,700'`.
- [ ] Ver os testes falharem; implementar; ver passarem; commit.

### Task 3: Página de vendas em inglês + bandeirinhas

**Files:**
- Create: `src/web/conteudo.en.ts` (mesmo formato de `conteudo.ts`, com `satisfies typeof import('./conteudo')` para o TS acusar chave faltando)
- Create: `src/web/BandeiraIdioma.tsx` + teste
- Modify: `src/web/Vendas.tsx` (recebe `idioma`; textos fixos do JSX vão para o conteúdo), `src/App.tsx` (rota `/en` → vendas em inglês; outras rotas `/en/...` seguem o mesmo padrão quando forem traduzidas), `index.html` (`lang` e `hreflang` alternates)

**Interfaces — Consumes:** Task 2 (`Idioma`, `idiomaDaPagina`, `dinheiro`).

- [ ] Teste: /en mostra o título em inglês e "US$ 1,700"; nenhum texto do `conteudo.ts` em português aparece no /en.
- [ ] Teste: clicar na bandeira dos EUA grava `atlas_idioma=en` e vai para /en; a do Brasil grava `pt` e vai para /.
- [ ] Teste de fidelidade: textos do /en iguais ao F00VendasEN aprovado.
- [ ] Os testes atuais do Vendas (português) continuam passando sem mudança.
- [ ] Commit.

### Task 4: Primeira visita pela localização (Vercel)

**Files:**
- Modify: `vercel.json` (`redirects` com `has` no header `x-vercel-ip-country` e `missing` no cookie `atlas_idioma`)
- Create: `src/web/vercel-idioma.test.ts` (lê o vercel.json e confere as regras)

- [ ] Regras: fora do Brasil, sem cookie, em `/` → `/en` (302); no Brasil, sem cookie, em `/en` → `/` (302). Só na página
  de vendas: o resto (instalar, conta, admin, compra) nunca é redirecionado.
- [ ] Conferir na documentação da Vercel que `has`/`missing` aceitam esse header; se não aceitarem, usar Routing
  Middleware (registrar a decisão no ledger).
- [ ] Commit.

### Task 5: Pagamento em dólar com a regra do CPF

**Files:**
- Modify: `supabase/functions/_shared/pagamento/checkout.ts`, `config.ts` (valores em dólar), `webhook.ts` (grava o mercado)
- Test: `supabase/tests/checkout-mercado.test.ts`

**Interfaces — Produces:** `PedidoCheckout.mercado: 'br' | 'us'` (padrão `br`); a licença recebe `idioma`.

- [ ] Testes: `br` sem CPF válido → erro `cpf-obrigatorio`; `br` → `currency: 'brl'` e 480000/20000; `us` → `currency: 'usd'`,
  170000 de implantação e 7000/mês, sem pedir CPF; um mercado desconhecido → `br`.
- [ ] Migration `0034_licenca_idioma.sql`: `idioma text not null default 'pt' check (idioma in ('pt','en'))`.
- [ ] E-mails da compra em inglês quando `idioma = 'en'` (mesmos e-mails, dicionário `pt`/`en`).
- [ ] Commit.

### Tasks 6–8 (cada uma ganha o seu plano detalhado quando chegar a vez)

- **Task 6 — App e instaladores em inglês:** dicionário por área das ~70 telas, idioma vindo da licença na ativação e fixo para sempre (sem troca dentro do app; decisão do Luiz, 26/11/2026); instaladores Windows (NSIS, `language` 1033) e Mac (DMG) em inglês; a página
  /instalar entrega o certo por sistema e idioma. Teste: varredura que acusa texto em português fora do dicionário.
- **Task 7 — Linha de produção em inglês:** o servidor entrega o kit no idioma da licença (`entregarKit` recebe
  `idioma`); canteiro, Ajuda e e-mails da obra em inglês. Teste ponta a ponta com uma obra pequena.
- **Task 8 — Legal e domínio:** termos e privacidade em inglês (rascunho para o advogado), `/en/terms` e `/en/privacy`;
  o use-atlas-ai.com já está ligado; conferir o `hreflang` e o canônico com www.

### Ao fim de cada Task

- [ ] PLAN.md: marcar o item do M31 correspondente e escrever nas Notas o que ficou de fora.
- [ ] `npx tsc -b`, `npx eslint .`, `npx vitest run` e `node --test app/adaptadores/*.teste.cjs` verdes; PR; merge com CI verde.
