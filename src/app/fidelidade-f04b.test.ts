// Fidelidade com o protótipo F04bCelular: os textos que o cliente lê são os mesmos da tela desenhada.
// O protótipo usa emoji na prévia do celular; o app usa ícones SVG, então o emoji sai e o texto fica.
import proto from '../../prototipo/F04bCelular.dc.html?raw'
import { AVISOS, FREQUENCIAS } from './Celular'

test('frequências e avisos batem com o protótipo', () => {
  expect(FREQUENCIAS.map((f) => f.id)).toEqual(['30m', '1h', '3h', 'etapa'])
  for (const f of FREQUENCIAS) expect(proto).toContain(`['${f.id}', '${f.nome}', '${f.proxima}']`)
  expect(AVISOS.map((a) => a.id)).toEqual(['precisa', 'etapa', 'fim'])
  for (const a of AVISOS) expect(proto).toContain(`['${a.id}', '${a.nome}']`)
})

test('os textos fixos da tela batem com o protótipo', () => {
  for (const t of [
    'ÚLTIMO PASSO',
    'Deixe o computador ligado e acompanhe pelo app do Claude, de onde estiver.',
    '1. Baixe o app do Claude no celular',
    '2. De quanto em quanto tempo você quer notícias da obra?',
    'Pelo celular você também pode responder falando: "pausa a obra", "troca a cor do botão", "como está?".',
    'Assim chega no seu celular:',
    'QR code para baixar o app do Claude',
    'Agenda da Barbearia do Zé: 62% pronta.',
    'Tela de marcar horário pronta e testada.',
    'Agora: confirmação pelo WhatsApp (etapa 5 de 8).',
    'Faltam umas 9 h de obra.',
    'Beleza. Coloca o botão de marcar em marrom, igual a fachada.',
    'Anotado! Faço isso logo depois desta etapa e te mostro antes de colocar no ar.',
    '← Voltar',
    'Concluir e ir para as obras →',
  ]) expect(proto).toContain(t)
})
