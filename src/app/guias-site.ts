// Guias clique por clique (M58; prototipo/caminho-novo/PBGuia, PB10GuiaRegistro, PB11GuiaApple, PB12GuiaGoogle).
// Uma frase por passo, o nome do botão certo, a tradução de cada palavra técnica e o que copiar. Quando o site está aberto dentro do
// Atlas, `chega` diz em que endereço o passo já está feito: o guia anda sozinho. O Atlas nunca digita senha, código ou cartão.
// Os nomes dos botões vêm dos sites reais em nov/2026 (os sites mudam: "Falar com o Atlas" com print cobre a diferença).
import type { IdGuiaSite } from './ponte-navegador'
import type { DestinoSite } from './ponte-publicar'

export type IdGuia = 'registro' | 'apple' | 'google' | 'stripe' | 'asaas'

export interface PassoGuia {
  texto: string
  /** O nome do botão ou campo certo, como aparece no site (vai também para a Ajuda). */
  botao?: string
  traducao?: string
  dica?: string
  copiar?: { campo: string; valor: string }[]
  /** Endereço do site que mostra que ESTE passo já foi feito (o guia passa ao próximo sozinho). */
  chega?: RegExp
  /** O site voltou para este endereço (ex.: pediu login de novo): o guia volta para este passo. */
  volta?: RegExp
}

export interface Guia {
  id: IdGuia
  /** Nome curto do site (vai para a Ajuda: "o passo a passo do Registro.br"). */
  nome: string
  rotulo: string
  /** Onde a pessoa faz: no site aberto dentro do Atlas, no navegador do computador (o Google bloqueia login dentro de apps) ou no iPhone. */
  onde: 'site' | 'fora' | 'iphone'
  site?: IdGuiaSite
  fora?: DestinoSite
  legenda: string
  passos: PassoGuia[]
  fimTexto: string
  /** Problemas comuns deste site, para a Ajuda responder certo de primeira (DADO para o Claude). */
  saber: string
}

/** App Apple Developer na App Store (é o caminho da Apple para se inscrever pelo iPhone). */
export const APP_APPLE_DEVELOPER = 'https://apps.apple.com/br/app/apple-developer/id640199958'

