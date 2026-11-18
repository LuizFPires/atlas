// Fidelidade com o protótipo F02Ativacao: os textos que o cliente lê são os mesmos da tela desenhada.
import proto from '../../prototipo/F02Ativacao.dc.html?raw'
import { DICAS } from './Ativacao'

// No protótipo a barra invertida da pasta vem escapada dentro de uma string JS.
const normal = (s: string) => s.replace(/\\\\/g, '\\')

test('as 3 dicas (fala, canteiro, pasta) têm título e texto idênticos ao protótipo', () => {
  expect(DICAS).toHaveLength(3)
  for (const d of DICAS) {
    expect(normal(proto)).toContain(d.titulo)
    expect(normal(proto)).toContain(d.texto)
  }
})

test('os textos fixos da tela batem com o protótipo', () => {
  for (const t of ['Confirme que é você', 'Este computador vai ficar com a sua licença', 'Confirmar e instalar', 'Reenviar código', 'Instalando o Atlas', 'Enquanto instala, 3 coisas para saber', 'Continuar', 'O antivírus pediu permissão? Clique em "Permitir".', 'Confirmar e-mail', 'Acompanhar pelo celular']) {
    expect(proto).toContain(t)
  }
})
