// Trava da entrega em produção (decisão do Luiz, 22/11/2026).
// A obra pode ser construída e vista em prévia desde o primeiro dia; o que publica de verdade (habite-se, implantador e
// corretor) só chega ao kit quando passa o prazo do arrependimento (CDC art. 49, 7 dias da compra). Assim, quem desiste e
// recebe o dinheiro de volta sai com obras em prévia, não com sistemas rodando no negócio.
//   paga      -> libera em comprada_em + 7 dias (sem data gravada = licença antiga: não trava quem já pagou)
//   teste grátis (cortesia com origem 'degustacao') -> nunca entrega em produção
//   cortesia do gestor -> libera na hora (é presente, não há pagamento para devolver)
import type { ArquivoKit } from './kit.ts'
import { PRAZO_ARREPENDIMENTO_MS } from './pagamento/config.ts'
import type { Licenca } from './tipos.ts'

export type MotivoEntrega = 'paga' | 'arrependimento' | 'degustacao' | 'cortesia'
export interface SituacaoEntrega {
  liberada: boolean
  /** ISO. Paga: fim do prazo de arrependimento. Nulo quando não há data (cortesia, teste grátis, licença antiga). */
  libera_em: string | null
  motivo: MotivoEntrega
}

export function situacaoDaEntrega(l: Pick<Licenca, 'tipo' | 'origem' | 'comprada_em'>, agora: Date): SituacaoEntrega {
  if (l.tipo === 'cortesia') {
    return l.origem === 'degustacao'
      ? { liberada: false, libera_em: null, motivo: 'degustacao' }
      : { liberada: true, libera_em: null, motivo: 'cortesia' }
  }
  if (!l.comprada_em) return { liberada: true, libera_em: null, motivo: 'paga' }
  const libera = new Date(l.comprada_em.getTime() + PRAZO_ARREPENDIMENTO_MS)
  const liberada = agora.getTime() >= libera.getTime()
  return { liberada, libera_em: libera.toISOString(), motivo: liberada ? 'paga' : 'arrependimento' }
}

/** Arquivos que publicam de verdade: ficam fora do kit enquanto a entrega estiver travada. */
const DA_ENTREGA = (caminho: string) => {
  const c = caminho.replace(/^\.claude\//, '') // o bucket pode guardar com ou sem o prefixo .claude/
  return c.startsWith('skills/entregar/') || c === 'agents/implantador.md' || c === 'agents/corretor.md'
}

const dataBr = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' })

/** A skill /entregar que vai no lugar da verdadeira: explica ao cliente (e ao coordenador) por que ainda não publica. */
export function skillEntregaTravada(s: SituacaoEntrega): ArquivoKit {
  const porque = s.motivo === 'degustacao'
    ? 'Este é o teste grátis do Atlas: dá para construir e ver tudo em prévia, mas a entrega em produção (colocar no ar com endereço próprio e mandar para as lojas) só existe com o Atlas comprado.'
    : `A entrega em produção libera em ${dataBr(s.libera_em!)}, quando terminam os 7 dias de arrependimento da compra. Até lá, a obra segue normalmente e fica disponível em prévia.`
  const conteudo = `---
name: entregar
description: Etapa 8 da linha de produção (/entregar, "coloca em produção", "lança o app", "sobe para a loja", "manda para o TestFlight"). Nesta licença a entrega em produção ainda está travada; leia antes de qualquer deploy de produção ou envio às lojas.
---

# Entregar — ainda travado

${porque}

## O que fazer
1. Diga ao usuário, com estas palavras: "${porque}"
2. **Não** faça deploy de produção (\`vercel --prod\`, \`supabase db push\` no projeto de produção, domínio próprio) nem envio às lojas (\`eas submit\`, TestFlight, Google Play). Prévia e testes continuam liberados.
3. Se uma tarefa do PLAN depender de publicar em produção, registre como bloqueio externo no livro de ocorrências (\`node .claude/hooks/ocorrencias.cjs abrir\`) com o motivo "entrega em produção travada"${s.libera_em ? ` e liberar em ${s.libera_em}` : ''}, e siga com o que não depende dela.
`
  return { caminho: '.claude/skills/entregar/SKILL.md', conteudo }
}

/** Kit com a entrega travada: sem os arquivos que publicam e com a skill /entregar explicando o motivo. */
export function aplicarTravaDeEntrega(arquivos: ArquivoKit[], s: SituacaoEntrega): ArquivoKit[] {
  if (s.liberada) return arquivos
  return [...arquivos.filter((f) => !DA_ENTREGA(f.caminho)), skillEntregaTravada(s)]
}
