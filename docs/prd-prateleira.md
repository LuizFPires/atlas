# PRD — Prateleira de apps prontos (plug and play) · rascunho para o Luiz revisar

> Milestone 32 (ver PLAN.md). Rascunho por proposta: eu recomendo, você corrige o que estiver errado. Nada aqui está construído; isto antecede o protótipo e o `/construir`.

## 1. Em uma frase
Uma seção no Atlas onde o cliente compra um app **pronto** do seu segmento, personaliza (nome, logo, cores) e usa na hora como PWA — e, por ter comprado, já pode **modificar** tudo pelo Atlas. É um atalho para quem não quer começar do zero.

## 2. Preço (DECIDIDO por você, 19/11)
- App pronto da prateleira: **R$ 7.300** (uma vez) + **R$ 200/mês**.
- Do zero (preço atual): **R$ 4.800** + R$ 200/mês.
- A diferença (R$ 2.500) é o "meio caminho andado". O parcelamento e a trava que já construímos valem igual.

## 3. Os ~10 segmentos de lançamento (RECOMENDAÇÃO — confirme/ajuste)
Escolhi por dor clara + mercado grande + dá pra padronizar:
1. Barbearia / salão de beleza (agenda + ficha do cliente)
2. Restaurante / lanchonete (cardápio + pedidos + cozinha)
3. Mercearia / minimercado (estoque + vendas + validade)
4. Academia / CrossFit (treino do dia + check-in + evolução)
5. Loja de roupas / boutique (estoque + vitrine + vendas)
6. Oficina mecânica / autopeças (ordem de serviço + orçamento)
7. Clínica / consultório (agenda + prontuário simples)
8. Pet shop (agenda de banho/tosa + produtos)
9. Lotérica / papelaria (controle de caixa + produtos)
10. Prestador de serviço (orçamentos + agenda + histórico do cliente)
> Recomendo lançar com **3–4** (os de maior demanda: barbearia, restaurante, mercearia, academia) e crescer. Construir e MANTER 10 ao mesmo tempo é caro quando o Atlas evolui.

## 4. Arquitetura (RECOMENDAÇÃO)
### 4.1. O app pronto vira obra DO CLIENTE
Ao comprar, o app-modelo é **instanciado como uma obra do cliente** (no GitHub/contas dele), com **marca d'água por cliente** e aviso de licença (invariantes do M26). O "pronto" é um ponto de partida que ele leva — não fica preso no Atlas. Isso mantém o invariante "o código das obras é do cliente".

### 4.2. Single-tenant por compra (base da antipirataria)
Cada app comprado é de **uma empresa só**: os dados (clientes, vendas, agenda) ficam juntos, num banco/projeto do próprio cliente. **Não** há multi-tenant compartilhado. Consequência honesta e útil: compartilhar o link/login = dividir os MESMOS dados → concorrentes veriam tudo um do outro. Ninguém quer. (Decisão sua, 19/11.)

### 4.3. Antipirataria (camadas, combinar todas)
1. **Técnica:** acesso amarrado ao comprador — login de usuário final + licença = 1 computador/instância ativa (já temos a base no M2). O app só funciona ligado à licença do dono.
2. **Social/honesta (seu dissuasor):** deixar explícito, no app e na compra, que é single-tenant — compartilhar significa dividir os dados. Medo real, não blefe.
3. **Marca:** nome da empresa embutido + marca d'água por cliente (dificulta e identifica repasse).

### 4.4. Personalização (RECOMENDAÇÃO)
Um **configurador leve** logo após a compra (sem precisar abrir o Atlas): nome do negócio, logo (upload), **cor principal e secundária** sobre um padrão — aplicadas via os **tokens de tema** que já existem. Em 2 minutos o app está "com a cara" do cliente. Quem quiser mais, aí sim entra no Atlas e muda o que for.

## 5. Fluxo do cliente
1. Vê a prateleira no site/PWA → escolhe o segmento.
2. Compra (preço da prateleira) → mesmo checkout/trava de hoje.
3. Configurador: nome, logo, cores.
4. O Atlas **provisiona** o app pronto como obra dele (repo, deploy, marca d'água).
5. Usa como PWA (instala no celular). Se quiser mudar, abre o Atlas (já liberado).

## 6. Reaproveita o que já existe
Motor do Atlas (construção/modificação), licença + pagamento (com parcelamento e trava), marca d'água + aviso de licença, tema por tokens, entrega do kit por obra, PWA.

## 7. Decisões que ainda são SUAS (preciso de "ok" ou ajuste)
- [ ] Os segmentos e quantos no lançamento (recomendo 3–4; §3).
- [ ] Confirmar single-tenant por compra (§4.2) — é o que sustenta a antipirataria.
- [ ] O configurador leve antes do Atlas, ou tudo pelo Atlas (§4.4).
- [ ] Quem **mantém** os apps-modelo quando o Atlas evolui (você? um processo?).
- [ ] Nome da seção na loja ("Prateleira", "Apps prontos", "Comece pronto"…).

## 8. Próximos passos (depois do seu ok)
1. Fechar as decisões do §7.
2. Protótipo das telas (prototipo/): a prateleira, o card do app, o configurador.
3. `/construir` por partes: (a) a vitrine + compra do app pronto; (b) o configurador + provisionamento; (c) a antipirataria técnica; (d) os apps-modelo, um a um.
