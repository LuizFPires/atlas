// Textos e HTML dos e-mails (S10 / F01). Só montam o conteúdo; o envio real é do adaptador (etapa /entregar).
// Tom: amigo na mesa de um restaurante. Nunca promete atendimento humano: o suporte é a Ajuda do Atlas.
// Fonte da verdade visual: prototipo/F01Email.dc.html — e-mail CLARO (cartão branco, texto escuro) com faixa
// escura no topo (hero #141619), "ATLAS" em lime (#C6F135) e botão lime. Fiel ao protótipo aprovado.

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

// Cores do protótipo (tema escuro padrão): e-mail CLARO com faixa escura no topo.
export const COR = {
  hero: '#141619', lime: '#C6F135', limeTexto: '#141619',
  fundo: '#E9EAE6', card: '#FFFFFF', borda: '#D7D9D2',
  tituloHero: '#EDEFEA', subHero: '#B4BBB2',
  tinta: '#1B1E22', corpo: '#3E443C', claro: '#6B7268',
  caixa: '#F2F3EE',
}
const FONTE = "'Geist',system-ui,-apple-system,'Segoe UI',Arial,sans-serif"
export const MONO = "'Geist Mono',ui-monospace,Consolas,monospace"


export const ICONES = {
  microfone: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  chave: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
}
/** Bolinha de ícone: imagem (círculo lime + ícone escuro embutidos), que o Gmail não escurece. */

// Modo escuro dos apps de e-mail: tudo o que é lime (faixa do topo, botão, microfone) é IMAGEM, que o cliente
// não inverte. Então aqui basta declarar que o e-mail suporta claro e escuro; o corpo é texto sobre o cartão,
// que o cliente escurece de forma consistente (fundo e texto juntos), continuando legível.
// O e-mail é claro de propósito (cartão branco, texto escuro; faixa e botão escuros são IMAGEM). Travamos em modo
// claro ("only light") para o cliente de e-mail NÃO inverter — a inversão parcial do Mail/Gmail no modo escuro
// deixava o título escuro sobre fundo escurecido (apagado). Assim o design aparece como foi desenhado em todo lugar.
const DEFESA_ESCURO = `:root{color-scheme:only light;supported-color-schemes:only light}`

/** Moldura comum: cartão branco (tema do protótipo), faixa escura no topo com a marca ATLAS em lime. Tabelas porque e-mail não entende flex. */
export function moldura(o: { titulo: string; subtitulo: string; corpo: string; preheader: string }): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(o.titulo)}</title><style>${DEFESA_ESCURO}</style></head>
<body style="margin:0;padding:0;background:${COR.fundo};font-family:${FONTE}">
<u></u><div class="corpo" style="background:${COR.fundo}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COR.fundo}"><tr><td align="center" style="padding:36px 12px">
<table role="presentation" width="680" cellpadding="0" cellspacing="0" style="width:100%;max-width:680px;background:${COR.card};border-radius:16px;overflow:hidden">
<tr><td class="hero" bgcolor="${COR.hero}" style="padding:18px 44px;background:${COR.hero}">
<span style="font-family:${FONTE};font-size:20px;font-weight:800;letter-spacing:0.18em;color:${COR.lime}">ATLAS</span>
</td></tr>
<tr><td style="padding:34px 44px 6px;background:${COR.card};color:${COR.tinta}">
<h1 style="margin:0;color:${COR.tinta};font-size:30px;line-height:1.18;letter-spacing:-0.01em;font-weight:600">${esc(o.titulo)}</h1>
<p style="margin:16px 0 0;color:${COR.corpo};font-size:16px;line-height:1.55">${esc(o.subtitulo)}</p>
</td></tr>
<tr><td style="padding:26px 44px 32px;background:${COR.card};color:${COR.tinta}">${o.corpo}</td></tr>
</table></td></tr></table>
</div></body></html>`
}

export const p = (t: string, extra = '') => `<p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:${COR.tinta};${extra}">${t}</p>`

