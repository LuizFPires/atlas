// Guias clique por clique (M58; prototipo/caminho-novo/PBGuia, PB10GuiaRegistro, PB11GuiaApple, PB12GuiaGoogle).
// Uma frase por passo, o nome do botão certo, a tradução de cada palavra técnica e o que copiar. Quando o site está aberto dentro do
// Atlas, `chega` diz em que endereço o passo já está feito: o guia anda sozinho. O Atlas nunca digita senha, código ou cartão.
// Os nomes dos botões vêm dos sites reais em nov/2026 (os sites mudam: "Falar com o Atlas" com print cobre a diferença).
import type { IdGuiaSite } from './ponte-navegador'
import type { DestinoSite } from './ponte-publicar'

export type IdGuia = 'registro' | 'apple' | 'google' | 'stripe' | 'asaas' | 'expo' | 'asc' | 'grupo' | 'duns' | 'google-primeiro' | 'google-producao' | 'chave-stripe-teste' | 'chave-stripe-real' | 'chave-asaas-teste' | 'chave-asaas-real'

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

// ---- M59: as 3 coisas a mais para o Atlas mandar o app sozinho, os testadores e o caminho da empresa ----------------------------
export function guiaExpo(): Guia {
  return {
    id: 'expo', nome: 'Expo', rotulo: 'LOJAS · CONTA GRÁTIS NA EXPO (ONDE O APP É MONTADO)', onde: 'fora', fora: 'expo-token', legenda: 'O site da Expo abre no seu navegador. Siga daqui:',
    passos: [
      { texto: 'Clique em Sign up e crie a conta com o seu e-mail (ou entre com o GitHub, que você já tem).', botao: 'Sign up', traducao: 'Sign up = criar conta. A Expo é grátis no começo e é onde o Atlas monta a versão de app na nuvem.' },
      { texto: 'Confirme o e-mail que a Expo mandou e volte para o site.', botao: 'Verify email', traducao: 'Verify = confirmar.' },
      { texto: 'Na página Access tokens, clique em Create token. No nome, escreva Atlas e clique em Create.', botao: 'Create token', traducao: 'Token é uma chave que deixa o Atlas mandar o app para a nuvem em seu nome. Dá para apagar quando quiser.' },
      { texto: 'Copie a chave que apareceu (ela só aparece uma vez) e cole aqui no Atlas, no campo "Chave da Expo".', botao: 'Copy', dica: 'A chave fica guardada só no cofre deste computador, nunca num arquivo.' },
    ],
    fimTexto: 'Pronto, colei',
    saber: 'Conta Expo (expo.dev) grátis; o token de acesso fica em Account settings → Access tokens → Create token e só aparece uma vez (se perder, crie outro). Login com GitHub funciona. O token não é a senha.',
  }
}

export function guiaChaveAsc(): Guia {
  return {
    id: 'asc', nome: 'App Store Connect', rotulo: 'LOJAS · A CHAVE DA APP STORE CONNECT', onde: 'fora', fora: 'asc-chaves', legenda: 'Depois que a Apple aprovar a sua conta. O site abre no seu navegador:',
    passos: [
      { texto: 'Entre com a sua Conta Apple. Você cai em Usuários e acesso → Integrações → App Store Connect API.', botao: 'Integrações', traducao: 'API é a porta que deixa o Atlas mandar o app para o TestFlight em seu nome.' },
      { texto: 'Se aparecer, clique em Solicitar acesso e aceite. Depois clique no + (Gerar chave de API).', botao: '+', dica: 'Só aparece para quem é o dono da conta (Account Holder).' },
      { texto: 'No nome, escreva Atlas. Em Acesso, escolha Admin. Clique em Gerar.', botao: 'Gerar', traducao: 'Admin é o acesso que deixa criar o app e mandar as versões.' },
      { texto: 'Clique em Baixar chave de API. O arquivo AuthKey_….p8 vai para a pasta Downloads.', botao: 'Baixar chave de API', dica: 'A Apple deixa baixar só UMA vez. Se perder, gere outra.' },
      { texto: 'Copie o Issuer ID (no alto da página) e cole aqui no Atlas. Depois toque em "Escolher o arquivo da chave" e escolha o AuthKey.', botao: 'Issuer ID', dica: 'A chave fica só no cofre deste computador, nunca num arquivo da obra.' },
    ],
    fimTexto: 'Pronto, guardei',
    saber: 'App Store Connect → Usuários e acesso → Integrações → App Store Connect API → chaves da equipe; precisa ser o Account Holder; acesso Admin; o .p8 só baixa uma vez; o Issuer ID fica acima da lista; o Key ID está no nome do arquivo (AuthKey_KEYID.p8). Só aparece depois que a inscrição no Apple Developer Program foi aprovada.',
  }
}

