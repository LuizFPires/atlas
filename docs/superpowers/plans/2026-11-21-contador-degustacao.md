# Contador do teste e compra de dentro do Atlas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O Atlas instalado mostra quanto falta do teste/cortesia e deixa comprar dali, abrindo o pagamento da Stripe no navegador.

**Architecture:** Uma rota nova no servidor devolve tipo e validade da licença para o dispositivo ativado. A tela do app lê isso pelo processo principal (ponte `servidor`, já existente), mostra o cartão na lateral e abre a compra reaproveitando as regras de parcelas e termos do site. O checkout ganha a origem "app", que muda só o endereço de retorno.

**Tech Stack:** Vite + React + TS (vitest), Supabase Edge Functions (Deno, lógica pura testada no vitest), Electron (CommonJS, `node --test`).

**Spec:** `docs/prd-contador-degustacao.md`

## Global Constraints
- Idioma: português do Brasil, tom do Atlas; nunca prometer atendimento humano.
- Textos exatos do cartão: "TESTE GRÁTIS" / "CORTESIA"; "Faltam N dias" / "Falta 1 dia" / "Vence hoje"; "Vence em DD/MM"; "Seu teste acabou" / "Sua cortesia acabou"; botão "Quero o Atlas"; pago: "Licença ativa · este computador".
- Preço e parcelas só de `src/web/parcelas.ts`; versão dos termos só de `src/web/textos-legais.ts` (`VERSAO_TERMOS`).
- O processo principal só abre `https://checkout.stripe.com/...`; rotas da ponte são lista fechada.
- Sem resposta válida do servidor: nenhum contador, nenhum botão.
- Não alterar o formato do PLAN.md (o painel lê peso/spec/tela).
- Um commit por tarefa; lint, `tsc -b`, `npm test`, `npm run build` e `node --test app/*.teste.cjs app/adaptadores/*.teste.cjs` verdes ao fim.

## Review Focus
1. Relógio do computador errado ou fuso diferente: o contador usa a data do servidor (`agora` vem na resposta), não só o relógio local.
2. Validade que cai hoje, mas daqui a poucas horas: "Vence hoje", nunca "Faltam 0 dias".
3. Cliente paga e fecha o navegador sem voltar: o app ainda percebe (confere a licença ao abrir e ao voltar o foco para a janela).
4. Resposta estranha do servidor (campo faltando, data inválida, tipo desconhecido): tratada como "sem resposta", sem contador.
5. Duplo clique em "Ir para o pagamento": um checkout só.

---

### Task 1: Servidor — resumo da licença para o dispositivo
**Files:** Create `supabase/functions/_shared/licenca-resumo.ts`; Modify `supabase/functions/_shared/http.ts` (rota `/licenca/resumo`, junto de `/verificar`); Test `supabase/tests/licenca-resumo.test.ts`.
**Interfaces — Produces:** `resumoDaLicenca(d: Deps, a: { email: string; computador_hash: string; token_dispositivo: string }): Promise<ResumoLicenca>` com `ResumoLicenca = { tipo: 'paga' | 'cortesia'; origem: 'degustacao' | null; validade_em: string | null; vencida: boolean; agora: string }`. Credencial conferida como em `verificar` (licença do cliente + ativação ativa + hash do computador + hash do token); qualquer falha lança `ErroRegra('negado', ..., 401)` genérico.
- [ ] Teste: paga → `{ tipo: 'paga', validade_em: null, vencida: false }`; cortesia com validade futura → tipo, origem, validade ISO, `vencida: false`; cortesia vencida (inclusive já cancelada pelo `/verificar`) → `vencida: true`; credencial errada, computador errado, e-mail desconhecido → rejeita `negado` sem detalhe; `agora` = `d.agora()`.
- [ ] Rodar e ver falhar; implementar; rodar e ver passar; rota em `http.ts` com teste em `supabase/tests/http.test.ts` (cabeçalho `X-Atlas-Dispositivo`); commit.

### Task 2: Servidor — checkout com origem "app"
**Files:** Modify `supabase/functions/_shared/pagamento/checkout.ts`, `supabase/functions/_shared/http.ts`; Test `supabase/tests/checkout.test.ts`.
**Interfaces — Produces:** `PedidoCheckout.origem?: 'app'`. Com `origem: 'app'`: `success_url = <origin>/compra/pelo-app`, `cancel_url = <origin>/compra/pelo-app/cancelada`. Sem origem: como hoje. `http.ts` repassa `origem` só quando o corpo traz exatamente `'app'`.
- [ ] Teste dos dois casos (URLs exatas); falhar; implementar; passar; commit.

### Task 3: Site — páginas de retorno da compra feita pelo app
**Files:** Create `src/web/CompraPeloApp.tsx`; Modify `src/App.tsx`; Test `src/web/CompraPeloApp.test.tsx`.
**Interfaces — Produces:** `<CompraPeloApp cancelada?: boolean />`. Confirmada: título "Pagamento confirmado." e "Pode voltar para o Atlas: ele já sabe que você comprou." Cancelada: título "Nada foi cobrado." e "Quando quiser, é só clicar de novo em Quero o Atlas, dentro do Atlas." Rotas `/compra/pelo-app` e `/compra/pelo-app/cancelada` em `App.tsx`, antes do fallback da página de vendas.
- [ ] Teste dos dois textos; falhar; implementar (classes `v v-confirmar` / `v-modal`, como `Instalar.tsx`); passar; commit.