export function guiaRegistro({ dominio, servidores = [], registros = [] }: { dominio: string; servidores?: string[]; registros?: { tipo: 'A' | 'CNAME'; nome: string; valor: string }[] }): Guia {
  const comEmail = servidores.length === 0 && registros.length > 0
  const dom = dominio.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const inicio: PassoGuia[] = [
    { texto: 'O site do Registro.br abriu ao lado. Se aparecer o botão Entrar, clique nele.', botao: 'Entrar', dica: 'Use o mesmo acesso de quando você comprou o domínio.', chega: /registro\.br\/(login|.*\/login)/ },
    { texto: 'Digite o seu usuário (o CPF, o CNPJ ou o e-mail) e a sua senha do Registro.br. Depois clique em Avançar.', botao: 'Avançar', volta: /registro\.br\/(login|.*\/login)/, dica: 'Quem digita é você: o Atlas não vê nem guarda a sua senha. Esqueceu? Clique em "Esqueci minha senha", troque pelo e-mail e volte aqui.', chega: /registro\.br\/painel/ },
    { texto: 'Clique no quadradinho "Não sou um robô". Se pedir, escolha as fotos que ele mandar.', botao: 'Não sou um robô', traducao: 'É só para o site saber que é uma pessoa de verdade.', chega: /registro\.br\/painel/ },
    { texto: `Apareceu a lista dos seus domínios. Clique em ${dominio}.`, botao: dominio, chega: new RegExp(dom) },
  ]
  const fim: PassoGuia[] = comEmail
    ? [
      { texto: 'Desça a página até a parte DNS e clique em Configurar zona DNS (ou Editar zona).', botao: 'Configurar zona DNS', traducao: 'Zona DNS é a lista que diz para a internet onde mora cada parte do seu domínio: o site, o e-mail…', dica: 'O seu e-mail continua igual: você só vai acrescentar linhas, sem apagar nenhuma.', chega: /zona|dns/i },
      ...registros.map((r): PassoGuia => ({
        texto: `Clique em Nova entrada. Em Tipo escolha ${r.tipo}; em Nome ${r.nome === '@' ? 'deixe em branco' : `escreva ${r.nome}`}; em Dados cole o valor de Copiar.`,
        botao: 'Nova entrada', copiar: [{ campo: r.tipo === 'A' ? 'Dados (endereço)' : 'Dados (nome)', valor: r.valor }],
        traducao: 'Para colar: clique dentro do campo e aperte Ctrl e V juntos (no Mac, Command e V).',
        dica: r.tipo === 'A' ? 'Se já existir uma linha do tipo A com o nome em branco, troque o valor dela em vez de criar outra.' : 'Se já existir uma linha www, troque o valor dela em vez de criar outra.',
      })),
      { texto: 'Por último, clique em Salvar alterações. A sua parte acabou!', botao: 'Salvar alterações', dica: 'Depois o Atlas espera a internet atualizar (de 10 minutos a algumas horas) e avisa no celular.' },
    ]
    : [
      { texto: 'Desça a página até a parte DNS e clique em Alterar servidores DNS.', botao: 'Alterar servidores DNS', traducao: 'Servidores DNS são como o endereço do correio: dizem para a internet onde o seu sistema mora.', chega: /dns/i },
      { texto: `Aperte Copiar 1 aqui no Atlas e cole no campo Servidor 1. Depois Copiar 2 no Servidor 2.`, botao: 'Servidor 1', copiar: servidores.map((s, i) => ({ campo: `Servidor ${i + 1}`, valor: s })), traducao: 'Para colar: clique dentro do campo e aperte Ctrl e V juntos (no Mac, Command e V).', dica: 'Se já tiver outros nomes nesses campos, apague e cole os novos. Sobrou um Servidor 3? Deixe em branco.' },
      { texto: 'Por último, clique em Salvar alterações. A sua parte acabou!', botao: 'Salvar alterações', dica: 'Depois o Atlas espera a internet atualizar (de 10 minutos a algumas horas) e avisa no celular.' },
    ]
  return {
    id: 'registro', nome: 'Registro.br', rotulo: 'USAR MEU DOMÍNIO NO REGISTRO.BR', onde: 'site', site: 'registro', legenda: 'O site do Registro.br, aberto dentro do Atlas:',
    passos: [...inicio, ...fim], fimTexto: 'Pronto, salvei',
    saber: `Domínio ${dominio}, já ligado na Vercel pelo Atlas. ${comEmail ? `Tem e-mail: NÃO trocar os servidores; só acrescentar ${registros.map((r) => `${r.tipo} ${r.nome} ${r.valor}`).join(' e ')} na zona DNS.` : `Servidores: ${servidores.join(' e ')}.`} "Pesquisa recusada" ao salvar: o Registro.br testa os servidores na hora; logo depois de ligar na Vercel pode demorar alguns minutos — espere 5 minutos e salve de novo. "Servidor DNS não responde": confira se colou sem espaço no fim. Se o domínio estiver com o provedor de outra empresa (Locaweb, HostGator…), a troca é feita lá, no painel dela, ou escolhendo o provedor "Nenhum" no Registro.br.`,
  }
}

