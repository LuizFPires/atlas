// Conteúdo da tela F04 (prototipo/F04Contas.dc.html): o passo a passo das contas do PRÓPRIO cliente.
// O Atlas não cria conta, não digita credencial e não guarda senha: ele guia e detecta.
// O site é em inglês: cada palavra em inglês vem traduzida (en -> pt).
// Os nomes dos botões dos sites reais precisam ser conferidos no /entregar (app/PENDENTE-ENTREGAR.md).

export type IdConta = 'github' | 'supabase' | 'hosp' | 'pag'
/** Quem faz o passo: o cliente (VOCÊ) ou o próprio Atlas (O ATLAS). */
export type Quem = 'voce' | 'atlas'
export const ROTULO_QUEM: Record<Quem, string> = { voce: 'VOCÊ', atlas: 'O ATLAS' }

export interface ItemSite { tipo: 'botao' | 'campo' | 'status'; txt: string; destaque?: boolean; dica?: string }
/** Linha para copiar e colar (ex.: registro de DNS). */
export interface DadoCopiar { tipo: string; nome: string; valor: string }
export interface PassoConta {
  /** Linhas para o cliente copiar e colar no site (o Atlas só mostra; quem cola é o cliente). */
  dados?: DadoCopiar[]
  faca: string
  calma: string
  quem: Quem
  site: { url: string; titulo: string; itens: ItemSite[] }
  en?: string
  pt?: string
}
export interface Conta {
  id: IdConta
  nome: string
  oque: string
  porque: string
  opcional?: boolean
  passos: PassoConta[]
}

const B = (txt: string, destaque = false, dica = 'clique aqui'): ItemSite => ({ tipo: 'botao', txt, destaque, dica })
const C = (txt: string, destaque = false, dica = 'escreva aqui'): ItemSite => ({ tipo: 'campo', txt, destaque, dica })

