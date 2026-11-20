// Textos da página de vendas (F00). O Luiz edita este arquivo conversando com o Claude (sem painel de edição).
import type { NomeIcone } from '../ui'

/** Endereço do vídeo "Atlas em 2 minutos" (16:9). Vazio = mostra o espaço reservado. */
export const VIDEO_URL = ''

export const PRECO = { implantacao: 'R$ 4.800', mensalidade: 'R$ 200' }

export const PRECO_PRATELEIRA = { avista: 'R$ 7.300', mensalidade: 'R$ 200' }

export type SegmentoPronto = 'barbearia' | 'restaurante' | 'mercearia' | 'academia'

/** Vitrine "Comece pronto" (M32): um app já feito por segmento de lançamento. */
export const prateleira: Array<{ segmento: SegmentoPronto; icone: NomeIcone; nome: string; txt: string }> = [
  { segmento: 'barbearia', icone: 'tesoura', nome: 'Barbearia', txt: 'Agenda online, escolha do barbeiro e caixa do dia. Seu cliente marca sozinho.' },
  { segmento: 'restaurante', icone: 'prato', nome: 'Restaurante', txt: 'Cardápio online, pedidos e cozinha conectados, sem anotar nada no papel.' },
  { segmento: 'mercearia', icone: 'caixa', nome: 'Mercearia', txt: 'Estoque, validade e aviso de reposição, com as vendas do dia na mão.' },
  { segmento: 'academia', icone: 'haltere', nome: 'Academia', txt: 'Alunos, treino do dia, check-in e mensalidades num lugar só.' },
]

export const tresPassos = ['Mostre o que você gosta.', 'Explique como você quer.', 'Escolha um nome.']

export const exemplos: Array<{ icone: NomeIcone; nome: string; txt: string }> = [
  { icone: 'tesoura', nome: 'Agenda de barbearia', txt: 'Clientes marcam horário sozinhos e você vê tudo do celular.' },
  { icone: 'obra', nome: 'Controle de obra', txt: 'Diário, medições, equipes e fotos de cada obra num lugar só.' },
  { icone: 'moeda', nome: 'Sistema financeiro', txt: 'Contas a pagar e receber, fluxo de caixa e relatórios.' },
  { icone: 'caixa', nome: 'Estoque', txt: 'Entradas, saídas, validade e aviso de reposição.' },
  { icone: 'haltere', nome: 'App de treinos', txt: 'Treino do dia, check-in e evolução de cada aluno.' },
  { icone: 'aperto', nome: 'Vendas e clientes', txt: 'Funil de vendas, propostas e histórico de cada cliente.' },
  { icone: 'prato', nome: 'Pedidos e cardápio', txt: 'Cardápio online, pedidos e cozinha conectados.' },
  { icone: 'brilho', nome: 'A sua ideia', txt: 'Qualquer processo da sua empresa que hoje vive no papel ou no WhatsApp.' },
]

export const formas: Array<{ icone: NomeIcone; txt: string }> = [
  { icone: 'celular', txt: 'No celular, como aplicativo' },
  { icone: 'computador', txt: 'No computador, pelo navegador' },
  { icone: 'pessoas', txt: 'Com login para a sua equipe e os seus clientes' },
]

export const etapas = [
  { n: '1', nome: 'Projeto', txt: 'Você escolhe o estilo, conta o que quer e vê as telas no celular antes de tudo.' },
  { n: '2', nome: 'Orçamento', txt: 'O Atlas mostra as etapas e o prazo. Nada começa sem você aprovar.' },
  { n: '3', nome: 'Obra', txt: 'A IA constrói, testa e confere sozinha. Você acompanha pelo celular.' },
  { n: '4', nome: 'Chaves', txt: 'O sistema fica no ar, com o seu nome e endereço, no celular e no computador.' },
  { n: '5', nome: 'Reforma', txt: 'Quer mudar algo? É só pedir, falando, quando quiser.' },
]

export const recebe = [
  { t: 'O Atlas instalado no seu computador.', d: 'Com ele você faz quantas obras quiser.' },
  { t: 'Curso e treinamento.', d: 'Para você usar com segurança desde o primeiro dia.' },
  { t: 'Guia de mão dada na configuração.', d: 'Passo a passo, em português simples.' },
  { t: 'O código é seu, para sempre.', d: 'Fica guardado na sua conta, no seu nome.' },
  { t: 'Sistemas para celular e computador.', d: 'Cada obra funciona como aplicativo no celular e como site no computador.' },
  { t: 'Acompanhamento de onde você estiver.', d: 'Notícias da obra no app do Claude, no celular.' },
  { t: 'Ajuda a qualquer hora.', d: 'Travou? O próprio Atlas vê o que aconteceu e te guia, passo a passo.' },
]

export const ehParaVoce = [
  'Você tem uma empresa ou uma ideia e sabe explicar como ela funciona.',
  'Hoje você controla as coisas no papel, em planilhas ou no WhatsApp.',
  'Quer um sistema do seu jeito, e não se adaptar a um sistema pronto.',
  'Topa conversar com o Atlas, aprovar as etapas e testar o resultado.',
  'Quer que o sistema seja seu, sem mensalidade por usuário.',
]

export const naoEhParaVoce = [
  'Você quer que alguém faça tudo sem você participar.',
  'Precisa de um sistema pronto amanhã, sem tempo para o projeto.',
  'Não tem um computador com Windows para deixar ligado durante a obra.',
  'Procura um site institucional simples, só de vitrine.',
  'Não quer assinar o Claude, que é a força de trabalho da obra.',
]

export const duvidas = [
  { p: 'Preciso saber programar?', r: 'Não. Você conversa, aprova e acompanha. Quem escreve o código é a IA.' },
  { p: 'Quanto tempo leva uma obra?', r: 'Um sistema simples costuma ficar pronto em poucos dias. O Atlas mostra a previsão antes de começar.' },
  { p: 'O computador precisa ficar ligado?', r: 'Sim, durante a obra. Ele é o canteiro. Você acompanha tudo pelo celular.' },
  { p: 'O sistema é meu?', r: 'Sim. O código fica na sua conta e continua seu mesmo se um dia você parar de usar o Atlas.' },
  { p: 'E se eu quiser mudar algo depois?', r: 'Você pede com as suas palavras. O Atlas mostra o que vai mudar e só publica quando você aprovar.' },
  { p: 'Funciona no meu computador?', r: 'Funciona em computadores com Windows 10 ou 11 e internet. O instalador confere tudo para você.' },
]
