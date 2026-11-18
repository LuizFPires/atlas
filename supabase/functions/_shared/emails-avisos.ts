// Item 3 — e-mails de código de ativação (M2) e de aviso de atraso antes da pausa (M3). Mesma moldura do F01.
import { AJUDA, botao, caixa, destaque, esc, linkSeguro, moldura, MONO, COR, neutro, p, quando, rodape, type EmailMontado } from './emails.ts'

/** Código de 6 dígitos (ativação do M2). Só aceita dígitos: nada mais entra no e-mail. */
export function montarCodigoAtivacao(d: { nome?: string; codigo: string; validade_min?: number; finalidade?: 'ativacao' | 'troca' }): EmailMontado {
  const codigo = d.codigo.replace(/\D/g, '').slice(0, 8)
  if (!codigo) throw new Error('codigo_vazio: o código de ativação precisa ter dígitos.')
  const min = d.validade_min ?? 10
  const troca = d.finalidade === 'troca'
  const nome = neutro(d.nome ?? '', 60).split(' ')[0]
  const titulo = troca ? 'Seu código para trocar de computador' : 'Seu código para instalar o Atlas'
  const quem = nome ? `${nome}, ` : ''
  const corpo = [
    p(`${esc(quem)}volte ao instalador e digite este código${troca ? ' para passar o Atlas para o computador novo' : ''}:`),
    `<div style="margin:0 0 22px;background:${COR.caixa};border-radius:12px;padding:20px;text-align:center;font-family:${MONO};font-size:36px;letter-spacing:.3em;font-weight:500;color:${COR.tinta}">${esc(codigo)}</div>`,
    destaque('relogio', `Ele vale por <b style="color:${COR.tinta}">${min} minutos</b> e só uma vez. Passou? É só pedir outro no instalador.`),
    destaque('microfone', `<b style="color:${COR.tinta}">Dá para falar o código.</b> No Atlas, tudo pode ser falado: aperte o microfone e leia os números em voz alta.`),
    rodape('Você não pediu este código? Ignore este e-mail: sem ele ninguém consegue entrar. Nunca passe o código para ninguém.'),
    `<p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:${COR.claro}">${esc(AJUDA)}</p>`,
  ].join('')
  return {
    assunto: `${codigo} é o seu código do Atlas`,
    texto: [
      `${quem}o seu código do Atlas é: ${codigo}`,
      '',
      `Volte ao instalador e digite esse código. Ele vale por ${min} minutos e só uma vez.`,
      'Você não pediu? Ignore este e-mail. Nunca passe o código para ninguém.',
      '',
      AJUDA,
    ].join('\n'),
    html: moldura({ titulo, subtitulo: 'É rapidinho: digite o código e pronto.', preheader: `Seu código: ${codigo}`, corpo }),
  }
}

export interface DadosAvisoAtraso { n: 1 | 2 | 3; pausa_em: Date; nome: string; link_pagamento?: string }

/** Aviso de mensalidade atrasada antes da pausa (M3: status 'atrasada', pausa_prevista_em). Avisos 1, 2 e 3. */
export function montarAvisoAtraso(d: DadosAvisoAtraso, agora: Date = new Date()): EmailMontado {
  const nome = neutro(d.nome, 60).split(' ')[0]
  const quem = nome ? `${nome}, ` : ''
  const dias = Math.max(0, Math.ceil((d.pausa_em.getTime() - agora.getTime()) / 86_400_000))
  const data = quando(d.pausa_em, false)
  const prazo = dias <= 1 ? 'até amanhã' : `em ${dias} dias`
  const ultimo = d.n === 3
  const titulo = ultimo ? 'Última chamada: a mensalidade do Atlas' : 'A mensalidade do Atlas não passou'
  const link = d.link_pagamento ? linkSeguro(d.link_pagamento) : ''
  const corpo = [
    p(`${esc(quem)}a cobrança da sua mensalidade não deu certo (às vezes é cartão vencido ou limite). Acontece com todo mundo.`),
    destaque('relogio', `Suas obras continuam andando <b style="color:${COR.tinta}">até ${esc(data)}</b> (${esc(prazo)}). Depois disso o Atlas <b style="color:${COR.tinta}">pausa</b> e espera você acertar.`),
    link ? botao(link, 'Acertar a mensalidade') : '',
    caixa('O que acontece se eu não fizer nada', ['As obras já feitas continuam suas, no seu GitHub.', 'Só a produção de coisas novas fica parada.', 'Quando você paga, o Atlas volta sozinho de onde parou.']),
    rodape('A cobrança é feita pela conta que você usou na compra. O Atlas não guarda os dados do seu cartão.'),
    `<p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:${COR.claro}">${esc(AJUDA)}</p>`,
  ].join('')
  return {
    assunto: ultimo ? 'Última chamada: a mensalidade do Atlas' : 'A mensalidade do Atlas precisa de um acerto',
    texto: [
      `${quem}a cobrança da sua mensalidade não deu certo.`,
      `Suas obras continuam andando até ${data} (${prazo}). Depois disso o Atlas pausa e espera você acertar.`,
      'O que já foi feito continua seu, no seu GitHub. Quando você paga, o Atlas volta sozinho de onde parou.',
      ...(link ? ['', `Acertar a mensalidade: ${link}`] : []),
      '',
      AJUDA,
    ].join('\n'),
    html: moldura({ titulo, subtitulo: 'Sem susto: dá tempo de resolver.', preheader: `Suas obras continuam até ${data}.`, corpo }),
  }
}