export const CONTAS: Conta[] = [
  { id: 'github', nome: 'GitHub', oque: 'O GitHub é um cofre.', porque: 'É onde fica guardado o seu sistema. Ele é seu para sempre, mesmo se um dia você parar de usar o Atlas.', passos: [
    { quem: 'atlas', faca: 'Clique no botão verde. O Atlas vai abrir o site do GitHub para você.', calma: 'O site é em inglês. Não tem problema: eu traduzo cada botão.', site: { url: 'github.com', titulo: 'GitHub', itens: [B('Sign up', true, 'este aqui')] }, en: 'Sign up', pt: 'Criar conta' },
    { quem: 'voce', faca: 'Escreva o seu e-mail na caixinha. Depois clique em Continue.', calma: 'Use o mesmo e-mail que você usa no trabalho. Fica mais fácil de lembrar.', site: { url: 'github.com/signup', titulo: 'Welcome to GitHub!', itens: [C('seu e-mail', true), B('Continue')] } },
    { quem: 'voce', faca: 'Invente uma senha e escreva na caixinha. Anote num papel e guarde.', calma: 'O Atlas nunca vê a sua senha. Ela é só sua.', site: { url: 'github.com/signup', titulo: 'Create a password', itens: [C('••••••••', true, 'sua senha'), B('Continue')] }, en: 'Password', pt: 'Senha' },
    { quem: 'voce', faca: 'O GitHub mandou um número para o seu e-mail. Abra o e-mail, copie o número e cole lá.', calma: 'Não chegou? Olhe a caixa de spam. Pode levar 1 minutinho.', site: { url: 'github.com/signup', titulo: 'Enter code', itens: [C('_ _ _ _ _ _ _ _', true, 'cole aqui')] }, en: 'Enter code', pt: 'Digite o código' },
    { quem: 'atlas', faca: 'Pronto! O Atlas já viu que a sua conta está criada.', calma: 'Pode voltar aqui. Agora vem a próxima conta.', site: { url: 'github.com', titulo: 'Bem-vindo, zé-barbearia', itens: [] } },
  ] },
  { id: 'supabase', nome: 'Supabase', oque: 'O Supabase é um caderno.', porque: 'É onde o seu sistema anota tudo: o nome dos clientes, os horários marcados, os pagamentos.', passos: [
    { quem: 'atlas', faca: 'Clique no botão verde. O Atlas vai abrir o site do Supabase.', calma: 'Você não vai precisar de senha nova: vai entrar com o GitHub que acabou de criar.', site: { url: 'supabase.com', titulo: 'Supabase', itens: [B('Start your project', true, 'este aqui')] }, en: 'Start your project', pt: 'Começar o seu projeto' },
    { quem: 'voce', faca: 'Clique em Continue with GitHub.', calma: 'Assim você entra usando a conta do GitHub. Uma senha a menos para lembrar.', site: { url: 'supabase.com/dashboard/sign-in', titulo: 'Welcome back', itens: [B('Continue with GitHub', true), C('Email')] }, en: 'Continue with GitHub', pt: 'Entrar com o GitHub' },
    { quem: 'voce', faca: 'Vai aparecer uma pergunta. Clique no botão verde Authorize.', calma: 'Isso só deixa o Supabase saber quem você é. É seguro.', site: { url: 'github.com/login/oauth', titulo: 'Authorize Supabase', itens: [B('Authorize supabase', true), B('Cancel')] }, en: 'Authorize', pt: 'Deixar / Permitir' },
    { quem: 'atlas', faca: 'Pronto! O Atlas já viu que o seu caderno está criado.', calma: 'Não precisa criar nada lá dentro. O Atlas cuida do resto.', site: { url: 'supabase.com/dashboard', titulo: 'Your projects', itens: [] } },
  ] },
  { id: 'hosp', nome: 'Hospedagem', oque: 'A Vercel é a vitrine.', porque: 'É ela que deixa o seu sistema aberto na internet, com um endereço para os seus clientes acessarem.', passos: [
    { quem: 'atlas', faca: 'Clique no botão verde. O Atlas vai abrir o site da Vercel.', calma: 'É o último passo obrigatório. Falta pouco!', site: { url: 'vercel.com/signup', titulo: "Let's create your account", itens: [B('Hobby', true, 'é o grátis'), B('Pro')] }, en: 'Hobby', pt: 'Uso pessoal (grátis)' },
    { quem: 'voce', faca: 'Clique em Continue with GitHub.', calma: 'De novo com o GitHub. Viu como fica fácil?', site: { url: 'vercel.com/signup', titulo: 'Sign up', itens: [B('Continue with GitHub', true), B('Continue with Email')] }, en: 'Continue with GitHub', pt: 'Entrar com o GitHub' },
    { quem: 'voce', faca: 'Clique em Authorize, igual você fez antes.', calma: 'É a mesma pergunta de antes, agora para a Vercel.', site: { url: 'github.com/login/oauth', titulo: 'Authorize Vercel', itens: [B('Authorize Vercel', true), B('Cancel')] }, en: 'Authorize', pt: 'Deixar / Permitir' },
    { quem: 'atlas', faca: 'Pronto! As três contas estão criadas. Você conseguiu!', calma: 'Agora o Atlas tem tudo o que precisa para construir.', site: { url: 'vercel.com/dashboard', titulo: 'Welcome to Vercel', itens: [] } },
  ] },
  { id: 'pag', nome: 'Pagamentos', opcional: true, oque: 'Pagamentos online é opcional.', porque: 'Só serve se o seu sistema for cobrar dos clientes pelo celular (Pix, cartão).', passos: [
    { quem: 'atlas', faca: '', calma: '', site: { url: 'atlas-ia.app.br', titulo: 'Fica para depois', itens: [] } },
  ] },
]

export const TEXTO_OPCIONAL = {
  titulo: 'Você não precisa fazer isso agora.',
  texto: 'Se um dia o seu sistema for cobrar dos clientes, o Atlas te chama e ensina passo a passo, igual fez agora.',
  nota: 'Pagamentos fica para depois.',
}
