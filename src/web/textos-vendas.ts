// Textos da página de vendas nos dois idiomas (M31, Luiz em 26/11/2026; protótipos F00Vendas e F00VendasEN).
// O português continua morando em conteudo.ts (o Luiz edita lá); o inglês mora aqui, com o MESMO formato: o TypeScript
// acusa qualquer texto que faltar em inglês.
import type { NomeIcone } from '../ui'
import type { Dicionario } from '../i18n/idioma'
import * as PT from './conteudo'

export type TextosVendas = {
  nav: { pronto: string; como: string; recebe: string; preco: string; duvidas: string; secoes: string }
  queroOMeu: string
  selo: string
  titulo: string
  apoio: string
  videoTitulo: string
  assista: string
  videoReservado: string
  construir: string
  verExemplos: string
  plataformas: { rotulo: string; extra: string }
  tres: { titulo: string; destaque: string; apoio: string; passo: (n: number) => string; ia: string; iaTitulo: string; iaApoio: string }
  tresPassos: Array<{ nome: string; icone: NomeIcone; apoio: string }>
  exemplosCab: { mono: string; titulo: string; texto: string }
  exemplos: Array<{ icone: NomeIcone; nome: string; txt: string }>
  formas: Array<{ icone: NomeIcone; txt: string }>
  sobe: { mono: string; titulo: string; texto: string }
  pronto: { mono: string; titulo: string; texto: string; mes: string; comecar: string; aria: (nome: string) => string; avisoNegrito: string; aviso: string }
  prateleira: Array<{ segmento: PT.SegmentoPronto; icone: NomeIcone; nome: string; txt: string }>
  precoPronto: { avista: string; mensalidade: string }
  como: { mono: string; titulo: string; texto: string }
  etapas: Array<{ n: string; nome: string; txt: string }>
  fala: { mono: string; titulo: string; texto: string; ouvindo: string; citacao: string; entendeu: string }
  recebeCab: { mono: string; titulo: string }
  recebe: Array<{ t: string; d: string }>
  preco: { mono: string; implantacao: string; formas: string; mensal: string; mes: string; inclui: string; valorImplantacao: string; valorMensal: string }
  avisoClaude: { titulo: string; texto: string; aria: string }
  quem: { mono: string; titulo: string; sim: string; nao: string }
  ehParaVoce: string[]
  naoEhParaVoce: string[]
  duvidasCab: { mono: string; titulo: string }
  duvidas: Array<{ p: string; r: string }>
  depoimentos: string
  final: { titulo: string; apoio: string }
  rodape: { empresa: string; contato: string }
}

