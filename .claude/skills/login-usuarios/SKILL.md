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
   **Primeiro acesso do dono:** ao colocar no ar, o Atlas cria no Supabase Auth a conta do dono (e-mail confirmado, sem senha) com `app_metadata.papel = 'dono'`. O app precisa reconhecer isso sozinho: um gatilho em `auth.users` (insert e update) cria ou ajusta a linha em `perfis` com o papel vindo de `raw_app_meta_data->>'papel'` (só o servidor muda o `app_metadata`; **nunca** use `user_metadata`/`raw_user_meta_data` para dar papel, que o próprio usuário altera). Quem não tem papel no `app_metadata` entra como o papel mais restrito. Se o sistema for só por convite, o dono convida a equipe por dentro do app.
   O dono cria a senha em "Esqueci minha senha" (`resetPasswordForEmail`, com `redirectTo` para a tela de nova senha do próprio app): essa tela tem de funcionar também para quem nunca teve senha.
5. Em **toda** tabela com dados de pessoas, ligue `enable row level security` e crie as regras: cada pessoa lê e muda só o que é dela; o dono vê o do negócio dele.
6. Chave `service_role` nunca vai para o código do app (pastas de front, `VITE_*`, `EXPO_PUBLIC_*`). Só a chave pública (`anon`).
7. Teste: pessoa A não consegue ler o dado da pessoa B (teste automatizado, com dados de teste).
8. Entrar com a conta tem de ter ligação com a skill `lgpd-basico` (consentimento no cadastro e exclusão da conta).

## Nunca
Guardar senha ou token em arquivo, em log ou no repositório. Montar login "caseiro" sem o Supabase Auth.
