// Fidelidade com o protótipo F06cTrazer: recado, passos, textos e itens da conferência batem com a tela desenhada.
// Diferenças conscientes: ícones SVG no lugar dos emojis (✓ 📦 🔗); "anotado" no lugar de "✓ abre no celular" (o app não abre o link);
// o recado rola (overflow auto) em vez de cortar; campo "Nome da obra" no passo 2 (a pasta da obra nasce aqui, sem passar pela F06);
// a coluna da direita antes do .zip mostra a lista do que ele deve conter; o botão de seguir só liga depois que o .zip chegou;
// "Abrir no Atlas e ajustar" volta às obras até a F07 existir (M16).
import proto from '../../prototipo/F06cTrazer.dc.html?raw'
import { conferirPacote, LISTA_VERIFICACAO, RECADO } from './trazer-dados'

const protoLF = proto.replace(/\r\n/g, '\n')

test('o recado é o mesmo do protótipo, palavra por palavra', () => {
  expect(protoLF).toContain(RECADO)
})

test('textos fixos da tela batem com o protótipo', () => {
  for (const t of [
    'NOVA OBRA · JÁ TENHO UM PROTÓTIPO',
    'Fez o protótipo em outra IA? Traga para cá.',
    'Vale protótipo feito no Claude, no ChatGPT, no Codex, no Lovable ou em qualquer outra. São 3 passos.',
    'Copie este recado e mande na conversa onde você fez o protótipo',
    'Copiar recado',
    'A IA vai te devolver um arquivo .zip e um link do protótipo no ar.',
    'Traga o que a IA devolveu',
    'prototipo-atlas.zip',
    'O Atlas conferiu o que chegou',
    'Tudo foi guardado na pasta da obra',
    'Você não precisa mexer nela.',
    '← Voltar',
    'Abrir no Atlas e ajustar →',
  ]) expect(protoLF).toContain(t)
})

test('a conferência usa os mesmos títulos do protótipo', () => {
  const todos = conferirPacote({ arquivos: [{ destino: 'telas/a.html' }, { destino: 'design-system.md' }, { destino: 'regras.md' }, { destino: 'telas.md' }, { destino: 'imagens/l.png' }], textos: { 'regras.md': '- a\n- b' } }, null)
  const titulos = todos.map((c) => c.titulo)
  expect(titulos).toContain('Design system')
  expect(titulos).toContain('Regras do negócio')
  expect(titulos).toContain('Faltou a tela de entrar (login)')
  expect(titulos).toContain('Dados de mentirinha')
  for (const t of ['Design system', 'Regras do negócio', 'Faltou a tela de entrar (login)', 'Dados de mentirinha']) expect(protoLF).toContain(`'${t}'`)
  expect(protoLF).toContain('7 telas encontradas')
  expect(todos[0].titulo).toBe('1 tela encontrada')
  expect(todos.find((c) => c.id === 'regras')?.txt).toContain('2 regras')
})

test('a lista de verificação cobre o que o recado pede', () => {
  for (const i of LISTA_VERIFICACAO) expect(RECADO).toContain(i.nome)
})