const pt: TextosVendas = {
  nav: { pronto: 'Comece pronto', como: 'Como funciona', recebe: 'O que você recebe', preco: 'Preço', duvidas: 'Dúvidas', secoes: 'Seções' },
  queroOMeu: 'Quero o meu',
  selo: 'APLICATIVOS, SISTEMAS E SITES, FEITOS PELA IA',
  titulo: 'O sistema que a sua empresa precisa, do seu jeito. Sem saber programar.',
  apoio: 'Você conta o que precisa, como se falasse com um amigo. O Atlas desenha, constrói e entrega pronto: aplicativo, sistema ou site, para usar no celular e no computador.',
  videoTitulo: 'O Atlas em 2 minutos',
  assista: 'Assista: o Atlas em 2 minutos',
  videoReservado: '[ espaço do seu vídeo · 16:9 ]',
  construir: 'Quero construir o meu',
  verExemplos: 'Ver o que dá para construir',
  plataformas: { rotulo: 'Funciona em', extra: 'Em português e em inglês' },
  tres: { titulo: 'Você faz 3 passos.', destaque: 'A IA faz o resto.', apoio: 'É só isso. Depois, pode ir dormir.', passo: (n) => `Passo ${n}`, ia: 'Depois · a IA', iaTitulo: 'Constrói sozinha, dia e noite. Inclusive enquanto você dorme.', iaApoio: 'Você acorda com notícias da obra no celular.' },
  tresPassos: PT.tresPassos,
  exemplosCab: { mono: 'O que dá para construir', titulo: 'Se dá para explicar, dá para construir.', texto: 'Um sistema financeiro, um app de controle de obra, a agenda da barbearia. Cada obra vira um sistema seu, com o seu nome, que funciona no celular e no computador.' },
  exemplos: PT.exemplos,
  formas: PT.formas,
  sobe: { mono: 'Você vê a obra subir', titulo: 'Enquanto a IA trabalha, o seu sistema sobe andar por andar.', texto: 'Cada etapa pronta vira um andar do prédio. Você acompanha de onde estiver e recebe notícias da obra no celular.' },
  pronto: { mono: 'Comece pronto', titulo: 'Quer sair usando hoje? Escolha um app que já está feito.', texto: 'Se o seu negócio é um destes, você não espera construir: o app já vem pronto, com o seu nome, e você ajusta o que quiser depois, só conversando.', mes: '/mês', comecar: 'Começar pronto', aria: (nome) => `Começar pronto: ${nome}`, avisoNegrito: 'Uma coisa justa de dizer:', aviso: 'cada app pronto é de uma empresa só, a sua. Ele não é dividido com outros negócios e não serve para vários clientes ao mesmo tempo. Dividir o acesso é dividir os mesmos dados (clientes, vendas, agenda) com quem usar junto.' },
  prateleira: PT.prateleira,
  precoPronto: PT.PRECO_PRATELEIRA,
  como: { mono: 'Como funciona', titulo: 'Fazer um sistema é igual construir uma casa.', texto: 'Por isso no Atlas cada sistema é uma obra. Você decide, a IA constrói.' },
  etapas: PT.etapas,
  fala: { mono: 'Você não precisa digitar', titulo: 'Fale como se estivesse com um amigo na mesa de um restaurante.', texto: 'Tudo no Atlas pode ser falado: o que você quer, o que mudar, o que não ficou bom. Ele entende, escreve e mostra para você conferir.', ouvindo: 'Ouvindo… 0:18', citacao: 'Olha, hoje o pessoal marca pelo WhatsApp e vira uma bagunça. Queria que o cliente escolhesse o barbeiro e o horário sozinho, e que eu visse tudo no meu celular.', entendeu: 'O Atlas entendeu: agenda online com escolha de barbeiro e painel do dono.' },
  recebeCab: { mono: 'O que você recebe', titulo: 'Tudo o que precisa para construir quantos sistemas quiser.' },
  recebe: PT.recebe,
  preco: { mono: 'Preço', implantacao: 'Implantação, uma vez só', formas: 'em Pix ou parcelado no cartão', mensal: 'Manutenção mensal', mes: '/mês', inclui: 'Inclui as atualizações do Atlas e o portal da sua conta.', valorImplantacao: PT.PRECO.implantacao, valorMensal: PT.PRECO.mensalidade },
  avisoClaude: { titulo: PT.AVISO_CLAUDE.titulo, texto: PT.AVISO_CLAUDE.texto, aria: 'Assinatura do Claude' },
  quem: { mono: 'Para quem é', titulo: 'Sejamos sinceros: o Atlas não é para todo mundo.', sim: 'É para você se…', nao: 'Não é para você se…' },
  ehParaVoce: PT.ehParaVoce,
  naoEhParaVoce: PT.naoEhParaVoce,
  duvidasCab: { mono: 'Dúvidas', titulo: 'Perguntas de quem nunca programou' },
  duvidas: PT.duvidas,
  depoimentos: '[Espaço para depoimentos reais dos primeiros clientes, com nome, empresa e foto autorizados]',
  final: { titulo: 'A sua ideia merece sair do papel.', apoio: 'Comece hoje. A primeira obra começa no mesmo dia.' },
  rodape: { empresa: 'Atlas · PL Participações LTDA · CNPJ 30.484.256/0001-82', contato: 'Contato' },
}