export function guiaApple(): Guia {
  return {
    id: 'apple', nome: 'Apple (App Store)', rotulo: 'APP STORE · CRIAR A SUA CONTA DA APPLE', onde: 'iphone', fora: 'apple-inscricao', legenda: 'Isto acontece no seu iPhone. Aponte a câmera para o QR:',
    passos: [
      { texto: 'No seu iPhone, aponte a câmera para o QR ao lado. Ele abre o app Apple Developer na App Store. Toque em Obter.', botao: 'Obter', dica: 'O app é grátis e é da própria Apple.' },
      { texto: 'Abra o app e toque em Conta, embaixo à direita. Entre com a sua Conta Apple (a mesma do iCloud).', botao: 'Conta', traducao: 'A Apple pede um código no seu iPhone para confirmar que é você. Digite o código que aparecer.' },
      { texto: 'Toque em Inscrever-se agora.', botao: 'Inscrever-se agora', traducao: 'Inscrever-se = entrar no programa da Apple que deixa publicar apps.' },
      { texto: 'Confira o seu nome completo, igualzinho ao do documento. Sem apelido e sem nome da empresa.', botao: 'Continuar', dica: 'Nome diferente do documento é o motivo nº 1 de a Apple atrasar a aprovação. Se for MEI, use o seu nome e o seu CPF: é o caminho certo para MEI.' },
      { texto: 'Leia e aceite o contrato da Apple: toque em Aceitar.', botao: 'Aceitar', traducao: 'Resumo: você promete seguir as regras da App Store, e a Apple cobra a anuidade.' },
      { texto: 'Toque em Comprar. A anuidade aparece em reais e é paga com o cartão da sua Conta Apple.', botao: 'Comprar', dica: 'É cobrada todo ano e renova sozinha. O Atlas não vê o cartão. A Apple confirma por e-mail, normalmente em até 2 dias.' },
    ],
    fimTexto: 'Pronto, paguei',
    saber: 'Inscrição no Apple Developer Program pelo app Apple Developer no iPhone (pessoa física/MEI usa nome e CPF). Organização precisa de D-U-N-S, e-mail do domínio e site. "Não foi possível concluir a inscrição": nome diferente do documento, ou Conta Apple sem autenticação de dois fatores (ligar em Ajustes → seu nome → Iniciar Sessão e Segurança). A aprovação chega por e-mail, normalmente em até 48 h.',
  }
}

export function guiaGoogle({ nomeDev = '' }: { nomeDev?: string } = {}): Guia {
  return {
    id: 'google', nome: 'Google Play', rotulo: 'GOOGLE PLAY · CRIAR A SUA CONTA DO GOOGLE', onde: 'fora', fora: 'google-console', legenda: 'O Google não deixa entrar na conta dentro de outros apps, então o site abre no seu navegador. Siga daqui:',
    passos: [
      { texto: 'Entre com a sua conta Google (a do Gmail). Se já estiver entrado, clique em Continuar.', botao: 'Continuar', dica: 'Use uma conta que você vai manter para sempre: o app fica preso a ela.' },
      { texto: 'O Google pergunta para quem é a conta. Clique em Você (conta pessoal).', botao: 'Você', traducao: 'Empresa com D-U-N-S escolhe "Uma organização ou empresa".' },
      { texto: 'No campo Nome do desenvolvedor, escreva o nome que vai aparecer na loja embaixo do app.', botao: 'Nome do desenvolvedor', ...(nomeDev ? { copiar: [{ campo: 'Sugestão do Atlas', valor: nomeDev }] } : {}) },
      { texto: 'O Google manda um código para o seu e-mail e outro para o seu celular. Digite cada um no campo que pedir.', botao: 'Verificar', traducao: 'É só para confirmar que o e-mail e o celular são seus.' },
      { texto: 'Clique em Pagar: são US$ 25, uma vez só, no seu cartão.', botao: 'Pagar', dica: 'O Atlas não vê o cartão. O valor aparece convertido para reais na fatura.' },
      { texto: 'Por último, mande uma foto do seu RG ou CNH quando o Google pedir.', botao: 'Enviar documento', dica: 'O Google confere em alguns dias. Enquanto isso, o Atlas já prepara o app e os testadores.' },
    ],
    fimTexto: 'Pronto, terminei',
    saber: 'Conta de desenvolvedor do Google Play (US$ 25, uma vez). Contas pessoais criadas depois de 13/11/2023 precisam de 12 testadores por 14 dias seguidos antes de publicar. Organização precisa de D-U-N-S (pode levar até 30 dias). A verificação de identidade pede documento com foto e pode levar alguns dias. "Esta conta não pode ser usada": usar outra conta Google pessoal.',
  }
}