export function guiaGrupoGoogle({ appNome }: { appNome: string }): Guia {
  return {
    id: 'grupo', nome: 'Grupos do Google', rotulo: 'GOOGLE PLAY · O GRUPO DOS TESTADORES (UMA VEZ SÓ)', onde: 'fora', fora: 'google-grupos', legenda: 'O site dos Grupos do Google abre no seu navegador:',
    passos: [
      { texto: 'Clique em Criar grupo. No nome, escreva Testadores do ' + appNome.slice(0, 40) + '.', botao: 'Criar grupo', traducao: 'O grupo é a lista de quem pode testar o app antes de abrir para todos.' },
      { texto: 'Em Quem pode pesquisar o grupo, escolha Qualquer pessoa na web. Em Quem pode participar, escolha Qualquer pessoa pode participar.', botao: 'Quem pode participar', dica: 'Assim cada amigo entra sozinho pelo convite, sem você aprovar um por um.' },
      { texto: 'Clique em Criar grupo. Copie o endereço que aparece no alto (groups.google.com/g/…) e cole aqui no Atlas.', botao: 'Criar grupo', dica: 'O Atlas usa esse endereço no convite do WhatsApp.' },
      { texto: 'No Google Play Console, em Teste fechado → Testadores, escolha Grupos do Google e cole o mesmo e-mail do grupo (…@googlegroups.com).', botao: 'Testadores', traducao: 'Teste fechado = o app só aparece para quem está no grupo.' },
    ],
    fimTexto: 'Pronto, colei',
    saber: 'Teste fechado do Google Play com Grupo do Google como lista de testadores; o grupo precisa aceitar entrada livre ("Qualquer pessoa pode participar"); contas pessoais criadas depois de 13/11/2023 precisam de 12 testadores por 14 dias seguidos antes de pedir a produção. O e-mail do grupo é nome@googlegroups.com.',
  }
}

export function guiaDuns(): Guia {
  return {
    id: 'duns', nome: 'D-U-N-S', rotulo: 'APP NO NOME DA EMPRESA · O NÚMERO D-U-N-S', onde: 'fora', fora: 'apple-duns', legenda: 'A página da Apple abre no seu navegador:',
    passos: [
      { texto: 'Entre com a sua Conta Apple e preencha os dados da empresa igualzinho ao CNPJ (nome, endereço e telefone).', botao: 'Continuar', traducao: 'D-U-N-S é um número grátis que prova que a empresa existe. A Apple e o Google pedem para app em nome de empresa.' },
      { texto: 'Se a Apple achar a empresa, anote o número D-U-N-S. Se não achar, clique em Enviar para pedir um número novo.', botao: 'Enviar', dica: 'O pedido é grátis e pode levar até 30 dias. A D&B pode ligar ou mandar e-mail para confirmar.' },
      { texto: 'Quando o número chegar, escreva aqui no Atlas. Ele avisa quando der para seguir com a conta da Apple e do Google.', botao: 'D-U-N-S Number' },
    ],
    fimTexto: 'Pronto, pedi',
    saber: 'Pesquisa D-U-N-S da Apple (developer.apple.com/enroll/duns-lookup); grátis; até 30 dias; os dados precisam bater com o CNPJ. A organização também precisa de e-mail no domínio da empresa e site no ar nesse domínio para a inscrição da Apple.',
  }
}

