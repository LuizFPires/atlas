// Fidelidade com o protótipo F06bEstilo: os textos que o cliente lê, os 3 estilos de exemplo e as opções batem com a tela desenhada.
// Diferenças conscientes: ícones SVG no lugar dos emojis (📎 🖼 🎨 📘), "anotado" no lugar de "✓ lido" (o app ainda não abriu o link),
// o painel dos 3 estilos só aparece depois de "Mostrar 3 estilos" e, no modo "Já tenho", o painel da direita explica o que o Atlas faz.
import proto from '../../prototipo/F06bEstilo.dc.html?raw'
import { FASES, MODOS, SENTIMENTOS, UPLOADS } from './estilo-dados'
import { ESTILOS_EXEMPLO } from './ponte-estilo'

test('fases, modos, sentimentos e envios batem com o protótipo', () => {
  expect(FASES.map((f) => f.nome)).toEqual(['Estilo', 'Telas', 'Nome e marca'])
  for (const f of FASES) expect(proto).toContain(`'${f.nome}'`)
  for (const m of MODOS) expect(proto).toContain(`['${m.id}', '${m.nome}']`)
  expect(proto).toContain(`const S = [${SENTIMENTOS.map((s) => `'${s}'`).join(', ')}]`)
  for (const u of UPLOADS) {
    // Divergência consciente: a logo não aceita SVG (pode carregar script), então a descrição não cita SVG.
    if (u.id === 'logo') { expect(proto).toContain(`nome: '${u.nome}'`); continue }
    expect(proto).toContain(`nome: '${u.nome}', desc: '${u.desc}'`)
  }
})

test('os 3 estilos de exemplo têm as mesmas cores, cantos e textos do protótipo', () => {
  expect(ESTILOS_EXEMPLO.map((e) => e.id)).toEqual(['couro', 'navalha', 'leve'])
  for (const e of ESTILOS_EXEMPLO) {
    for (const campo of ['id', 'nome', 'de', 'fundo', 'topo', 'topoTxt', 'destaque', 'destTxt', 'linha', 'raio'] as const) {
      expect(proto).toContain(`${campo}: '${e[campo]}'`)
    }
  }
})

test('textos fixos da tela batem com o protótipo', () => {
  for (const t of [
    'Qual é a cara do seu sistema?',
    'Antes de desenhar as telas, vamos escolher as cores, as letras e o jeito dos botões. Assim o protótipo já nasce com a cara da sua barbearia.',
    'PROJETO · AGENDA DA BARBEARIA DO ZÉ',
    'Mande 2 ou 3 sites ou apps que você acha bonitos',
    'Pode ser de qualquer ramo: uma loja, um banco, um restaurante. Vale link ou print da tela.',
    'Mandar print',
    'Falar o que você gosta',
    'O que o seu cliente deve sentir ao abrir o sistema?',
    'Mande o que você já tem',
    'O Atlas lê tudo e monta o design system do seu sistema a partir disso.',
    'Escolher arquivo',
    'O Atlas montou 3 estilos para você',
    'toque para escolher',
    'Marcar horário',
    '← Voltar',
    'e desenhar as telas →',
    'Vira o design system do seu sistema. Dá para ajustar depois.',
  ]) expect(proto).toContain(t)
})
