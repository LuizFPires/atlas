---
name: construir
description: Etapa 6 da linha de produção. Conduz o projeto milestone por milestone nas quatro etapas do roteiro (planejar, implementar com um commit por item e PR sem merge, revisar e testar com agente independente, merge com CI verde), com um subagente novo e de contexto limpo para o trabalho pesado de cada milestone. Registra bloqueios externos (billing, cota, serviço fora) num livro de ocorrências e segue com o que não depende deles. Substitui roteiro-milestone e roteiro-milestone-auto. Use quando o usuário disser /construir, /roteiro-milestone, /roteiro-milestone-auto, "avança o plano", "onde paramos", "próximo milestone", "roteiro automático", "segue o roteiro sozinho" ou "modo automático". Não acione para pedidos genéricos de roteiro.
---

# Construir — roteiro de milestone com subagentes

Em palavras simples: a obra é feita em etapas pequenas (milestones), sempre do mesmo jeito: planejar, fazer, conferir e só então juntar ao projeto. Cada milestone passa pelas mesmas quatro etapas do roteiro. A diferença é **quem faz**: você é o **mestre de obras** (coordenador) e não escreve nem lê código. O trabalho pesado roda em subagentes, que nascem com o contexto vazio; é o `/clear` automático. Você recebe só relatórios curtos, e o estado vive no PLAN, no git, no PR e no `roteiro.json`, nunca na conversa.

| Etapa | Quem faz | Resultado |
|---|---|---|
| 1 — Planejar | Você | branch `feat/mN-…`, lista de itens, decisões registradas |
| 2 — Implementar | Subagente `implementador` | um commit por item, verificação completa |
| | Você | push, PR **sem merge**, CI |
| 3 — Revisar e testar | Subagentes `qa` (revisão, testes reais, protótipo), `seguranca` (ataques e vazamento) e `desempenho` (velocidade e desperdício), em paralelo | achados por gravidade |
| | Novo `implementador` | `fix(mN): review fixes — …` |
| 4 — Merge | Você | medição no PLAN, CI verde, merge, branch apagada |

## 0. Modo

- **Manual (padrão)**: ao fim de cada etapa, ofereça o próximo passo com a recomendação primeiro (`Avançar: etapa N — … (Recomendado)`). Use `AskUserQuestion`. Uma opção pré-selecionada, silêncio ou tempo decorrido não são confirmação. A adoção da skill não autoriza todos os milestones futuros.
- **Automático** (o usuário disse "modo automático", "sozinho", `/roteiro-milestone-auto`): grave `~/.claude/recomendado.json`:
  `{"ativo": true, "desde": "<agora ISO>", "ate": null, "checkpoint": 3}`
  Limite dado ("até o M12", "só este milestone") vai em `ate`. Diga: "⏩ Roteiro automático ligado. Para voltar ao manual: /stop-recomendado."
  No automático, em todo ponto em que perguntaria, escolha a opção "(Recomendado)", escreva `⏩ Auto: <opção>` e siga. Decisões de negócio adotadas assim levam `(auto — recomendado)` na documentação e vão para `decisoes_auto` no `roteiro.json`.
- **Antes de cada etapa**, releia `~/.claude/recomendado.json`. Com `"ativo": false`, pare no próximo ponto de decisão e passe a perguntar.

## 1. Descubra onde estamos

