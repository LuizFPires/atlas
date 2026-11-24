// Textos das travas conhecidas de uma conta (prototipo/caminho-novo/T1Travas e TF1–TF5, aprovadas pelo Luiz em 24/11/2026).
// O processo principal (app/adaptadores/travas.cjs) só diz o TIPO, o serviço e quando libera; todo texto mora aqui, fixo.
// Cada ficha responde: o que aconteceu, se passa sozinho, o que o Atlas faz enquanto isso e o que a pessoa pode fazer.

export type TipoTrava = 'github-minutos' | 'vercel-limite' | 'supabase-dormindo' | 'conta-desligada'
export type TravaObra = { id: number; tipo: TipoTrava; servico: 'GitHub' | 'Vercel' | 'Supabase'; liberaEm: string | null }
export type AcaoTrava = 'feito' | 'site' | 'publico' | 'ligar' | 'depois'
export type OpcaoTrava = { nome: string; desc: string; botao: string; acao: AcaoTrava; recomendado?: boolean; atencao?: boolean }
export type FichaTrava = {
  precisaDeVoce: boolean
  selo: string
  /** Linha curta do cartão no Canteiro. */
  linha: string
  /** Quando volta (rodapé do cartão). */
  volta: string
  titulo: string
  blocos: { rotulo: string; texto: string }[]
  opcoes: OpcaoTrava[]
  rodape: string
  /** Para "resolver": o botão do site e a tradução. */
  guia?: { passo: string; en: string; pt: string; depois: string }
}

const PAPEL = { GitHub: 'o cofre (GitHub)', Vercel: 'a vitrine (Vercel)', Supabase: 'o caderno (Supabase)' } as const

/** "hoje às 15h", "amanhã às 9h30", "dia 1º", "dia 12" (hora local). */
export function quandoLibera(iso: string | null, agora: Date): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return null
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dias = Math.round((dia(d) - dia(agora)) / 86_400_000)
  const hora = `${d.getHours()}h${d.getMinutes() ? String(d.getMinutes()).padStart(2, '0') : ''}`
  if (dias <= 0) return `hoje às ${hora}`
  if (dias === 1) return `amanhã às ${hora}`
  return `dia ${d.getDate() === 1 ? '1º' : d.getDate()}`
}