export function guiaGooglePrimeiro({ appNome }: { appNome: string }): Guia {
  return {
    id: 'google-primeiro', nome: 'Google Play Console', rotulo: 'GOOGLE PLAY · O 1º ENVIO (REGRA DO GOOGLE, UMA VEZ SÓ)', onde: 'fora', fora: 'google-play-console', legenda: 'O Google Play Console abre no seu navegador. Siga daqui:',
    passos: [
      { texto: `Clique em Criar app. Nome: ${appNome.slice(0, 30)}. Idioma: Português (Brasil). Marque App e Gratuito, aceite as declarações e clique em Criar app.`, botao: 'Criar app' },
      { texto: 'No painel, faça as tarefas de "Configurar o app": política de privacidade, acesso, anúncios, classificação, público-alvo e segurança dos dados.', botao: 'Configurar o app', dica: 'As respostas estão prontas no arquivo apps/mobile/store/privacidade.md da obra. O endereço da política é o seu site + /privacidade.' },
      { texto: 'No menu, abra Testar e lançar → Teste → Teste fechado. Na faixa que já existe (Alpha), clique em Gerenciar faixa e depois em Criar nova versão.', botao: 'Criar nova versão', traducao: 'Faixa = uma fila de versões. Teste fechado = só quem está no grupo vê o app.' },
      { texto: 'Toque em "Baixar o arquivo do app" aqui no Atlas. Depois arraste o arquivo .aab para a área Pacotes de apps no Google.', botao: 'Enviar', dica: 'O arquivo vem pronto da Expo. É só arrastar.' },
      { texto: 'Clique em Próxima, depois em Salvar e em Iniciar lançamento para Teste fechado.', botao: 'Iniciar lançamento', traducao: 'Lançamento aqui é só para os testadores, não para o público.' },
      { texto: 'Na aba Testadores da mesma faixa, escolha Grupos do Google e cole o e-mail do grupo (…@googlegroups.com). Salve.', botao: 'Testadores' },
    ],
    fimTexto: 'Pronto, enviei',
    saber: 'Primeiro envio de app novo no Google Play é manual (o Google não aceita o 1º pela API). Teste fechado na faixa Alpha; testadores por Grupo do Google. O .aab vem do build da Expo (EAS). Erros comuns: "Você precisa fazer upload de um APK ou Android App Bundle" (arraste o .aab), "pacote já usado" (o identificador do app já existe em outra conta), tarefas de "Configurar o app" pendentes impedem o lançamento.',
  }
}

export function guiaProducaoGoogle({ appNome, pessoas }: { appNome: string; pessoas: number }): Guia {
  const app = appNome.slice(0, 30)
  return {
    id: 'google-producao', nome: 'Google Play Console', rotulo: 'GOOGLE PLAY · DIA 14: PEDIR PARA ABRIR A TODOS', onde: 'fora', fora: 'google-play-console', legenda: 'O pedido abre no seu navegador. As respostas já estão prontas para copiar:',
    passos: [
      { texto: 'No painel do app, clique em Solicitar acesso à produção.', botao: 'Solicitar acesso à produção', traducao: 'Produção = o app aberto para todo mundo na loja.' },
      { texto: 'Na pergunta sobre como foi o teste, cole a resposta pronta.', botao: 'Próxima', copiar: [{ campo: 'Sobre o teste', valor: `${pessoas} pessoas usaram o ${app} por 14 dias seguidos no teste fechado, em celulares Android diferentes. Elas usaram as funções principais do dia a dia e nos contaram o que acharam.` }] },
      { texto: 'Na pergunta sobre o que mudou depois do teste, cole a resposta pronta.', botao: 'Próxima', copiar: [{ campo: 'O que mudou', valor: `Corrigimos o que os testadores apontaram e deixamos as telas mais simples. Cada mudança passou por testes automáticos antes de ir para a nova versão do ${app}.` }] },
      { texto: 'Na pergunta sobre por que o app está pronto, cole a resposta pronta e clique em Enviar.', botao: 'Enviar', copiar: [{ campo: 'Por que está pronto', valor: `O ${app} já é usado de verdade pela equipe, funciona nos celulares testados e não teve falhas graves nos 14 dias de teste.` }], dica: 'O Google responde em até 7 dias. Aprovado, você aperta "Enviar para revisão" na faixa de produção: esse clique é seu.' },
    ],
    fimTexto: 'Pronto, pedi',
    saber: 'Contas pessoais novas: depois de 12 testadores por 14 dias seguidos, o botão "Solicitar acesso à produção" aparece no painel; o Google faz perguntas sobre o teste, o feedback e a prontidão; resposta em até 7 dias.',
  }
}

