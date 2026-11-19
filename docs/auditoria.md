# Auto-auditoria semanal da degustação (bloco C)

A varredura **só sinaliza**. Ela abre ocorrências no painel (tipo `auditoria_degustacao`, autor `auto-auditoria`, aberta). Não bloqueia domínio, não cancela teste, não desliga a oferta. Quem decide é o gestor.

## Como roda
- Rota de serviço `POST /degustacao/auditar` (exige o segredo de serviço, igual a `/degustacao/limpar-ips`). Chama a RPC `auditar_degustacao(p_agora, p_desde)` (migration 0020) com janela de 7 dias. Responde `{ ok: true, novos: <alertas novos> }`.
- **Passo do USUÁRIO no deploy:** agendar um cron SEMANAL (ex.: segunda 08:00) que faça `POST <api>/degustacao/auditar` com o segredo de serviço. Nada é agendado pelo código.
- Sem repetição: cada alerta tem uma `chave` e há no máximo 1 ocorrência ABERTA por chave (índice único parcial). Rodar de novo com o alerta aberto não duplica; depois que o gestor dá baixa, se o sinal continuar, ele reabre na semana seguinte.
- Sem dado pessoal na descrição: nada de e-mail, só domínio, contagens, IP mascarado (`a.b.*.*`) e os 6 últimos caracteres do código do computador.

## Sinais e limiares (conservadores; constantes em `_shared/auditoria.ts` e espelhadas na 0020)
| Sinal | Limiar na janela | Chave | O que o gestor faz |
|---|---|---|---|
| Domínio ainda não bloqueado | 5 pessoas diferentes com teste CONFIRMADO (pedido sem clicar no e-mail não conta, para ninguém inflar um domínio e enganar o gestor); nunca sugere sufixo público (com.br, co.uk...) nem domínio pai de provedor; provedores grandes (gmail, hotmail, outlook, yahoo, uol...) ficam de fora | `aud:dominio:<dominio>` | Botão "Bloquear este domínio" no alerta, ou dar baixa se for empresa de verdade |
| Burst de IP | 8 e-mails diferentes do mesmo IP (o freio normal é 5/h) | `aud:ip:<md5>` | Olhar os domínios; pode ser escola/empresa (CGNAT) |
| Mesmo tronco de e-mail | 3 grafias diferentes (pontos/+tag) do mesmo e-mail normalizado, ou 6 pedidos | `aud:tronco:<hmac>` | Só aviso: o Atlas já libera 1 teste por pessoa |
| Computador reincidente | 3 tentativas barradas de novo teste no mesmo computador | `aud:disp:<hmac>` | Só aviso: o Atlas já recusou |

Dados novos (0020): `degustacoes.pedidos / variantes / ultimo_pedido_em`, `degustacoes_dispositivos.barradas / ultima_barrada_em`, `ocorrencias_admin.chave`. A barrada é contada em `confirmarAtivacao`, `trocarComputador` e dentro da RPC `trocar_computador`.

## Lista de descartáveis editável
Painel, seção "E-mails temporários bloqueados": listar, bloquear e liberar domínio (rotas admin `/admin/dominios`, `/admin/dominios/adicionar`, `/admin/dominios/remover`; JWT + allowlist). O domínio é normalizado (minúsculas, sem `@`, sem ponto final), validado e sem duplicar; provedores comuns, sufixos públicos (com.br, co.uk, com, io...; lista curada em `auditoria.ts`, espelhada na 0021) e domínios "pai" de provedor são recusados (409 `dominio_protegido`): só entra domínio registrável. Bloqueio vale também para subdomínios. Liberar volta a aceitar os pedidos. Cada mudança fica registrada em ocorrências (resolvida, com o e-mail do gestor). A lista base em código (`dominios-descartaveis.ts`) é fixa.

## Limites honestos
- O que o servidor guarda por e-mail é só a última grafia; por isso o sinal de tronco usa contadores (`variantes`), não a lista de e-mails.
- O IP some das linhas com mais de 30 dias (limpeza diária); a janela de 7 dias fica dentro disso.
- Limiares são ponto de partida: ajuste em `auditoria.ts` e na `auditar_degustacao` (os dois lugares) depois de ver o ruído real.
