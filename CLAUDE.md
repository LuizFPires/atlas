# CLAUDE.md — Atlas

Regras curtas que valem em todo turno. O detalhe mora em PRD.md (o quê/por quê), SPEC.md (como) e PLAN.md (quando).

## Fonte da verdade
- O protótipo em prototipo/ é a fonte da verdade. Qualquer divergência dele precisa estar registrada como decisão no PLAN.md.
- As telas são os arquivos .dc.html; as regras de cada tela estão nas notas amarelas do prototipo/canvas.json (u00–u17).
- Não altere o formato do PLAN.md: o painel do canteiro lê peso/spec/tela para calcular o progresso.

## Produto
- Atlas transforma a linha de produção do Claude Code num produto para leigo, vendido no Brasil. Público: dono de pequeno negócio que não programa.
- São 5 partes: kit (plugin), app Windows, servidor de licenças, web do Luiz, instalador.
- Idioma: sempre português do Brasil. Tom: "amigo na mesa de um restaurante"; explique como para alguém de 5 anos. Nunca prometa atendimento humano — todo suporte é a Ajuda do Atlas.
- "Tudo pode ser falado": microfone em toda entrada de texto, com transcrição editável.

## Invariantes (não violar)
- Nunca guardar segredo em arquivo; instruções dos agentes não ficam salvas no disco do cliente (entregues por obra).
- Pagamento e assinatura são sempre do cliente (gateway dele); nunca passam pelo Luiz.
- O código das obras é do cliente (GitHub dele). O kit não fica no repositório do cliente.
- Login do Claude é o do próprio cliente (sem OAuth de assinatura em app de terceiros — regra da Anthropic).
- O Atlas só detecta o plano do Claude (Pro/Max); não escolhe plano. Pausa por cota e retoma sozinho.
- Uma licença = um computador ativo. Marca d'água por cliente e aviso de licença no topo dos arquivos entregues.
- O Atlas nunca constrói um sistema que constrói sistemas (ideia/protótipo → plano → agentes construindo software): é concorrente do Atlas. Chatbot, app ou site com IA podem.
- Pasta das obras: C:\Users\<nome>\Atlas\Obras no Windows e ~/Atlas/Obras no Mac (nunca Desktop/Documentos, por causa do OneDrive e do iCloud).

## Design
- Dois temas por tokens: escuro A (padrão) e claro B (docs/design-system.md). Menu sempre escuro.
- Geist (texto/título) e Geist Mono (rótulos caixa alta e números). Lime é o destaque; verde (soft+borda lime) = seleção.
- Bolinha de ícone usa SVG de traço, nunca emoji. Canteiro sempre 3D, nunca 2D.

## Técnico
- Stack: Vite + React + TS, PWA; backend Supabase + Vercel.
- Reaproveitar o kit existente em .claude/ (agents, skills, hooks, canteiro) antes de criar do zero.
- Escala-alvo desde o início: ~100 clientes novos por mês, self-service, sem operação manual por cliente.

## Decisões pendentes
- Lista completa em PRD.md §8. Nunca decidir sozinho: marcar como decisão e registrar no campo Notas do PLAN.md ao fechar.
