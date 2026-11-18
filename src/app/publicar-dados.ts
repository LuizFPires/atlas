// Conteúdo da tela F13a (prototipo/F13aPublicar.dc.html): "Onde o seu sistema vai morar?". 4 opções em multiescolha.
// Pagamento é sempre do cliente: o Atlas mostra o botão certo e espera.

export type IdOpcao = 'gratis' | 'dominio' | 'pwa' | 'lojas'

export interface OpcaoPublicar {
  id: IdOpcao
  nome: string
  /** Caminho do ícone de traço do protótipo (viewBox 24). */
  ic: string
  exemplo: string
  txt: string
  custo: string
}

export const OPCOES: OpcaoPublicar[] = [
  { id: 'gratis', nome: 'Endereço grátis', ic: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18', exemplo: 'cadeira1.vercel.app', txt: 'No ar em poucos minutos, com cadeado de segurança. Ótimo para começar e testar com a equipe.', custo: 'Grátis' },
  { id: 'dominio', nome: 'Seu próprio endereço', ic: 'M4 7h16v10H4zM8 7V5h8v2M9 12h6', exemplo: 'cadeira1.com.br', txt: 'O Atlas confere se o nome está livre, te leva ao Registro.br para comprar e depois configura tudo sozinho.', custo: 'Cerca de R$ 40 por ano (.com.br)' },
  { id: 'pwa', nome: 'App instalável, sem loja', ic: 'M7 2h10v20H7zM11 18h2M12 6v7M9 10l3 3 3-3', exemplo: '"Adicionar à tela inicial"', txt: 'Seus clientes instalam pelo navegador, no Android e no iPhone. O ícone fica igual ao de um aplicativo.', custo: 'Grátis' },
  { id: 'lojas', nome: 'App Store e Google Play', ic: 'M6 3h12l2 5H4zM5 8v13h14V8M10 13h4', exemplo: 'Na busca das lojas', txt: 'O Atlas prepara o app, os textos e as telas da loja. A Apple revisa em alguns dias. No Google, conta pessoal nova testa antes com 12 pessoas por 14 dias.', custo: 'Apple US$ 99/ano · Google US$ 25 uma vez' },
]

export type Selecao = Partial<Record<IdOpcao, boolean>>
/** Seleção inicial do protótipo. */
export const SELECAO_INICIAL: Selecao = { gratis: true, pwa: true }

export interface PassoLateral { quem: 'A' | 'V'; txt: string }

/** "O que vai acontecer": a lista do lado muda conforme o que o cliente marca (A = o Atlas faz, V = é com você). */
export function passosLateral(sel: Selecao): PassoLateral[] {
  const A = (txt: string): PassoLateral => ({ quem: 'A', txt })
  const V = (txt: string): PassoLateral => ({ quem: 'V', txt })
  const p = [A('Vistoria final: testa tudo antes de abrir as portas.')]
  if (sel.gratis || sel.dominio || sel.pwa) p.push(A('Coloca o sistema no ar, com cadeado de segurança.'))
  if (sel.dominio) { p.push(V('Pagar o domínio no Registro.br (o Atlas abre a página certa).')); p.push(A('Liga o domínio ao sistema. Leva até algumas horas para funcionar.')) }
  if (sel.pwa) p.push(A('Prepara o ícone e o "Adicionar à tela inicial".'))
  if (sel.lojas) { p.push(V('Criar as contas de desenvolvedor da Apple e do Google e pagar.')); p.push(A('Prepara o app, os textos, as telas e envia para teste.')); p.push(V('Testar no celular e apertar "Enviar para revisão".')) }
  p.push(A('Entrega as chaves: endereço, QR code e versão.'))
  return p
}

/** "Custo extra para publicar": só o que é pago direto a quem cobra. O Atlas não cobra nada a mais. */
export function custoTotal(sel: Selecao): string {
  const partes: string[] = []
  if (sel.dominio) partes.push('~R$ 40/ano')
  if (sel.lojas) partes.push('US$ 99/ano + US$ 25')
  return partes.length ? partes.join(' + ') : 'Nenhum'
}

/** Os guias que o cliente vai percorrer, na ordem do protótipo. Domínio e app instalável precisam do sistema no ar:
 *  o guia do endereço grátis entra antes mesmo se o cliente não marcou (é a base; custo zero). */
export function guiasEscolhidos(sel: Selecao): IdOpcao[] {
  const ids: IdOpcao[] = []
  if (sel.gratis || sel.dominio || sel.pwa) ids.push('gratis')
  if (sel.dominio) ids.push('dominio')
  if (sel.pwa) ids.push('pwa')
  if (sel.lojas) ids.push('lojas')
  return ids
}
