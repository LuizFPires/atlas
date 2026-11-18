// Fidelidade com o protótipo F07bBatismo (nota u07b: batismo no fim do projeto, 3 nomes com logo/slogan/motivo, confere nomes
// parecidos e endereço livre, quem já tem nome e logo sobe os arquivos).
// Diferenças conscientes:
//  - a logomarca aceita PNG, JPG, WebP ou PDF; o protótipo diz "PNG, SVG ou PDF", mas SVG é recusado (pode carregar script);
//  - o 🖼 do protótipo é o ícone SVG de traço "imagem"; ↻ e ⚠/✓ ficam como texto, como no protótipo;
//  - "Falar uma ideia de nome" abre um campo com microfone (a transcrição fica editável); o protótipo só desenha o botão;
//  - "Conferir nome e endereço" é novo no modo "já tenho", para conferir também o nome do cliente;
//  - o rótulo "PROJETO · nome da obra" e a conferência por cartão vêm do mesmo padrão das telas anteriores;
//  - os cartões são botões de escolha (radio) e o celular ao lado mostra o nome, slogan e logo escolhidos, como no protótipo.
import proto from '../../prototipo/F07bBatismo.dc.html?raw'
import { criarBatismoFixture, criarNomesFixture, LOGOS, resumoDaConferencia } from './ponte-batismo'

const protoLF = proto.replace(/\r\n/g, '\n')

test('textos fixos da tela batem com o protótipo', () => {
  for (const t of [
    'Hora do batismo.',
    'Agora o Atlas já sabe o que o sistema faz, para quem é e qual é a cara dele. Por isso o nome vem no final: ele nasce de tudo o que vocês construíram.',
    'Quero sugestões do Atlas',
    'Já tenho nome e logomarca',
    '↻ Sugerir outros',
    'Falar uma ideia de nome',
    'Antes de você decidir, o Atlas procura nomes parecidos e confere se o endereço na internet está livre.',
    'Qual o nome do sistema?',
    'Ex.: Agenda do Zé',
    'Logomarca',
    'O Atlas cria o ícone do app a partir dela.',
    'Escolher arquivo',
    '← Voltar às telas',
    'Batizar como',
    'Assim fica no celular dos seus clientes:',
    'Marcar horário',
    'Nome e marca',
  ]) expect(protoLF).toContain(t)
})

test('os nomes de exemplo, slogans e motivos são os do protótipo', async () => {
  const [a, b, c] = await criarBatismoFixture().sugerir('obra', 'Barbearia do Zé')
  for (const n of [a, b, c]) {
    for (const campo of [n.nome, n.slogan, n.porque]) expect(protoLF).toContain(campo.replace(/"/g, '"'))
  }
  expect([a.nome, b.nome, c.nome]).toEqual(['Cadeira 1', 'Navalha', 'Horinha'])
  // As três logos do protótipo têm o mesmo traço.
  for (const id of ['cadeira', 'navalha', 'hora'] as const) expect(protoLF).toContain(LOGOS[id])
})

test('a conferência fala como o protótipo', async () => {
  const n = criarNomesFixture()
  expect(resumoDaConferencia(await n.conferir('Cadeira 1')).texto).toBe('nome livre · cadeira1.app livre')
  expect(protoLF).toContain('nome livre · cadeira1.app livre')
  expect(resumoDaConferencia(await n.conferir('Navalha')).texto).toBe('existe um salão com nome parecido em SP')
  expect(protoLF).toContain('existe um salão com nome parecido em SP')
})

test('as cores do celular de exemplo são as do protótipo', () => {
  for (const c of ['#FBF7F2', '#2B211B', '#D9A066', '#B5651D', '#6E5A4A']) expect(protoLF).toContain(c)
})
