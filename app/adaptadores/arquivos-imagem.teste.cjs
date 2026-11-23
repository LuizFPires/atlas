// node --test app/adaptadores/arquivos-imagem.teste.cjs — M33: foto de referência que veio do celular vai para a pasta da obra.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarArquivos } = require('./arquivos.cjs')

const JPG = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString('base64')
function montar() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-img-'))
  fs.mkdirSync(path.join(raiz, 'barbearia'))
  return { raiz, a: criarArquivos({ raiz, dialog: {} }) }
}

test('grava a foto em estilo/referencias, sem sobrescrever', async () => {
  const { raiz, a } = montar()
  const r1 = await a.guardarImagem('barbearia', 'celular-1', JPG)
  const r2 = await a.guardarImagem('barbearia', 'celular-1', JPG)
  assert.equal(r1.nome, 'celular-1.jpg')
  assert.equal(r2.nome, 'celular-1-2.jpg')
  assert.deepEqual(fs.readFileSync(path.join(raiz, 'barbearia', 'estilo', 'referencias', 'celular-1.jpg')), Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]))
})

test('recusa o que não é imagem, imagem grande, pasta de fora e nome com caminho', async () => {
  const { a } = montar()
  await assert.rejects(a.guardarImagem('barbearia', 'x', 'data:text/html;base64,PGI+'), /tipo-nao-aceito/)
  await assert.rejects(a.guardarImagem('barbearia', 'x', 'data:image/png;base64,' + 'A'.repeat(3_000_000)), /grande-demais/)
  await assert.rejects(a.guardarImagem('../fora', 'x', JPG), /pasta-invalida/)
  await assert.rejects(a.guardarImagem('nao-existe', 'x', JPG), /pasta-invalida/)
  const r = await a.guardarImagem('barbearia', '../../x', JPG)
  assert.ok(!r.nome.includes('/') && !r.nome.includes('..'))
})
