// Textos e HTML dos e-mails (S10 / F01). Só montam o conteúdo; o envio real é do adaptador (etapa /entregar).
// Tom: amigo na mesa de um restaurante. Nunca promete atendimento humano: o suporte é a Ajuda do Atlas.
// Fonte da verdade visual: prototipo/F01Email.dc.html (tema escuro: hero #141619, lime #C6F135).

export interface DadosBoasVindas {
  nome: string
  empresa: string
  ramo: string
  /** Endereço completo de instalação, com o token de uso único (~48 h). */
  link_instalacao: string
  expira_em: Date
}

export interface EmailMontado { assunto: string; texto: string; html: string }

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

/** Escapa tudo que vai para dentro do HTML (texto do cliente nunca vira marcação). */
export function esc(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** O link do botão só pode ser https (ou http local); qualquer outra coisa vira vazio e o e-mail não sai com botão quebrado. */
export function linkSeguro(v: string): string {
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : ''
  } catch {
    return ''
  }
}

export const quando = (d: Date, comHora = true) =>
  d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', ...(comHora ? { hour: '2-digit', minute: '2-digit' } : {}) })

export const COR = { hero: '#141619', lime: '#C6F135', tinta: '#1B1E22', suave: '#3E443C', claro: '#6B7268', caixa: '#F2F3EE', fundo: '#E9EAE6' }
const FONTE = "'Geist',system-ui,-apple-system,'Segoe UI',Arial,sans-serif"
export const MONO = "'Geist Mono',ui-monospace,Consolas,monospace"

export const ICONES = {
  microfone: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  chave: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
}
/** Bolinha de ícone: SVG de traço sobre círculo lime (nunca emoji). */
function bolinha(icone: keyof typeof ICONES): string {
  return `<span style="display:inline-block;width:40px;height:40px;border-radius:20px;background:${COR.lime};color:#141619;text-align:center;line-height:40px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" style="vertical-align:middle">${ICONES[icone]}</svg></span>`
}

/** Moldura comum: hero escuro com a marca, corpo claro. Tabelas porque e-mail não entende flex. */
export function moldura(o: { titulo: string; subtitulo: string; corpo: string; preheader: string }): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${esc(o.titulo)}</title></head>
<body style="margin:0;padding:0;background:${COR.fundo};font-family:${FONTE}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COR.fundo}"><tr><td align="center" style="padding:36px 12px">
<table role="presentation" width="680" cellpadding="0" cellspacing="0" style="width:100%;max-width:680px;background:#FFFFFF;border-radius:16px;overflow:hidden">
<tr><td style="background:${COR.hero};padding:36px 44px">
<div style="font-family:${MONO};font-size:14px;letter-spacing:.18em;color:${COR.lime};font-weight:500">ATLAS</div>
<h1 style="margin:20px 0 0;color:#EDEFEA;font-size:34px;line-height:1.15;letter-spacing:-0.01em;font-weight:600">${esc(o.titulo)}</h1>
<p style="margin:20px 0 0;color:#B4BBB2;font-size:16px;line-height:1.5">${esc(o.subtitulo)}</p>
</td></tr>
<tr><td style="padding:32px 44px;color:${COR.tinta}">${o.corpo}</td></tr>
</table></td></tr></table></body></html>`
}

export const p = (t: string, extra = '') => `<p style="margin:0 0 22px;font-size:16px;line-height:1.6;${extra}">${t}</p>`
export const botao = (href: string, rotulo: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px"><tr><td style="border-radius:12px;background:${COR.lime}"><a href="${esc(href)}" style="display:inline-block;padding:16px 26px;border-radius:12px;background:${COR.lime};color:#141619;font-weight:700;font-size:17px;text-decoration:none">${esc(rotulo)}</a></td></tr></table>`
export const caixa = (titulo: string, linhas: string[]) =>
  `<div style="margin:0 0 22px;background:${COR.caixa};border-radius:12px;padding:18px 20px;font-size:15px;line-height:1.6;color:${COR.suave}"><b style="color:${COR.tinta}">${esc(titulo)}</b>${linhas.map((l) => `<br>${esc(l)}`).join('')}</div>`
export const destaque = (icone: keyof typeof ICONES, corpo: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;border:2px solid ${COR.lime};border-radius:12px"><tr><td width="56" valign="top" style="padding:16px 0 16px 18px">${bolinha(icone)}</td><td style="padding:16px 18px 16px 12px;font-size:15px;line-height:1.5;color:${COR.suave}">${corpo}</td></tr></table>`
export const rodape = (t: string) => `<p style="margin:0;font-size:13px;line-height:1.5;color:${COR.claro}">${t}</p>`

export const AJUDA = 'Travou em algum passo? Dentro do Atlas tem a Ajuda do Atlas, que vê o que aconteceu e te guia.'

export function montarBoasVindas(d: DadosBoasVindas): EmailMontado {
  const nomeTexto = neutro(d.nome, 60)
  const empresa = neutro(d.empresa, 120)
  const ramo = neutro(d.ramo)
  const negocio = empresa && ramo ? `${empresa} (${ramo})` : empresa || ramo
  const ate = quando(d.expira_em)
  const link = linkSeguro(d.link_instalacao)
  const primeiroNome = nomeTexto.split(' ')[0] || ''
  const titulo = primeiroNome ? `${primeiroNome}, sua licença do Atlas está pronta.` : 'Sua licença do Atlas está pronta.'
  const html = moldura({
    titulo,
    subtitulo: `A partir de agora você constrói os sistemas da sua empresa, sem programar.${negocio ? ` Já anotei o seu negócio: ${negocio}.` : ''}`,
    preheader: 'Abra este e-mail no computador onde você vai trabalhar e clique no botão.',
    corpo: [
      p('Abra este e-mail <b>no computador onde você vai trabalhar</b> e clique no botão. Leva uns 10 minutos.'),
      link ? botao(link, 'Instalar o Atlas neste computador') : '',
      caixa('O que vai acontecer', ['1. O instalador pede um código que chega neste e-mail.', '2. Você conecta a sua conta do Claude.', '3. O Atlas te ajuda a abrir as contas que o seu sistema vai usar.']),
      destaque('microfone', `<b style="color:${COR.tinta}">Você não vai precisar digitar.</b> No Atlas, tudo pode ser falado. É só apertar o microfone e conversar como se estivesse com um amigo na mesa de um restaurante.`),
      rodape(`O botão funciona uma vez só e vale até ${esc(ate)} (48 horas). Abriu no celular? Toque em "Enviar para o meu computador".`),
      `<p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:${COR.claro}">${esc(AJUDA)}</p>`,
    ].join(''),
  })
  return {
    assunto: soLetras(d.nome) ? `${soLetras(d.nome)}, o seu Atlas chegou` : 'O seu Atlas chegou',
    texto: [
      `Oi, ${nomeTexto}! Bem-vindo ao Atlas.`,
      '',
      `${negocio ? `Já anotei o seu negócio: ${negocio}. ` : ''}Agora falta só instalar o Atlas no computador onde você vai construir.`,
      '',
      'Abra este e-mail no computador e clique no botão (ou no link abaixo):',
      d.link_instalacao,
      '',
      `O link vale para uma instalação e vence em ${ate}. Se abrir no celular, é só abrir de novo no computador.`,
      '',
      AJUDA,
    ].join('\n'),
    html,
  }
}