1. `node .claude/hooks/etapa.cjs construcao`
2. `node .claude/hooks/progresso.cjs --curto` → avanço, próximo milestone e etapa salva. **Não leia o PLAN inteiro.** Para ver um milestone: `node .claude/hooks/progresso.cjs --milestone N`.
3. **Estado salvo**: `.codex/roteiro.json` se existir; senão `.claude/roteiro.json`; se nenhum existir, crie `.claude/roteiro.json`. Nunca mantenha duas cópias divergentes.
4. **Papelada do GitHub**: rode `gh auth status` e `git remote get-url origin`. Se qualquer um falhar (ou for a primeira construção do projeto), chame o subagente `despachante`:
   - primeiro com `verificar`;
   - se ele devolver `DECISÃO` de criar repositório, ofereça "Criar repositório privado `<nome da pasta>` (Recomendado)". No automático, `⏩ Auto:` e siga. Com o sim, chame de novo com `preparar, criar repositório privado <nome>`;
   - se ele devolver `USUÁRIO`, mostre o passo exato ao usuário e **pare até ele dizer que fez** (vale também no automático: só ele pode instalar ou fazer login). Depois, chame o `despachante` de novo com `preparar`;
   - com `CI: ausente`, avise uma vez que o merge vai seguir os critérios de verificação do projeto, sem CI, e ofereça pedir ao implementador do primeiro milestone um workflow básico de testes.
   Só avance com `STATUS: pronto`.
5. **Confira com a realidade**, porque o estado pode estar velho. Descubra a branch base pelas regras e pelo remoto (não assuma `main`):
   - `git branch --show-current`, `git status --short`, `git log --oneline <base>..HEAD`
   - `gh pr list --head <branch> --state all --json number,state,url` e, com PR aberto, `gh pr checks <n>`
6. **Deduza a etapa**. Na dúvida entre duas, prefira a anterior e diga por quê:

| Situação encontrada | Etapa concluída | Próximo passo |
|---|---|---|
| Na base, sem branch do próximo milestone | nenhuma, ou 4 do anterior | **1 — Planejar** |
| Branch `feat/mN-…` criada, decisões registradas, sem commits de item | 1 | **2 — Implementar** |
| Parte dos itens commitada ou alterações sem commit, sem PR | 1; etapa 2 parcial | **Continuar a 2**, conferindo antes o que está sem commit |
| PR aberto com CI vermelho | a do estado salvo | **Corrigir o CI** antes de avançar |
| PR aberto, sem rodada de revisão registrada | 2 | **3 — Revisar e testar** |
| PR aberto, revisão feita e corrigida | 3 | **4 — Merge**, após CI verde |
| PR mergeado, branch apagada | 4 | **1 — Planejar** o seguinte |

7. Escreva um retrato de 3 a 6 linhas: milestone, etapa concluída, branch/PR, CI, pendências. Se o usuário pediu só o estado, pare aqui.

## 2. As quatro etapas

### Etapa 1 — Planejar (você)
0. **Livro de ocorrências**: rode `node .claude/hooks/ocorrencias.cjs vencidas`. Se listar alguma, chame o subagente `plantonista` com `confira as ocorrências vencidas` antes de seguir. Depois rode `node .claude/hooks/ocorrencias.cjs bloqueia MN`: as tarefas que dependem de ocorrência aberta **ficam fora** dos itens deste ciclo (seção "Bloqueios externos"). Se o milestone inteiro depender, pule para o próximo milestone que não dependa, e diga por quê.
1. Leia `CLAUDE.md` e **só o bloco do milestone** (`progresso.cjs --milestone N`). Não abra SPEC nem código: isso é trabalho do implementador.
2. Crie a branch a partir da base atualizada: `feat/mN-<tema-curto>`. Se já existir branch ou worktree do milestone, continue nele. Nunca descarte alterações locais.
3. Escreva o escopo como lista numerada de itens, a partir das tarefas do milestone. **Cada item vira um commit.**
4. Pergunte só as decisões ainda em aberto, com a sugestão primeiro e o motivo. Não pergunte o que já está registrado e não invente decisões de negócio.
5. Registre as decisões em `Notas:` do milestone no PLAN e faça um commit `docs(mN): decisões` quando houver mudança.

### Etapa 2 — Implementar (subagente + você)
1. Chame o subagente `implementador`:
   `Milestone N, branch feat/mN-…. Itens: <lista numerada da etapa 1>. Decisões: <só as deste milestone>.`
   Não cole SPEC, código nem histórico. Ele sabe o que ler.
2. Com o relatório dele (STATUS concluido): `git push -u origin <branch>` e abra o PR para a base **sem merge**:
   `gh pr create --base <base> --title "MN — <título>" --body "<itens e decisões>"`
   Se o PR já existir, só faça push.
