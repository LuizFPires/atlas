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
1. **Servidor não sobe:** `supabase/functions/api/index.ts` importa `_shared/adaptadores_supabase.ts`, que **não existe**. Todo endpoint estoura em runtime. Falta o store real (service_role), carregador de kit (bucket privado) e envio de e-mail.
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

## Lojas
Não se aplica: o app do Atlas é Electron/Windows (instalador), não mobile/Expo. Distribuição é pelo instalador assinado (pendente), não App Store/Play.