const en: TextosVendas = {
  nav: { pronto: 'Start ready-made', como: 'How it works', recebe: 'What you get', preco: 'Pricing', duvidas: 'FAQ', secoes: 'Sections' },
  queroOMeu: 'Get started',
  selo: 'APPS, SYSTEMS AND WEBSITES, BUILT BY AI',
  titulo: 'The software your business needs, your way. No coding required.',
  apoio: 'Just tell it what you need, like you would tell a friend. Atlas designs it, builds it and hands it over ready to use: an app, a system or a website, on your phone and on your computer.',
  videoTitulo: 'Atlas in 2 minutes',
  assista: 'Watch: Atlas in 2 minutes',
  videoReservado: '[ your video goes here · 16:9 ]',
  construir: 'Build mine',
  verExemplos: 'See what you can build',
  plataformas: { rotulo: 'Works on', extra: 'In English and Portuguese' },
  tres: { titulo: 'You do 3 steps.', destaque: 'AI does the rest.', apoio: 'That’s it. Then you can go to bed.', passo: (n) => `Step ${n}`, ia: 'Then · the AI', iaTitulo: 'It builds on its own, day and night. Even while you sleep.', iaApoio: 'You wake up to progress updates on your phone.' },
  tresPassos: [
    { nome: 'Tell us your idea.', icone: 'microfone', apoio: 'Out loud, your way, with a simple checklist on the side. The screens start appearing right away.' },
    { nome: 'Show what you like.', icone: 'imagem', apoio: 'Photos, screenshots, an app you love.' },
    { nome: 'Pick a name.', icone: 'brilho', apoio: 'A name for your app. That’s it.' },
  ],
  exemplosCab: { mono: 'What you can build', titulo: 'If you can explain it, you can build it.', texto: 'A finance system, a job-site tracker, the booking app for a barber shop. Every project becomes your own software, with your name on it, working on phones and computers.' },
  exemplos: [
    { icone: 'tesoura', nome: 'Barber shop booking', txt: 'Customers book on their own and you see it all on your phone.' },
    { icone: 'obra', nome: 'Job-site tracker', txt: 'Daily logs, progress, crews and photos of every job in one place.' },
    { icone: 'moeda', nome: 'Finance system', txt: 'Bills, invoices, cash flow and reports.' },
    { icone: 'caixa', nome: 'Inventory', txt: 'Stock in and out, expiration dates and reorder alerts.' },
    { icone: 'haltere', nome: 'Workout app', txt: 'Today’s workout, check-ins and every member’s progress.' },
    { icone: 'aperto', nome: 'Sales and customers', txt: 'Sales pipeline, quotes and every customer’s history.' },
    { icone: 'prato', nome: 'Orders and menu', txt: 'Online menu, orders and kitchen, all connected.' },
    { icone: 'brilho', nome: 'Your idea', txt: 'Anything in your business that lives on paper or in text messages today.' },
  ],
  formas: [
    { icone: 'celular', txt: 'On the phone, as an app' },
    { icone: 'computador', txt: 'On the computer, in the browser' },
    { icone: 'pessoas', txt: 'With logins for your team and your customers' },
  ],
  sobe: { mono: 'Watch it go up', titulo: 'While the AI works, your software goes up floor by floor.', texto: 'Every finished stage is a new floor of the building. Follow along from anywhere and get updates on your phone.' },
  pronto: { mono: 'Start ready-made', titulo: 'Want to start using it today? Pick an app that’s already built.', texto: 'If your business is one of these, you don’t wait for a build: the app comes ready, with your name on it, and you can adjust anything later just by talking.', mes: '/month', comecar: 'Start ready-made', aria: (nome) => `Start ready-made: ${nome}`, avisoNegrito: 'To be fair:', aviso: 'each ready-made app belongs to one business only, yours. It isn’t shared with other businesses and can’t serve several companies at once. Sharing access means sharing the same data (customers, sales, bookings) with whoever uses it.' },
  prateleira: [
    { segmento: 'barbearia', icone: 'tesoura', nome: 'Barber shop', txt: 'Online booking, barber choice and the day’s register. Customers book on their own.' },
    { segmento: 'restaurante', icone: 'prato', nome: 'Restaurant', txt: 'Online menu, orders and kitchen connected, nothing written on paper.' },
    { segmento: 'mercearia', icone: 'caixa', nome: 'Corner store', txt: 'Stock, expiration dates and reorder alerts, with the day’s sales at hand.' },
    { segmento: 'academia', icone: 'haltere', nome: 'Gym', txt: 'Members, today’s workout, check-in and monthly fees in one place.' },
  ],
  precoPronto: { avista: '$2,400', mensalidade: '$70' },
  como: { mono: 'How it works', titulo: 'Building software is like building a house.', texto: 'That’s why in Atlas every system is a project. You decide, the AI builds.' },
  etapas: [
    { n: '1', nome: 'Design', txt: 'You share the idea, pick the look and the name, and see the screens on your phone before anything else.' },
    { n: '2', nome: 'Plan', txt: 'Atlas shows you the stages and the timeline. Nothing starts until you approve.' },
    { n: '3', nome: 'Build', txt: 'The AI builds, tests and double-checks on its own. You follow along on your phone.' },
    { n: '4', nome: 'Keys', txt: 'Your software goes live, with your name and web address, on phones and computers.' },
    { n: '5', nome: 'Remodel', txt: 'Want to change something? Just ask, out loud, whenever you want.' },
  ],
  fala: { mono: 'No typing needed', titulo: 'Talk like you’re chatting with a friend over dinner.', texto: 'Everything in Atlas can be spoken: what you want, what to change, what you don’t like. It understands, writes it down and shows you to check.', ouvindo: 'Listening… 0:18', citacao: 'Right now people book by text and it’s a mess. I want customers to pick the barber and the time on their own, and I want to see everything on my phone.', entendeu: 'Atlas got it: online booking with barber choice and an owner dashboard.' },
  recebeCab: { mono: 'What you get', titulo: 'Everything you need to build as many systems as you want.' },
  recebe: [
    { t: 'Atlas installed on your computer.', d: 'Build as many projects as you want.' },
    { t: 'Course and training.', d: 'So you feel confident from day one.' },
    { t: 'Hand-holding setup guide.', d: 'Step by step, in plain English.' },
    { t: 'The code is yours, forever.', d: 'It lives in your own account, under your name.' },
    { t: 'Software for phones and computers.', d: 'Every project works as a phone app and as a website on the computer.' },
    { t: 'Follow along from anywhere.', d: 'Project updates in the Claude app on your phone.' },
    { t: 'Help, any time.', d: 'Stuck? Atlas sees what happened and walks you through it, step by step.' },
  ],
  preco: { mono: 'Pricing', implantacao: 'Setup, one time', formas: 'by credit card', mensal: 'Monthly plan', mes: '/month', inclui: 'Includes Atlas updates and your account portal.', valorImplantacao: '$1,700', valorMensal: '$70' },
  avisoClaude: { titulo: 'Atlas only works with a Claude subscription', texto: 'Claude is the crew that builds your software. Its subscription is paid directly to Anthropic, separate from Atlas. The bigger the plan, the faster the project moves.', aria: 'Claude subscription' },
  quem: { mono: 'Who it’s for', titulo: 'Let’s be honest: Atlas isn’t for everyone.', sim: 'It’s for you if…', nao: 'It’s not for you if…' },
  ehParaVoce: [
    'You have a business or an idea and you can explain how it works.',
    'Today you keep track of things on paper, in spreadsheets or in text messages.',
    'You want software that works your way, not to bend to off-the-shelf software.',
    'You’re up for talking with Atlas, approving the stages and testing the result.',
    'You want to own your software, with no per-user fees.',
  ],
  naoEhParaVoce: [
    'You want someone to do everything without you taking part.',
    'You need software ready tomorrow, with no time for the design step.',
    'You don’t have a Windows PC or a Mac that can stay on during the build.',
    'You’re looking for a simple brochure website.',
    'You don’t want a Claude subscription, which is the crew that does the work.',
  ],
  duvidasCab: { mono: 'Questions', titulo: 'Questions from people who have never coded' },
  duvidas: [
    { p: 'Do I need to know how to code?', r: 'No. You talk, approve and follow along. The AI writes the code.' },
    { p: 'How long does a project take?', r: 'Simple software is usually ready in a few days. Atlas shows you the estimate before it starts.' },
    { p: 'Does my computer need to stay on?', r: 'Yes, during the build. It’s the job site. You follow everything from your phone.' },
    { p: 'Do I own the software?', r: 'Yes. The code lives in your account and stays yours even if you stop using Atlas one day.' },
    { p: 'When does my software go live?', r: 'You build and preview everything from day one. Publishing with your own address and to the app stores unlocks on day 8 after purchase, once the 7-day refund window ends.' },
    { p: 'What if I want to change something later?', r: 'Just ask in your own words. Atlas shows what will change and only publishes when you approve.' },
    { p: 'Will it run on my computer?', r: 'It runs on Windows 10 or 11 and on Mac, with an internet connection. The installer checks everything for you.' },
  ],
  depoimentos: '[Space for real testimonials from the first customers, with approved name, company and photo]',
  final: { titulo: 'Your idea deserves to get off the napkin.', apoio: 'Start today. Your first project starts the same day.' },
  rodape: { empresa: 'Atlas · PL Participações LTDA', contato: 'Contact' },
}

export const TEXTOS_VENDAS: Dicionario<TextosVendas> = { pt, en }