export function guiaStripe(): Guia {
  return {
    id: 'stripe', nome: 'Stripe', rotulo: 'RECEBER PELO STRIPE · CRIAR A SUA CONTA', onde: 'site', site: 'stripe', legenda: 'O site da Stripe, aberto dentro do Atlas:',
    passos: [
      { texto: 'Escreva o seu e-mail, o seu nome completo e crie uma senha. Em País, deixe Brasil. Clique em Criar conta.', botao: 'Criar conta', dica: 'Quem digita é você: o Atlas não vê nem guarda a sua senha.', chega: /dashboard\.stripe\.com\/(?!register)/ },
      { texto: 'A Stripe mandou um e-mail. Abra o seu e-mail e clique em Verificar endereço de e-mail.', botao: 'Verificar endereço de e-mail', traducao: 'Verificar = confirmar que o e-mail é seu.' },
      { texto: 'De volta à Stripe, clique em Ativar pagamentos (ou Concluir perfil).', botao: 'Ativar pagamentos', traducao: 'Ativar pagamentos = liberar a conta para receber dinheiro de verdade.', chega: /account\/onboarding|setup|activate/i },
      { texto: 'Escolha o tipo de empresa e preencha os dados: CNPJ (ou CPF), endereço e telefone.', botao: 'Tipo de empresa', dica: 'MEI escolhe "Empresa individual". Os dados precisam ser iguais aos da Receita.' },
      { texto: 'Informe a conta bancária onde o dinheiro vai cair (banco, agência e conta).', botao: 'Conta bancária', dica: 'O Atlas não vê esses dados: vão direto para a Stripe.' },
      { texto: 'Revise tudo e clique em Concordar e enviar.', botao: 'Concordar e enviar', dica: 'A Stripe confere em minutos ou em poucos dias. O Atlas fica de olho e continua sozinho.' },
    ],
    fimTexto: 'Pronto, enviei',
    saber: 'Conta Stripe no Brasil: cartão e Pix só de uma vez (sem Pix Automático e sem parcelamento). MEI = Empresa individual. "Não foi possível verificar": dados diferentes da Receita (nome, CNPJ, endereço). Conta bancária precisa ser do mesmo titular (CPF/CNPJ).',
  }
}

export function guiaAsaas(): Guia {
  return {
    id: 'asaas', nome: 'Asaas', rotulo: 'RECEBER PELO ASAAS · CRIAR A SUA CONTA', onde: 'site', site: 'asaas', legenda: 'O site do Asaas, aberto dentro do Atlas:',
    passos: [
      { texto: 'Escolha como você trabalha: Pessoa Física (sem CNPJ) ou Pessoa Jurídica (MEI, LTDA…).', botao: 'Pessoa Jurídica', dica: 'Tem CNPJ? Escolha Pessoa Jurídica: dá mais recursos e é o caminho certo para empresa.' },
      { texto: 'Preencha os dados principais: CPF ou CNPJ, nome, e-mail e um celular pessoal.', botao: 'Dados principais', dica: 'Use um celular que esteja sempre com você: o código de ativação chega nele.' },
      { texto: 'Conte o que o seu negócio faz: Ofereço serviços ou Vendo produtos, e escolha o mais parecido.', botao: 'Dados do seu negócio' },
      { texto: 'Crie a sua senha de acesso ao Asaas e continue.', botao: 'Criar conta', dica: 'Quem digita é você: o Atlas não vê nem guarda a sua senha.' },
      { texto: 'Digite o código que chegou no seu celular.', botao: 'Código de verificação', traducao: 'É só para confirmar que o celular é seu.' },
      { texto: 'Envie os documentos que o Asaas pedir (foto do documento e uma selfie).', botao: 'Enviar documentos', dica: 'O Asaas confere em até alguns dias úteis. Enquanto isso, o Atlas segue preparando o resto.' },
    ],
    fimTexto: 'Pronto, enviei',
    saber: 'Conta Asaas: Pix (inclusive Pix Automático), boleto e cartão com parcelamento. Para movimentar o saldo precisa ativar a conta e enviar documentos. Pessoa Jurídica precisa do CNPJ; MEI entra como Pessoa Jurídica. Código não chegou: conferir o celular informado e pedir de novo.',
  }
}

/** Passo que o endereço novo mostra como já feito: devolve o índice do próximo passo, ou o atual se nada mudou. */
export function passoPeloEndereco(guia: Guia, atual: number, url: string): number {
  for (let j = 0; j < atual; j++) if (guia.passos[j].volta?.test(url)) return j
  let prox = atual
  for (let i = atual; i < guia.passos.length - 1; i++) if (guia.passos[i].chega?.test(url)) prox = i + 1
  return prox
}