// Botão em TEXTO (célula com fundo lime + link). Imagem grande no e-mail faz o Gmail tratar como propaganda (aba Promoções);
// decisão do Luiz em 22/11/2026: chegar na Principal vale mais que o lime perfeito no modo escuro.
export const botao = (href: string, rotulo: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px"><tr><td bgcolor="${COR.lime}" style="border-radius:12px;background:${COR.lime}"><a href="${esc(href)}" style="display:inline-block;padding:15px 26px;border-radius:12px;font-family:${FONTE};font-size:17px;font-weight:700;color:${COR.limeTexto};text-decoration:none">${esc(rotulo)}</a></td></tr></table>`
export const caixa = (titulo: string, linhas: string[]) =>
  `<div style="margin:0 0 22px;background:${COR.caixa};border-radius:12px;padding:18px 20px;font-size:15px;line-height:1.6;color:${COR.corpo}"><b style="color:${COR.tinta}">${esc(titulo)}</b>${linhas.map((l) => `<br>${esc(l)}`).join('')}</div>`
export const destaque = (icone: keyof typeof ICONES, corpo: string) =>
  `<div data-icone="${icone}" style="margin:0 0 22px;background:${COR.caixa};border-left:4px solid ${COR.lime};border-radius:12px;padding:16px 20px;font-size:15px;line-height:1.5;color:${COR.corpo}">${corpo}</div>`
/** Aviso da tela azul do Windows (SmartScreen): o instalador ainda não é assinado, então o cliente é avisado ANTES de ver a tela.
 *  Sai daqui quando o instalador for assinado ou for para a Microsoft Store. Mesmo texto da página /instalar. */
export const AVISO_WINDOWS = {
  titulo: 'O Windows vai pedir uma confirmação',
  linhas: [
    'Ao abrir o instalador, aparece uma tela azul dizendo "O Windows protegeu o computador". Ela aparece porque o Atlas é um programa novo e o Windows ainda não o conhece.',
    '1. Clique em "Mais informações".',
    '2. Clique em "Executar assim mesmo".',
  ],
}
/** O cliente precisa saber ANTES de instalar: o Atlas só funciona com uma assinatura do Claude, paga à parte.
 *  Sem citar nomes de plano (mudam com o tempo). Mesmo texto da página de vendas (src/web/conteudo.ts, AVISO_CLAUDE). */
export const AVISO_CLAUDE = {
  titulo: 'O Atlas só funciona com uma assinatura do Claude',
  linhas: [
    'O Claude é quem constrói o seu sistema. A assinatura dele é paga direto à Anthropic, à parte do Atlas.',
    'Quanto maior o plano, mais rápido a obra anda.',
    'Ainda não tem? Você cria a conta e assina no site do Claude. O Atlas te guia na hora de conectar.',
  ],
}
const avisoClaude = () => caixa(AVISO_CLAUDE.titulo, AVISO_CLAUDE.linhas)
const avisoClaudeTexto = () => [`${AVISO_CLAUDE.titulo}.`, ...AVISO_CLAUDE.linhas]

const avisoWindows = () => caixa(AVISO_WINDOWS.titulo, AVISO_WINDOWS.linhas)
const avisoWindowsTexto = () => [`${AVISO_WINDOWS.titulo}:`, ...AVISO_WINDOWS.linhas]

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
      avisoClaude(),
      avisoWindows(),
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
      ...avisoClaudeTexto(),
      '',
      ...avisoWindowsTexto(),
      '',
      AJUDA,
    ].join('\n'),
    html,
  }
}

export interface DadosCortesia { validade_em: Date; /** Endereço de instalação com o token de uso único. */ link: string; /** Até quando o link vale. */ link_expira_em: Date; /** Nome de quem recebe (só o primeiro vai no assunto). */ nome?: string }

/** Quem assina os e-mails de acesso: uma pessoa (o Gmail trata carta de pessoa como conversa, não como propaganda). */
export const ASSINATURA = 'Luiz, do Atlas'

/** Remetente de pessoa ("Luiz, do Atlas <ola@...>") com o endereço já configurado (ATLAS_EMAIL_FROM). Sem endereço válido: como veio. */
export function remetentePessoal(de: string): string {
  const m = /<([^<>\s]+@[^<>\s]+)>\s*$/.exec(de) ?? /^\s*([^<>\s]+@[^<>\s]+)\s*$/.exec(de)
  return m ? `${ASSINATURA} <${m[1]}>` : de
}

/** Carta simples (Luiz, 23/11/2026: os e-mails caíam em Promoções): fundo branco, texto, um link sublinhado e assinatura. Sem faixa
 *  de marca, sem botão colorido, sem caixas coloridas e sem imagem. */