3. Espere o CI: `gh pr checks <n> --watch`. Reporte o resultado. CI vermelho → chame um **novo** `implementador` com `Corrija o CI do PR #n do Milestone N: <falha resumida>`.
4. Se o STATUS for parcial ou bloqueado, registre a pendência e decida (ou pergunte) antes de seguir. Se o bloqueio for **externo** (billing, cota, serviço fora do ar), não pare: siga a seção "Bloqueios externos".

### Etapa 3 — Revisar e testar (subagente independente)
1. Chame **em paralelo** (na mesma mensagem) os três revisores, cada um com a mesma entrada:
   `Revise o Milestone N. Base <base>, branch feat/mN-…, PR #n. Itens: <lista>. Tela: <tela: do milestone, se houver>.`
   - `qa`: revisão somente leitura do diff `<base>...HEAD`, roda o projeto, testa o comportamento real e compara com o protótipo quando o milestone mexe em telas. Se o milestone mexer em várias telas, chame um `qa` por tela, cada um só com a sua.
   - `seguranca`: ataques, vazamento de dados, permissões e isolamento entre clientes, segredos e dependências, no que o milestone mudou.
   - `desempenho`: consultas, índices, paginação, chamadas repetidas, render, bundle e imagens, no que o milestone mudou.
   Os três valem em **toda** etapa, inclusive no automático; nenhum substitui o outro. O `vistoriador` continua sendo a vistoria final do /entregar.
2. Achados **altos e médios** (de qualquer um dos três) se corrigem sempre; **baixos**, quando baratos. Junte os achados num só pedido e chame um **novo** `implementador`:
   `Corrija os achados do Milestone N: <lista com arquivo:linha>. Commit: fix(mN): review fixes — <resumo>.`
   Se uma migration já foi commitada, a correção vem numa migration nova. Achados aceitos sem correção vão para `Notas:` com o motivo.
3. Push e espere o CI. Depois da correção, chame de novo **só** o revisor que reprovou (ou os que reprovaram), com a lista do que foi corrigido. Não crie commit vazio nem repita verificações sem mudança que justifique.
4. Duas reprovações seguidas do mesmo milestone → pare e pergunte, mesmo no automático.

### Etapa 4 — Merge (você)
1. **Medição**: no PLAN, troque `- [ ]` por `- [x]` **somente** nas tarefas aprovadas pelo `qa`, `seguranca` e `desempenho` (os três com VEREDITO aprovado, sem achado alto ou médio em aberto) (Edit pontual). Commit `docs(mN): medição`, push, espere o CI. É isso que faz o prédio subir no canteiro.
2. `git status`: nada do milestone sem commit, nada alheio ao trabalho. Avise sobre o que ficou de fora.
3. Confira o CI da versão atual da branch. **Só faça merge com os checks exigidos verdes e sem bloqueio de revisão.** CI rodando não é sucesso. Sem CI configurado, diga isso e siga os critérios do projeto, sem alegar CI verde.
   **CI travado por minutos/cobrança do GitHub** (o job nem começa: "recent account payments have failed", "spending limit", "billing"): não é CI vermelho. Registre a trava `github-minutos` (abaixo), rode **aqui** a mesma conferência do workflow (`npm ci` ou `npm install`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, os que existirem) e, se tudo passar, faça o merge com `--subject "Merge pull request #<n>: MN — <título> (conferido no computador: GitHub sem minutos)"`. Nunca deixe o repositório público por conta própria: isso é decisão do usuário, na ficha do Atlas.
4. `⏩ Auto: merge PR #n` (no automático) e, respeitando o método do projeto:
   `gh pr merge <n> --merge --delete-branch --subject "Merge pull request #<n>: MN — <título>"`
5. Confirme o merge e a remoção da branch. Volte para a base atualizada. Não apague branch usada por outro worktree.
6. Resumo de até 4 linhas: o que foi feito, como foi verificado, decisões automáticas, pendências.

## Bloqueios externos — o livro de ocorrências