// ---- M61: a chave do gateway (teste e de verdade). Vai direto para a Vercel do cliente; o Atlas não guarda. -----------------------
export function guiaChaveGateway(gateway: 'stripe' | 'asaas', modo: 'teste' | 'real'): Guia {
  const teste = modo === 'teste'
  if (gateway === 'stripe') {
    return {
      id: teste ? 'chave-stripe-teste' : 'chave-stripe-real', nome: 'Stripe', rotulo: `STRIPE · A CHAVE ${teste ? 'DE TESTE' : 'DE VERDADE'}`, onde: 'fora', fora: teste ? 'stripe-chaves-teste' : 'stripe-chaves', legenda: 'O painel da Stripe abre no seu navegador:',
      passos: [
        { texto: `Entre na sua conta da Stripe. ${teste ? 'No alto, ligue "Ambiente de teste" (fica laranja).' : 'Confira que o "Ambiente de teste" está DESLIGADO.'}`, botao: teste ? 'Ambiente de teste' : 'Ambiente de teste (desligado)', traducao: 'No teste, nenhuma compra cobra dinheiro de verdade.' },
        { texto: 'Você está em Desenvolvedores → Chaves de API. Em Chave secreta, clique em Revelar chave.', botao: 'Revelar chave', traducao: 'Chave secreta = a senha que deixa o seu sistema cobrar na sua conta. Nunca mande para ninguém.' },
        { texto: `Copie a chave (começa com ${teste ? 'sk_test_' : 'sk_live_'}) e cole aqui no Atlas.`, botao: 'Copiar', dica: 'O Atlas põe a chave direto no servidor do SEU sistema (Vercel) e não guarda nenhuma cópia.' },
      ],
      fimTexto: 'Pronto, colei',
      saber: 'Chaves da Stripe: Desenvolvedores → Chaves de API; chave secreta sk_test_ (modo de teste) ou sk_live_ (de verdade, só depois de a conta ser ativada). Chave restrita rk_ também serve se tiver permissão de cobranças e assinaturas.',
    }
  }
  return {
    id: teste ? 'chave-asaas-teste' : 'chave-asaas-real', nome: 'Asaas', rotulo: `ASAAS · A CHAVE ${teste ? 'DE TESTE (SANDBOX)' : 'DE VERDADE'}`, onde: 'fora', fora: teste ? 'asaas-sandbox' : 'asaas-conta', legenda: teste ? 'O Asaas de testes (sandbox) abre no seu navegador:' : 'O Asaas abre no seu navegador:',
    passos: [
      { texto: teste ? 'O Asaas de testes é separado: clique em Criar conta e faça um cadastro rápido (pode ser com os mesmos dados).' : 'Entre na sua conta do Asaas.', botao: teste ? 'Criar conta' : 'Entrar', traducao: teste ? 'Sandbox = um Asaas de mentirinha, para testar sem dinheiro de verdade.' : undefined },
      { texto: 'No menu, abra Integrações (ou Minha conta → Integrações) e vá em Chave de API.', botao: 'Integrações', traducao: 'Chave de API = a senha que deixa o seu sistema cobrar na sua conta. Nunca mande para ninguém.' },
      { texto: 'Clique em Gerar chave de API, confirme e copie a chave inteira (começa com $aact_).', botao: 'Gerar chave de API', dica: 'A chave aparece só uma vez. Se perder, gere outra.' },
      { texto: 'Cole aqui no Atlas.', botao: 'Colar', dica: 'O Atlas põe a chave direto no servidor do SEU sistema (Vercel) e não guarda nenhuma cópia.' },
    ],
    fimTexto: 'Pronto, colei',
    saber: `Chave de API do Asaas: Integrações → Chave de API → Gerar; aparece uma vez; ${teste ? 'no sandbox (sandbox.asaas.com, conta separada) começa com $aact_hmlg_' : 'na conta de verdade começa com $aact_prod_ e a conta precisa estar aprovada (documentos enviados)'}.`,
  }
}

/** Passo que o endereço novo mostra como já feito: devolve o índice do próximo passo, ou o atual se nada mudou. */
export function passoPeloEndereco(guia: Guia, atual: number, url: string): number {
  for (let j = 0; j < atual; j++) if (guia.passos[j].volta?.test(url)) return j
  let prox = atual
  for (let i = atual; i < guia.passos.length - 1; i++) if (guia.passos[i].chega?.test(url)) prox = i + 1
  return prox
}