function carta(paragrafos: string[]): string {
  const corpo = paragrafos.map((t) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1B1E22">${t}</p>`).join('')
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:24px 16px;background:#FFFFFF;font-family:Arial,Helvetica,sans-serif"><div style="max-width:560px">${corpo}</div></body></html>`
}
const linkTexto = (href: string, rotulo: string) => `<a href="${esc(href)}" style="color:#1A55C4;font-weight:700">${esc(rotulo)}</a>`

/** Cortesia liberada pelo gestor: avisa do acesso liberado, até quando vale e traz o link de instalação. Sem promessa de atendimento humano. */
export function montarCortesia(d: DadosCortesia): EmailMontado {
  const link = linkSeguro(d.link)
  const validade = d.validade_em.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }) // dd/mm/aaaa
  const ate = quando(d.link_expira_em)
  const primeiro = soLetras(d.nome ?? '').split(' ')[0] ?? ''
  const oi = primeiro ? `Oi, ${primeiro}!` : 'Oi!'
  const linhasClaude = [`${AVISO_CLAUDE.titulo}.`, ...AVISO_CLAUDE.linhas]
  const linhasWindows = [`${AVISO_WINDOWS.titulo}:`, ...AVISO_WINDOWS.linhas]
  const html = carta([
    esc(oi),
    `Liberei um acesso ao Atlas para você, válido até <b>${esc(validade)}</b>. O Atlas é o jeito de construir os sistemas do seu negócio sem programar. No dia ${esc(validade)} o acesso acaba sozinho e não fica nenhuma conta pendente.`,
    `Abra este e-mail <b>no computador onde você vai trabalhar</b> e clique no link: ${link ? linkTexto(link, 'Instalar o Atlas neste computador') : '(link indisponível)'}. Leva uns 10 minutos.`,
    linhasWindows.map(esc).join('<br>'),
    linhasClaude.map(esc).join('<br>'),
    `No Atlas você não precisa digitar: é só apertar o microfone e conversar.`,
    `O link funciona uma vez e vale até ${esc(ate)}. Se você recebeu mais de um e-mail com link, use o mais novo: os anteriores deixam de valer.`,
    `${esc(AJUDA)}`,
    `Um abraço,<br>${esc(ASSINATURA)}`,
  ])
  return {
    // Assunto de carta, com o primeiro nome; a validade continua no assunto para cada cortesia nova chegar como e-mail separado
    // (pedido do Luiz em 22/11/2026: com o mesmo assunto, o Gmail juntava à conversa antiga e ela "não chegava").
    assunto: `${primeiro ? `${primeiro}, seu` : 'Seu'} link para instalar o Atlas (até ${validade.slice(0, 5)})`,
    texto: [
      oi,
      '',
      `Liberei um acesso ao Atlas para você, válido até ${validade}. No dia ${validade} o acesso acaba sozinho, sem você precisar fazer nada.`,
      '',
      'Abra este e-mail no computador onde você vai trabalhar e clique no link abaixo (leva uns 10 minutos):',
      d.link,
      '',
      `O link funciona uma vez e vale até ${ate}. Se você recebeu mais de um e-mail com link, use o mais novo: os anteriores deixam de valer.`,
      '',
      ...avisoClaudeTexto(),
      '',
      ...avisoWindowsTexto(),
      '',
      AJUDA,
      '',
      'Um abraço,',
      ASSINATURA,
    ].join('\n'),
    html,
  }
}

export interface DadosConfirmacaoDegustacao { dias: number; expira_em: Date; /** Endereço de confirmação com o token de uso único. */ link: string }

/** Confirmação da degustação: só o clique libera o teste. Sem promessa de atendimento humano. */
export function montarConfirmacaoDegustacao(d: DadosConfirmacaoDegustacao): EmailMontado {
  const link = linkSeguro(d.link)
  const ate = quando(d.expira_em)
  const html = moldura({
    titulo: `Falta um clique para liberar o seu teste de ${d.dias} dias.`,
    subtitulo: 'Confirme que este e-mail é seu e eu libero o Atlas para você experimentar.',
    preheader: 'Clique no botão para liberar o seu teste do Atlas.',
    corpo: [
      p('Alguém (espero que você) pediu um teste do Atlas com este e-mail. Para liberar, clique no botão abaixo.'),
      link ? botao(link, 'Liberar o meu teste') : '',
      caixa('Como funciona', [`O teste vale ${d.dias} dias, contados a partir do clique.`, 'Quando acabar, o acesso fecha sozinho. Nada é cobrado.']),
      avisoClaude(),
      rodape(`O botão funciona uma vez só e vale até ${esc(ate)}. Se não foi você, é só ignorar este e-mail: nada acontece.`),
      `<p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:${COR.claro}">${esc(AJUDA)}</p>`,
    ].join(''),
  })
  return {
    assunto: 'Confirme o seu e-mail para liberar o teste do Atlas',
    texto: [
      `Oi! Alguém (espero que você) pediu um teste de ${d.dias} dias do Atlas com este e-mail.`,
      '',
      'Para liberar, abra o link abaixo:',
      d.link,
      '',
      `O link funciona uma vez e vale até ${ate}. Se não foi você, ignore: nada acontece e nada é cobrado.`,
      '',
      ...avisoClaudeTexto(),
      '',
      AJUDA,
    ].join('\n'),
    html,
  }
}
