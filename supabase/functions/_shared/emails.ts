// Textos dos e-mails (S10 / F01). Só montam o texto; o envio real é do adaptador (etapa /entregar).
// Tom: amigo na mesa de um restaurante. Nunca promete atendimento humano: o suporte é a Ajuda do Atlas.

export interface DadosBoasVindas {
  nome: string
  empresa: string
  ramo: string
  /** Endereço completo de instalação, com o token de uso único (~48 h). */
  link_instalacao: string
  expira_em: Date
}

/** Texto livre do cliente nunca vira endereço ou link no e-mail: tira @, URLs e domínios, e quebras de linha. */
export function neutro(v: string, max = 300): string {
  return v
    .replace(/https?:\/\/\S*/gi, ' ')
    .replace(/\S*@\S*/g, ' ')
    .replace(/\b(?:www\.)?[a-z0-9-]+\.(?:com|net|org|app|io|ly|me|co|br|info|xyz|site|link|top)\b\S*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}
/** Para o assunto: só letras e espaços (sem números, símbolos nem links). */
const soLetras = (v: string) => v.replace(/[^\p{L} ]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 40)

export function montarBoasVindas(d: DadosBoasVindas): { assunto: string; texto: string } {
  const nomeTexto = neutro(d.nome, 60)
  const empresa = neutro(d.empresa, 120)
  const ramo = neutro(d.ramo)
  const negocio = empresa ? `${empresa} (${ramo})` : ramo
  const ate = d.expira_em.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  return {
    assunto: soLetras(d.nome) ? `${soLetras(d.nome)}, o seu Atlas chegou` : 'O seu Atlas chegou',
    texto: [
      `Oi, ${nomeTexto}! Bem-vindo ao Atlas.`,
      '',
      `Já anotei o seu negócio: ${negocio}. Agora falta só instalar o Atlas no computador onde você vai construir.`,
      '',
      'Abra este e-mail no computador e clique no botão (ou no link abaixo):',
      d.link_instalacao,
      '',
      `O link vale para uma instalação e vence em ${ate}. Se abrir no celular, é só abrir de novo no computador.`,
      '',
      'Travou em algum passo? Dentro do Atlas tem a Ajuda do Atlas, que vê o que aconteceu e te guia.',
    ].join('\n'),
  }
}
