// Conteúdo da tela F03 (prototipo/F03Claude.dc.html): o passo a passo do login no claude.ai.
// O site do Claude é em inglês: cada palavra em inglês vem traduzida (en -> pt).

export interface ItemSite { tipo: 'botao' | 'campo'; txt: string; destaque?: boolean; dica?: string }
export interface PassoClaude {
  faca: string
  calma: string
  /** "O que vai aparecer" no site (prévia ao lado). */
  site: { url: string; titulo: string; itens: ItemSite[] }
  en?: string
  pt?: string
}

const B = (txt: string, destaque = false): ItemSite => ({ tipo: 'botao', txt, destaque, dica: 'clique aqui' })
const C = (txt: string, destaque = false, dica = 'escreva aqui'): ItemSite => ({ tipo: 'campo', txt, destaque, dica })

export const PASSOS_CLAUDE: PassoClaude[] = [
  { faca: 'Clique no botão verde. O Atlas vai abrir o site do Claude no seu navegador.', calma: 'O site é em inglês. Não tem problema: eu traduzo cada botão para você.', site: { url: 'claude.ai/login', titulo: 'Log in to Claude', itens: [C('Enter your email'), B('Continue with email')] } },
  { faca: 'Escreva na caixinha o e-mail da sua conta do Claude.', calma: 'É o mesmo e-mail que você usou para assinar o Claude.', site: { url: 'claude.ai/login', titulo: 'Log in to Claude', itens: [C('zé@barbeariadoze.com.br', true, 'seu e-mail'), B('Continue with email')] }, en: 'Enter your email', pt: 'Escreva o seu e-mail' },
  { faca: 'Agora clique no botão Continue with email.', calma: 'Você entra com Google? Então clique em "Continue with Google" e escolha a sua conta.', site: { url: 'claude.ai/login', titulo: 'Log in to Claude', itens: [C('zé@barbeariadoze.com.br'), B('Continue with email', true)] }, en: 'Continue with email', pt: 'Continuar com o e-mail' },
  { faca: 'O Claude mandou um código para o seu e-mail. Abra o e-mail, copie o código e cole lá.', calma: 'Não chegou? Olhe a caixa de spam. Pode levar 1 minutinho.', site: { url: 'claude.ai/login', titulo: 'Check your email', itens: [C('_ _ _ _ _ _', true, 'cole aqui'), B('Verify')] }, en: 'Verify', pt: 'Confirmar' },
  { faca: 'Vai aparecer uma pergunta. Clique no botão Authorize.', calma: 'Aparece "Claude Code" porque o Atlas trabalha dentro dele. É seguro: o Atlas nunca vê a sua senha.', site: { url: 'claude.ai/oauth/authorize', titulo: 'Claude Code quer se conectar à sua conta do Claude', itens: [B('Authorize', true), B('Cancel')] }, en: 'Authorize', pt: 'Deixar / Permitir' },
  { faca: 'Pronto! Pode fechar o navegador. O Atlas já está conectado.', calma: 'Clique em "Ver meu plano" para saber como o Atlas vai trabalhar com a sua assinatura.', site: { url: 'claude.ai/oauth/code/success', titulo: 'Tudo certo! Pode fechar esta janela.', itens: [] } },
]
