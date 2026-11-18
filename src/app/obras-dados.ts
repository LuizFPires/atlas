// Textos de F05Obras e F06NovaObra (prototipo/F05Obras.dc.html e F06NovaObra.dc.html).

export const ETAPAS_CASA = [
  { n: '1', nome: 'Projeto', casa: 'O arquiteto desenha a planta antes de levantar uma parede.', atlas: 'Você escolhe o estilo, o Claude desenha as telas com você e, no fim, vocês dão o nome.' },
  { n: '2', nome: 'Orçamento', casa: 'Você vê as etapas e o prazo, e só então aprova.', atlas: 'O Atlas mostra as etapas e quanto tempo leva. Você aprova.' },
  { n: '3', nome: 'Obra', casa: 'A equipe trabalha e o prédio vai subindo, andar por andar.', atlas: 'O Claude constrói sozinho. Você vê o prédio subir na tela.' },
  { n: '4', nome: 'Chaves', casa: 'A casa fica pronta e você recebe as chaves.', atlas: 'Você recebe o endereço do seu sistema, pronto para usar no celular.' },
  { n: '5', nome: 'Reforma', casa: 'Quer mudar algo depois? Chama para uma reforma.', atlas: 'Pede uma mudança com as suas palavras, quando quiser.' },
] as const

export const IDEIAS = [
  { nome: 'Agenda online', desc: 'Clientes marcam horário pelo celular' },
  { nome: 'Fidelidade', desc: 'Cartão de pontos e cortes grátis' },
  { nome: 'Caixa do dia', desc: 'Entradas, saídas e comissão dos barbeiros' },
  { nome: 'Estoque', desc: 'Produtos, validade e reposição' },
] as const

export const QUEM_USA = [
  { id: 'dono', nome: 'Eu, o dono' },
  { id: 'barbeiros', nome: 'Os barbeiros' },
  { id: 'recepcao', nome: 'Recepção' },
  { id: 'clientes', nome: 'Os clientes da barbearia' },
  { id: 'contador', nome: 'Contador' },
] as const

export type IdPergunta = 'nome' | 'problema' | 'quem' | 'precisa' | 'parecido'

/** Cinco perguntas, uma por vez (u06: "quantas antes de cansar?" fica a validar; começamos com 5, como o protótipo). */
export const PERGUNTAS: { id: IdPergunta; titulo: string; dica: string }[] = [
  { id: 'nome', titulo: 'Como você quer chamar esta obra?', dica: 'Pode ser um nome provisório. Mais tarde vocês escolhem o nome de verdade, juntos.' },
  { id: 'problema', titulo: 'O que está te incomodando hoje?', dica: 'Conte como funciona hoje e o que dá errado. Sem pressa, do seu jeito.' },
  { id: 'quem', titulo: 'Quem vai usar o sistema?', dica: 'Toque em todos que valem. Depois, se quiser, conte mais pelo microfone.' },
  { id: 'precisa', titulo: 'O que não pode faltar de jeito nenhum?', dica: 'Diga as coisas mais importantes, uma atrás da outra. Pode ser bem simples.' },
  { id: 'parecido', titulo: 'Você conhece algo parecido que gosta?', dica: 'Um aplicativo, um site, uma planilha. Se não conhecer nenhum, tudo bem: pode pular.' },
]
