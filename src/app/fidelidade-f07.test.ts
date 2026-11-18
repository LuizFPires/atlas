// Fidelidade com o protótipo F07Prototipo (nota u07: ajustes falando, celular mudando ao lado, desfazer e versões).
// Diferenças conscientes: o 📎 é ícone SVG (clipe) e só aparece se há PonteArquivos; o botão do microfone usa o rótulo comum "Falar"
// (componente Microfone do Atlas) e o enviar/Enviar é o mesmo; o preview é um iframe sandbox sem scripts (o protótipo desenha o celular
// inline); o rótulo do cabeçalho em caixa alta vem do CSS; "Versões guardadas" (chips v1, v2...) é novo, para voltar a qualquer versão
// (o protótipo só mostra "Voltar à versão N-1"); o botão final "dar o nome" volta às obras até a F07b existir (M17);
// as 4 abas abrem 4 telas reais (o protótipo só desenha 2); a agenda de exemplo e os horários ocupados são os mesmos.
import proto from '../../prototipo/F07Prototipo.dc.html?raw'
import { ESTILOS_EXEMPLO } from './ponte-estilo'
import { criarPrototipoFixture } from './ponte-prototipo'

const protoLF = proto.replace(/\r\n/g, '\n')

test('textos fixos da tela batem com o protótipo', () => {
  for (const t of [
    'PROJETO 2 DE 3 · TELAS',
    'Voltar à versão',
    'Telas do meu jeito: dar o nome →',
    'Fale ou escreva:',
    'troque a cor',
    'tire o campo de e-mail',
    'Pedir ajuste',
    'Enviar',
    'Marcar horário',
    'Agenda do dia',
    'Confirmação',
    'Início',
    'Escolha o barbeiro',
    'Marcar às 15:30',
    'Agenda de hoje',
    'Quinta, 20/11',
  ]) expect(protoLF).toContain(t)
})

test('as telas de exemplo usam os mesmos nomes, horários e agenda do protótipo', async () => {
  const p = criarPrototipoFixture()
  const { versoes } = await p.desenhar('obra', 'Barbearia do Zé', ESTILOS_EXEMPLO[0])
  const telas = versoes[0].telas
  expect(telas.map((t) => t.nome)).toEqual(['Marcar horário', 'Agenda do dia', 'Confirmação', 'Início'])
  const [agendar, agenda] = telas.map((t) => t.html)
  for (const h of ['09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '15:00', '15:30', '16:00']) { expect(protoLF).toContain(`'${h}'`); expect(agendar).toContain(h) }
  for (const n of ['Carlos M.', 'Pedro A.', 'Lucas F.', 'Você marcou']) { expect(protoLF).toContain(n); expect(agenda).toContain(n) }
  expect(agendar.match(/class="h oc"/g)).toHaveLength(3) // 09:00, 10:30 e 14:00 riscados, como no protótipo
  expect(protoLF).toContain("const ocup = ['09:00', '10:30', '14:00']")
  expect(agendar).toContain('Barbearia do Zé')
})

test('o estilo escolhido (Couro e madeira) pinta o celular com as cores do protótipo', async () => {
  const p = criarPrototipoFixture()
  const { versoes } = await p.desenhar('obra', 'Barbearia do Zé', ESTILOS_EXEMPLO[0])
  const css = versoes[0].telas[0].html
  for (const c of ['#FBF7F2', '#2B211B', '#B5651D']) { expect(protoLF).toContain(c); expect(css).toContain(c) }
})
