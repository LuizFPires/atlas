# Entrega do Atlas — laudo e roteiro

Gerado na `/entregar` em 2026-11-18. Obra 100% (M1–M26), construída em **modo fixture**.

## Veredito da vistoria (habite-se)
**Reprovado para go-live hoje** — não por brecha de segurança (a base está sólida), mas por **entrega pendente**: adaptadores reais + conteúdo jurídico (LGPD).

## O que está pronto e seguro
- Nenhum segredo/chave real commitado; `.gitignore` cobre `.env`/`.env.*`/`*.pem`/`*.key`.
- RLS nas 14 tabelas; tabelas de sistema só service_role; portal lê só as próprias linhas (`auth_user_id = auth.uid()`).
- Colunas sensíveis protegidas por grant de coluna (token_hash, gateway_ref/pi, refs do gateway) — nunca chegam a authenticated/anon.
- Funções SQL `security definer`, `revoke ... from public/anon/authenticated`, `grant execute to service_role`.
- Pagamento sempre na conta do cliente (`contas_gateway` só com `segredo_ref`); sem dados de cartão; `base_retorno` validada (anti open-redirect).
- Marca d'água + aviso de licença no kit por obra; 1 licença = 1 computador (índice único).
- `npm run build` limpo (PWA/sw gerados).

## Achados ALTOS que travam o lançamento
1. ~~**Servidor não sobe:** `adaptadores_supabase.ts` não existe.~~ **RESOLVIDO (PR #27, 18/11):** adaptador real criado — store service_role (chama as RPCs; migration 0010), carregador de kit (bucket privado), e-mail via Resend (provedor trocável, fail-closed). Revisado pelo QA (por leitura; runtime real depende do Supabase de produção). Falta agora: o usuário conectar o Supabase real e os segredos (ver "Sua parte" abaixo).
2. **LGPD:** `docs/legal/politica-de-privacidade.md` e `termos-de-uso.md` são rascunhos com placeholders ([data], CNPJ, DPO, endereço), não servidos nem linkados; sem consentimento no checkout/cadastro; sem exclusão de conta no portal. O site já coleta e-mail.
3. **Adaptadores do Electron inexistentes:** cofre DPAPI, PonteClaude/Contas/Obras/Publicar/Painel/Cota, empacotar/assinar `Atlas.exe`. O app não ativa licença nem constrói obra real.

## Ressalvas (depois do lançamento)
- Observabilidade: sem Sentry no front nem nas edge functions.
- Bundle principal 509 kB (155 kB gzip), acima do aviso de 500 kB — considerar code-splitting.
- Confirmar DPO/controladora nos textos legais antes de publicar.

## Pré-requisitos reais para o deploy
- **Adaptadores:** `adaptadores_supabase.ts` (store service_role, carregador de kit, e-mail) + todos os `ponte-*` do Electron + cofre DPAPI.
- **Segredos** (Supabase secrets / Vercel, nunca em arquivo): `ATLAS_SEGREDO`, `ATLAS_SERVICO_TOKEN`, `ATLAS_SIGN_SK`, `ATLAS_WEB_ORIGEM`, `ATLAS_ADMIN_EMAILS`, `STRIPE_<ref>_SK`, `STRIPE_<ref>_WHSEC`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` (+ service_role key). Front (VITE): `VITE_API_URL`, `VITE_CONTA_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **Migrations:** aplicar 0001–0009 em Postgres real; confirmar `supabase db reset` do zero.
- **DNS/jobs:** apontar o domínio → Vercel; agendar crons (limpeza de eventos/expiração de códigos e links; dunning de avisos de atraso).
- **LGPD:** finalizar e publicar política + termos, linká-los no rodapé e no checkout, adicionar consentimento e exclusão de conta.

## Decisões (a preencher com o usuário)
- Ambiente (homologação antes de produção?), projeto Supabase de produção (ref), domínio, gateway Stripe padrão sugerido ao cliente, revisão jurídica da LGPD.

## Sua parte (o que só o Luiz pode fazer para o deploy ligar de verdade)
1. **Resolver a cobrança do GitHub** (Billing & plans) para o CI voltar a rodar em repo privado — ou deixar o repo público durante os deploys.
2. **Supabase de produção:** criar o projeto, aplicar as migrations 0001–0010, criar o bucket privado `kit` e subir o kit (`base/` + por obra), e definir os segredos (service_role, `ATLAS_SEGREDO`, `ATLAS_SERVICO_TOKEN`, `ATLAS_SIGN_SK`, `ATLAS_ADMIN_EMAILS`, `ATLAS_WEB_ORIGEM`).
3. **E-mail:** conta no Resend com o domínio do remetente verificado (`RESEND_API_KEY`, `ATLAS_EMAIL_FROM`).
4. **Stripe:** cadastrar a conta de pagamento do cliente em `contas_gateway` e as chaves `STRIPE_<ref>_SK`/`STRIPE_<ref>_WHSEC`.
5. **Domínio:** escolher o endereço e apontar o DNS (o Atlas diz o que cadastrar).
6. **LGPD:** finalizar política + termos (CNPJ, DPO, endereço — ideal um advogado) para eu publicá-los e ligar consentimento + exclusão de conta.
Com isso em mãos, a próxima `/entregar` aplica as migrations, define os segredos e publica (Supabase + Vercel).

## Ainda pendente (fase de obra, antes do produto completo)
- **Adaptadores do app Windows (Electron):** cofre DPAPI, PonteClaude/Contas/Obras/Publicar/Painel/Cota e empacotar+assinar `Atlas.exe`. Sem eles, o app desktop não ativa licença nem constrói obra de verdade. É uma frente de trabalho à parte (maior que o adaptador do Supabase).
- **LGPD técnica:** servir/linka a política, consentimento no checkout, exclusão de conta no portal.

## Lojas
Não se aplica: o app do Atlas é Electron/Windows (instalador), não mobile/Expo. Distribuição é pelo instalador assinado (pendente), não App Store/Play.