### Task 4: App (processo principal) — rotas novas e abrir o pagamento
**Files:** Modify `app/adaptadores/servidor.cjs` (ROTAS += `/licenca/resumo`, `/pagamento/checkout`), `app/seguro-puro.cjs` (exportar `HOSTS_PAGAMENTO = ['checkout.stripe.com']`), `app/main.cjs`, `app/preload.cjs`; Test `app/adaptadores/servidor.teste.cjs`, `app/pagamento.teste.cjs`.
**Interfaces — Produces:** IPC `atlas:pagamento:abrir(url)` → `abrirExterno(shell, url, HOSTS_PAGAMENTO)`; preload `pagamento: { abrir(url) }`; `PonteDesktop.pagamento?: { abrir(url: string): Promise<void> }` (em `src/app/ponte.ts`).
- [ ] Teste: `urlOficial('https://checkout.stripe.com/c/pay/x', HOSTS_PAGAMENTO)` aceita; `http://`, outro host, `checkout.stripe.com.evil.test`, usuário/senha na URL recusam; ROTAS contém as duas novas. Falhar; implementar; passar; commit.

### Task 5: App (tela) — ler o resumo e calcular o texto do cartão
**Files:** Create `src/app/licenca-resumo.ts`; Test `src/app/licenca-resumo.test.ts`.
**Interfaces — Consumes:** `fetchPelaPonte`, `lerAtivacao`, `cabecalhoDispositivo`. **Produces:**
- `lerResumo(ponte: Pick<PonteDesktop, 'cofre' | 'hashComputador'>, api: string | null, f?: typeof fetch): Promise<ResumoLicenca | null>` (null em qualquer dúvida).
- `cartaoDaLicenca(r: ResumoLicenca | null, agoraLocal?: Date): CartaoLicenca` com `CartaoLicenca = { estado: 'ativa' } | { estado: 'contando' | 'vencida'; rotulo: 'TESTE GRÁTIS' | 'CORTESIA'; titulo: string; sub: string | null }`.
- Regra dos dias: `faltam = validade_em - agora(do servidor)`; `vencida` ou `faltam <= 0` → vencida; validade no mesmo dia local de "agora" → "Vence hoje"; senão `dias = ceil(faltam / 24h)`, "Falta 1 dia" / "Faltam N dias"; `sub = "Vence em DD/MM"` (data local).
- [ ] Testes: 3 dias; 1 dia; vence hoje (faltando 2 h); vencida; paga; null → `{ estado: 'ativa' }`; relógio local 2 dias adiantado não muda o resultado (usa `agora` do servidor); resposta com data inválida ou tipo desconhecido → `lerResumo` devolve null. Falhar; implementar; passar; commit.

### Task 6: App (tela) — cartão na lateral, tela de compra e ligação no AppDesktop
**Files:** Modify `src/shell/Shell.tsx`, `src/shell/shell.css`, `src/app/AppDesktop.tsx`, `src/web/compra.ts` (parâmetro `origem`); Create `src/app/ComprarAtlas.tsx`; Test `src/shell/Shell.test.tsx` (ou o existente), `src/app/ComprarAtlas.test.tsx`.
**Interfaces — Consumes:** Tasks 4 e 5. **Produces:**
- `Shell` ganha `licenca?: CartaoLicenca` e `onComprar?: () => void`. Sem `licenca` ou `estado: 'ativa'`: a linha de hoje. Com contador ou vencida: rótulo, título, sub e botão "Quero o Atlas" (só se `onComprar`).
- `iniciarCompra(..., segmento?, origem?: 'app')` manda `origem` no corpo.
- `<ComprarAtlas email aberto onFechar iniciar abrirPagamento />`: e-mail fixo (só leitura), parcelas (`opcoesParcelas('implantacao')`), nota de preço igual à do site, aceite dos termos (`VERSAO_TERMOS`), botão "Ir para o pagamento" (desligado enquanto envia); depois de abrir: "Abri a página de pagamento no seu navegador. Quando você pagar, eu aviso aqui."
- `AppDesktop`: lê o resumo ao montar, ao voltar o foco da janela e a cada 10 min; depois de abrir o pagamento, a cada 10 s por até 30 min, parando quando `tipo === 'paga'`.
- [ ] Testes: Shell nos 3 estados; ComprarAtlas (sem aceite não envia; envia `parcelas`, `origem: 'app'` e o e-mail fixo; duplo clique = 1 chamada; erro do servidor aparece; sucesso chama `abrirPagamento(url)`). Falhar; implementar; passar.
- [ ] Ver no navegador (modo fixture, `?desktop=1`) os estados do cartão e a tela de compra; commit.

### Task 7: Registro da decisão
**Files:** Modify `PLAN.md` (campo Notas do milestone da degustação, sem mudar o formato), `app/PENDENTE-ENTREGAR.md`.
- [ ] Registrar: adição pós-protótipo aprovada em 21/11/2026, link para `docs/prd-contador-degustacao.md`, e o que falta conferir num Windows real (abrir a Stripe pelo app; contador com licença de teste de verdade). Commit.