export function fichaDaTrava(t: TravaObra, agora: Date = new Date()): FichaTrava {
  const quando = quandoLibera(t.liberaEm, agora)
  switch (t.tipo) {
    case 'github-minutos': {
      const q = quando ?? 'dia 1º'
      return {
        precisaDeVoce: false, selo: 'SEGUINDO SEM O GITHUB',
        linha: 'O GitHub parou de conferir o código (o plano grátis do mês acabou). O Atlas confere aqui e segue.',
        volta: `GITHUB VOLTA ${q.toUpperCase()} · SOZINHO`,
        titulo: 'O GitHub parou de conferir o seu código. A obra continua.',
        blocos: [
          { rotulo: 'O QUE ACONTECEU', texto: 'O GitHub confere cada parte nova do sistema. No plano grátis, ele dá um tanto de minutos por mês, e os deste mês acabaram.' },
          { rotulo: 'PASSA SOZINHO?', texto: `Sim. ${q[0].toUpperCase()}${q.slice(1)} os minutos voltam e o Atlas percebe sozinho. Você não precisa fazer nada.` },
          { rotulo: 'O QUE O ATLAS FAZ', texto: 'Faz a mesma conferência aqui no seu computador (testes, revisão, montagem) e continua construindo. Nada fica sem conferir.' },
        ],
        opcoes: [
          { nome: 'Deixar o Atlas conferir aqui', desc: 'Não custa nada e não expõe o seu código. O computador trabalha um pouco mais.', botao: 'Já está assim ✓', acao: 'feito', recomendado: true },
          { nome: `Deixar o projeto público até ${q}`, desc: 'Projeto público não gasta minutos. Mas o código fica visível para qualquer um.', botao: 'Ver o que muda', acao: 'publico', atencao: true },
          { nome: 'Aumentar o limite no GitHub', desc: 'Você coloca um valor máximo de gasto na sua conta. Custa por minuto usado. O Atlas mostra onde clicar.', botao: 'Mostrar onde', acao: 'site' },
        ],
        rodape: 'Esta decisão é sua: o Atlas nunca muda o seu plano, nem deixa nada público, sem você pedir.',
        guia: { passo: 'O site do GitHub já está aberto ao lado. Em Actions, clique em Edit e escolha um valor máximo de gasto.', en: 'Spending limit', pt: 'Limite de gasto', depois: 'Pronto. Assim que o GitHub aceitar, o Atlas percebe sozinho.' },
      }
    }
    case 'vercel-limite': {
      const q = quando ?? 'amanhã'
      return {
        precisaDeVoce: false, selo: q.startsWith('hoje') ? 'PUBLICA MAIS TARDE' : 'PUBLICA AMANHÃ',
        linha: 'A vitrine (Vercel) já publicou o máximo de vezes de hoje. A obra segue construindo.',
        volta: `PUBLICA ${q.toUpperCase()} · SOZINHO`,
        titulo: `A Vercel já publicou o máximo de hoje. ${q[0].toUpperCase()}${q.slice(1)} publica sozinha.`,
        blocos: [
          { rotulo: 'O QUE ACONTECEU', texto: 'No plano grátis, a Vercel deixa colocar o sistema no ar até 100 vezes por dia. Hoje esse número acabou.' },
          { rotulo: 'PASSA SOZINHO?', texto: `Sim. ${q[0].toUpperCase()}${q.slice(1)} o Atlas publica a versão mais nova. Você não precisa fazer nada.` },
          { rotulo: 'O QUE O ATLAS FAZ', texto: 'Continua construindo e testando. E daqui para frente publica só quando uma etapa inteira termina, para não chegar no limite de novo.' },
        ],
        opcoes: [
          { nome: 'Esperar', desc: 'Nada muda para você. O que já está no ar continua no ar.', botao: 'Combinado ✓', acao: 'feito', recomendado: true },
          { nome: 'Mudar a Vercel para o plano pago', desc: 'Libera na hora, mas tem mensalidade (em dólar). Só vale se você precisa mostrar hoje.', botao: 'Mostrar onde', acao: 'site' },
        ],
        rodape: 'O que já está no ar não sai do ar. Só a versão mais nova espera.',
        guia: { passo: 'O site da Vercel já está aberto ao lado, na página de planos. Escolha o Pro se quiser liberar agora.', en: 'Upgrade to Pro', pt: 'Mudar para o plano pago', depois: 'Pronto. O Atlas publica assim que a Vercel liberar.' },
      }
    }
    case 'supabase-dormindo':
      return {
        precisaDeVoce: true, selo: 'PRECISA DE VOCÊ · 1 CLIQUE',
        linha: 'O caderno (Supabase) dormiu porque ficou uma semana sem uso. É um clique para acordar.',
        volta: 'LEVA 1 MINUTO',
        titulo: 'O caderno do seu sistema dormiu. Um clique e ele acorda.',
        blocos: [
          { rotulo: 'O QUE ACONTECEU', texto: 'No plano grátis, o Supabase põe para dormir o projeto que fica 7 dias sem ninguém usar. Nada foi apagado.' },
          { rotulo: 'PASSA SOZINHO?', texto: 'Não. Só o dono da conta pode acordar. É um botão, e o Atlas mostra qual.' },
          { rotulo: 'O QUE O ATLAS FAZ', texto: 'Segue com as partes que não usam o caderno. Assim que ele acordar, o Atlas percebe e continua o resto.' },
        ],
        opcoes: [
          { nome: 'Acordar o caderno agora', desc: 'O Atlas abre o site no lugar certo. Clique em Restore project e espere 1 a 2 minutos.', botao: 'Acordar o caderno agora (1 min) →', acao: 'site', recomendado: true },
          { nome: 'Fazer depois', desc: 'A obra continua no que der. O aviso fica aqui até você acordar.', botao: 'Fazer depois', acao: 'depois' },
        ],
        rodape: 'Seus dados estão guardados. Dormir não apaga nada.',
        guia: { passo: 'O site do Supabase já está aberto ao lado. Abra o seu projeto e clique no botão verde Restore project.', en: 'Restore project', pt: 'Acordar o projeto', depois: 'Pronto. O caderno leva de 1 a 2 minutos para acordar. Pode fechar: o Atlas percebe sozinho e continua a obra.' },
      }
    case 'conta-desligada':
    default:
      return {
        precisaDeVoce: true, selo: `PRECISA DE VOCÊ · ${t.servico.toUpperCase()}`,
        linha: `${PAPEL[t.servico][0].toUpperCase()}${PAPEL[t.servico].slice(1)} saiu deste computador. Um clique liga de novo.`,
        volta: 'LEVA 1 MINUTO',
        titulo: `A conta ${t.servico === 'Vercel' ? 'da' : 'do'} ${t.servico} saiu deste computador. Um clique liga de novo.`,
        blocos: [
          { rotulo: 'O QUE ACONTECEU', texto: `O login ${t.servico === 'Vercel' ? 'da' : 'do'} ${t.servico} venceu ou foi desligado no site. Acontece de tempos em tempos, por segurança.` },
          { rotulo: 'PASSA SOZINHO?', texto: 'Não. Só você pode dar a permissão de novo. É o mesmo código de quando você ligou a primeira vez.' },
          { rotulo: 'O QUE O ATLAS FAZ', texto: `Segue com o que não depende ${t.servico === 'Vercel' ? 'da' : 'do'} ${t.servico}. Ligou de novo, continua o resto sozinho.` },
        ],
        opcoes: [
          { nome: 'Ligar de novo', desc: 'Abre a tela das contas só com esta conta. Código na tela, você confirma no site.', botao: 'Ligar de novo →', acao: 'ligar', recomendado: true },
          { nome: 'Fazer depois', desc: 'A obra continua no que der. O aviso fica aqui até você ligar.', botao: 'Fazer depois', acao: 'depois' },
        ],
        rodape: 'O Atlas nunca vê a sua senha: você confirma direto no site.',
      }
  }
}
