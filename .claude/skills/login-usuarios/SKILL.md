---
name: login-usuarios
description: Capacidade das obras do cliente - entrada (login) para os usuários finais do app, com Supabase Auth, cada pessoa vendo só o que é dela. Use quando a obra precisar de cadastro, entrada com e-mail ou Google, "área do cliente", perfis (dono, funcionário, cliente) ou "esqueci a senha".
---

# Login dos usuários do app

Em palavras simples: é a portaria do prédio. Cada pessoa entra com a sua chave e só abre a porta do próprio apartamento.

Esta capacidade vale para o app que o Atlas constrói **para o cliente**. Usa o Supabase do próprio cliente (Supabase Auth). O Atlas não guarda senha de ninguém.

## Passos
1. Leia a SPEC da obra: quem entra (dono, equipe, cliente final) e o que cada um pode ver.
2. Entrada por e-mail com link mágico ou senha; Google só se o cliente pedir. Mensagens de erro em português, sem termo técnico ("E-mail ou senha não conferem", nunca "401").
3. Tela de "esqueci a senha" e de sair da conta, sempre visíveis.
4. Perfis numa tabela `perfis` ligada ao usuário (`auth.users`), com o papel (`dono`, `equipe`, `cliente`).
   **Primeiro acesso do dono:** ao colocar no ar, o Atlas cria no Supabase Auth a conta do dono (e-mail confirmado, sem senha) com `app_metadata.papel = 'dono'`. O app precisa reconhecer isso sozinho: um gatilho em `auth.users` (insert e update) cria ou ajusta a linha em `perfis` com o papel vindo de `raw_app_meta_data->>'papel'` (só o servidor muda o `app_metadata`; **nunca** use `user_metadata`/`raw_user_meta_data` para dar papel, que o próprio usuário altera). Quem não tem papel no `app_metadata` entra como o papel mais restrito.
   **Lista de papéis (obrigatória):** grave `docs/papeis.json` na obra com os papéis que o app tem, no formato `{"papeis":[{"id":"dono","nome":"Dono","descricao":"vê e muda tudo","interno":true},{"id":"equipe","nome":"Funcionário","descricao":"usa o dia a dia","interno":true},{"id":"cliente","nome":"Cliente","descricao":"marca horário","interno":false}]}`. O `id` é exatamente o valor de `app_metadata.papel` e da coluna `papel` em `perfis`. `nome` e `descricao` em português simples, uma linha. `interno: true` = gente da equipe, que o dono cadastra pela aba "Pessoas da equipe" do Atlas; `interno: false` = público que se cadastra sozinho. Sempre que mudar um papel no app, atualize este arquivo.
   **Pessoas da equipe pelo Atlas:** o Atlas cria cada pessoa da equipe direto no Supabase Auth (e-mail confirmado, `app_metadata.papel` da lista e uma senha inicial que o dono manda pelo WhatsApp), sem depender de e-mail chegar. Por isso o app **não** precisa de tela de convite por e-mail para a equipe.
   O dono cria a primeira senha no próprio Atlas (o Atlas grava direto na conta). "Esqueci minha senha" (`resetPasswordForEmail`, com `redirectTo` para a tela de nova senha do próprio app) continua obrigatório para a equipe e precisa funcionar também para quem nunca teve senha; o Atlas aponta os links do Supabase para o endereço do sistema ao publicar.
5. **Troca de senha no primeiro acesso (obrigatória).** Quando o Atlas cria uma pessoa com senha inicial (ou gera uma "Nova senha"), ele marca `app_metadata.trocar_senha = true`. O app precisa:
   - logo depois de entrar (e a cada vez que a sessão carregar), olhar `session.user.app_metadata.trocar_senha`; se for `true`, mostrar só a tela "Crie a sua senha" (senha nova duas vezes, 8 letras ou mais, botão de mostrar) e bloquear o resto do app até terminar;
   - salvar com `supabase.auth.updateUser({ password })` e depois chamar a função `concluir_troca_senha()` (abaixo) e `supabase.auth.refreshSession()` para a marca sumir;
   - ter esta função numa migration (o usuário não consegue mudar o próprio `app_metadata`, por isso ela é `security definer` e só mexe na marca de quem está logado):
     ```sql
     create or replace function public.concluir_troca_senha() returns void
     language sql security definer set search_path = '' as $$
       update auth.users set raw_app_meta_data = raw_app_meta_data - 'trocar_senha' where id = auth.uid();
     $$;
     revoke all on function public.concluir_troca_senha() from public, anon;
     grant execute on function public.concluir_troca_senha() to authenticated;
     ```
   - teste automatizado: com `trocar_senha = true` a tela de troca aparece e nada mais abre; depois de trocar, o app abre normal.
   Quem o Atlas tira o acesso fica bloqueado no Supabase Auth (o app não precisa fazer nada além de tratar "conta bloqueada" com uma mensagem em português: "Seu acesso foi encerrado. Fale com o dono do sistema.").
6. Em **toda** tabela com dados de pessoas, ligue `enable row level security` e crie as regras: cada pessoa lê e muda só o que é dela; o dono vê o do negócio dele.
7. Chave `service_role` nunca vai para o código do app (pastas de front, `VITE_*`, `EXPO_PUBLIC_*`). Só a chave pública (`anon`).
8. Teste: pessoa A não consegue ler o dado da pessoa B (teste automatizado, com dados de teste).
9. Entrar com a conta tem de ter ligação com a skill `lgpd-basico` (consentimento no cadastro e exclusão da conta).

## Nunca
Guardar senha ou token em arquivo, em log ou no repositório. Montar login "caseiro" sem o Supabase Auth.