Na obra, quando chove, a concretagem fica para amanhã e a equipe segue com o que não depende de concreto. Aqui é igual.

**O que é bloqueio externo**: algo fora do código que impede uma ação e que vai se resolver sozinho ou com o usuário, sem mudar o app. Exemplos: cota ou billing estourado (Vercel, Supabase, API de IA), limite de requisições, serviço fora do ar, credencial de terceiro expirada. **Não é** bloqueio externo: bug, teste falhando, CI vermelho por causa do código. Isso se corrige no roteiro normal.

**Quando aparecer** (no relatório do implementador, do qa, do despachante ou num comando seu):
1. **Registre** no livro:
   `node .claude/hooks/ocorrencias.cjs abrir --servico <nome> --motivo "<erro em uma linha>" --acao "<o que fazer quando liberar>" --teste "<comando barato que prova que liberou>" --liberar-em <AAAA-MM-DDTHH:MM> --bloqueia "MN:<tarefa>,..."`
   - `--liberar-em`: use o horário que a mensagem do serviço informar. Se não informar, use daqui a 1 hora; o plantonista reagenda.
   - `--acao` precisa ser executável por si só (ex.: "deploy de produção da main com `vercel --prod`"), porque quem vai executar é outro agente, sem esta conversa.
2. No `Notas:` do milestone afetado, escreva `⏸ aguardando ocorrência #<id> (<serviço>)`. A tarefa fica `- [ ]`.
3. Commit `chore: ocorrência #<id> — <serviço>` (só `docs/ocorrencias.json` e o PLAN).
4. **Siga a obra**: o resto do milestone continua normalmente (implementar, revisar, medir só o que o qa aprovou, merge). Depois, o próximo milestone que não dependa da ocorrência. No automático, escreva `⏩ Auto: ocorrência #<id> registrada, seguindo com <o que vem>`.
5. **Quando o plantonista der baixa**: as tarefas que dependiam só da ação pendente (ex.: "publicar em produção") podem ser marcadas `- [x]` com a prova que ele trouxe (URL, id do deploy), anotada em `Notas:`. Tarefas que envolvem código voltam ao roteiro normal num próximo ciclo, com implementador e qa.

**Travas conhecidas** (o Atlas mostra uma ficha explicada para o usuário; use estas palavras no `--servico` e no `--motivo`):
| Trava | `--servico` | `--motivo` | `--liberar-em` | O que fazer |
| --- | --- | --- | --- | --- |
| Minutos do GitHub Actions acabaram | `GitHub` | `minutos do GitHub Actions acabaram (billing)` | dia 1º do mês seguinte, 00:00 | conferir aqui e seguir (item 3 da etapa 4) |
| Vercel no limite de deploys do dia | `Vercel` | `limite diário de deploys do plano grátis` | a hora que a Vercel informar (senão +24 h) | seguir construindo; o plantonista publica |
| Projeto do Supabase pausado | `Supabase` | `projeto pausado por inatividade` | sem data | seguir com o que não usa o banco; o usuário acorda pela ficha |
| Login caiu neste computador | `GitHub`, `Vercel` ou `Supabase` | `conta desligada deste computador` | sem data | seguir com o resto; o usuário liga de novo pela tela das contas |
Na obra do Atlas (`ATLAS_APP=1`), **nunca** peça comando ao usuário para nenhuma delas: a ficha do Atlas explica e resolve.

**Prevenção (Vercel)**: publique só quando um milestone termina (merge na `main`), não a cada PR. Ao ligar o projeto na Vercel, crie `vercel.json` com `"ignoreCommand": "[ \"$VERCEL_GIT_COMMIT_REF\" != \"main\" ]"` para pular as prévias das outras branches.

**Se tudo o que resta depender de ocorrências abertas**: pare, mostre `node .claude/hooks/ocorrencias.cjs listar` e ofereça **"Agendar a retomada para <horário de liberação> (Recomendado)"**. Use a ferramenta de agendamento que a sessão oferecer (tarefa agendada), com o prompt: `Rode /construir no projeto <caminho>. Comece pelo plantonista: confira as ocorrências vencidas.` Se não houver ferramenta de agendamento, diga ao usuário o horário exato para digitar `/construir`. No automático, agende sem perguntar e registre `⏩ Auto: retomada agendada para <horário>`.

**Antes de encerrar a sessão** com ocorrência aberta, sempre diga quais estão abertas e quando liberam.

## 3. Guarde o estado

Ao fim de **cada etapa**, grave o `roteiro.json` escolhido (não o inclua em commits; se a pasta for versionada, sugira ignorar só esse arquivo):

```json
{
  "milestone": "M3",
  "titulo": "Cadastro de obras",
  "etapa_concluida": 2,
  "branch": "feat/m3-cadastro-obras",
  "pr": 7,
  "atualizado_em": "2026-11-02",
  "pendencias": ["CI do PR #7 rodando"],
  "ocorrencias_abertas": [3],
  "decisoes_auto": []
}
```

Use a data e os valores reais. Etapa parcial mantém a última concluída e registra o que falta em `pendencias`. O estado nunca substitui as verificações reais de git, PR e CI. O painel do canteiro lê esse arquivo.

Depois de gravar: no manual, ofereça o próximo passo com a recomendação primeiro. No automático, mostre o retrato curto e comece a próxima etapa; ao fim da etapa 4, comece o próximo milestone.

## Checkpoints humanos
A cada `checkpoint` milestones (padrão 3), mesmo no automático, pare: "Checkpoint: M<a>–M<b> concluídos, avanço X%, prazo restante <linha "Prazo restante" do progresso.cjs --curto>. Ocorrências abertas: <lista curta ou 'nenhuma'>. Teste o app e responda 'segue' ou diga o que corrigir."
Quando **todos** os milestones estiverem concluídos, diga: "Obra concluída: 100%. Próximo passo: /entregar (vistoria final, produção e lojas)."
Se `ate` tiver um milestone, ao concluir a etapa 4 dele grave `"ativo": false`, diga que o automático foi desligado e pare.

## Quando parar e perguntar, mesmo no automático
- a pergunta não tem opção recomendada (ex.: não há PLAN e é preciso saber o próximo bloco);
- verificação ou CI falham duas vezes seguidas depois de correções;
- o `qa` reprovou duas vezes o mesmo milestone;
- ação destrutiva fora do roteiro: apagar dados, migration que remove colunas com dados, mexer em produção;
- falta acesso, credencial ou informação que só o usuário tem **e** não há outro trabalho independente para seguir (se houver, registre ocorrência e siga);
- uma ocorrência exige gasto ou mudança de plano/billing: isso é sempre decisão do usuário.

## Cuidados
- Nunca faça merge com CI vermelho, force push ou pule hooks (`--no-verify`).
- Nunca marque tarefa como feita sem aprovação do `qa`, do `seguranca` e do `desempenho`.
- Nunca leia o código você mesmo para "conferir rápido"; para isso existe o `qa`.
- **Produção só pela skill `entregar`.** Antes de qualquer deploy de produção (`vercel --prod`, migrations no banco de produção, domínio próprio) ou envio às lojas (`eas submit`, TestFlight, Google Play), feito por você, pelo `implementador` ou pelo `plantonista`, leia `.claude/skills/entregar/SKILL.md`. Se ela abrir com "Entregar — ainda travado", a licença ainda não libera a entrega: não publique; a tarefa do PLAN vira bloqueio externo no livro de ocorrências, com o motivo "entrega em produção travada" e a data que a skill informa, e a obra segue com o resto. Prévia e testes estão sempre liberados.
- Antes de cada ação difícil de desfazer (push, merge, apagar branch), escreva `⏩ Auto: <ação>` no automático.
- Se o usuário mandar um ajuste ou dúvida no meio, atenda e retome o roteiro, salvo cancelamento.
- Em etapas longas, dê notícias curtas. Depois de uns 8 a 10 milestones, sugira: "Está tudo salvo no PLAN, no git e no roteiro.json. Dê /clear e chame /construir; eu retomo de onde parei."
