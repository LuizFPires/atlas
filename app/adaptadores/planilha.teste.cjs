// Raio-X da planilha (prototipo/caminho-novo/X1–X3). Monta um .xlsx de verdade (zip de XML) byte a byte; sem rede, sem Excel.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const zlib = require('node:zlib')
const { crc32 } = require('./zip-leitor.cjs')
const { raioX, resumoParaClaude, avaliar, deslocar } = require('./planilha.cjs')

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-planilha-'))
const crcDe = (b) => (crc32(0xFFFFFFFF, b) ^ 0xFFFFFFFF) >>> 0

/** Zip simples (deflate) a partir de { nome: conteúdo }. */
function zip(arquivos) {
  const corpo = []; const centrais = []; let off = 0
  for (const [n, conteudo] of Object.entries(arquivos)) {
    const nome = Buffer.from(n); const dados = Buffer.from(conteudo); const comp = zlib.deflateRawSync(dados); const crc = crcDe(dados)
    const h = Buffer.alloc(30)
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8)
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(dados.length, 22); h.writeUInt16LE(nome.length, 26)
    corpo.push(h, nome, comp)
    const c = Buffer.alloc(46)
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE((3 << 8) | 20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10)
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(dados.length, 24); c.writeUInt16LE(nome.length, 28)
    c.writeUInt32LE((0o100644 << 16) >>> 0, 38); c.writeUInt32LE(off, 42)
    centrais.push(c, nome)
    off += 30 + nome.length + comp.length
  }
  const indice = Buffer.concat(centrais)
  const fim = Buffer.alloc(22)
  const n = Object.keys(arquivos).length
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(n, 8); fim.writeUInt16LE(n, 10); fim.writeUInt32LE(indice.length, 12); fim.writeUInt32LE(off, 16)
  return Buffer.concat([...corpo, indice, fim])
}

const S = ['Nº', 'Obra', 'Fornecedor', 'Status', 'Total', 'PC-1', 'PC-2', 'Galpão SMS', 'Lagoa Santa', 'Aprovado', 'Enviado', 'Pedido', 'Qtd', 'Preço', 'Total item', 'Obras', 'Aço Forte', 'CNPJ', 'Nome']
const si = (t) => S.indexOf(t)
const cs = (r, t, s = 0) => `<c r="${r}" t="s"${s ? ` s="${s}"` : ''}><v>${si(t)}</v></c>`
const cn = (r, v, s = 0, f = null) => `<c r="${r}"${s ? ` s="${s}"` : ''}>${f ? `<f>${f}</f>` : ''}<v>${v}</v></c>`
const aba = (linhas, extra = '') => `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${linhas.map((l, i) => `<row r="${i + 1}">${l}</row>`).join('')}</sheetData>${extra}</worksheet>`

function compras({ macro = false, totalErrado = false } = {}) {
  const pedidos = aba([
    cs('A1', 'Nº') + cs('B1', 'Obra') + cs('C1', 'Fornecedor') + cs('D1', 'Status') + cs('E1', 'Total'),
    cs('A2', 'PC-1') + cs('B2', 'Galpão SMS') + `<c r="C2" t="str"><f>VLOOKUP("x",Fornecedores!$A$2:$B$3,2,FALSE)</f><v>Aço Forte</v></c>` + cs('D2', 'Aprovado') + cn('E2', 3180, 1, 'SUMIF(Itens!$A$2:$A$4,A2,Itens!$D$2:$D$4)'),
    cs('A3', 'PC-2') + cs('B3', 'Lagoa Santa') + `<c r="C3" t="str"><f>VLOOKUP("y",Fornecedores!$A$2:$B$3,2,FALSE)</f><v>Aço Forte</v></c>` + cs('D3', 'Enviado') + cn('E3', totalErrado ? 9999 : 7920, 1, 'SUMIF(Itens!$A$2:$A$4,A3,Itens!$D$2:$D$4)'),
  ], '<conditionalFormatting sqref="E2:E500"><cfRule type="cellIs" dxfId="0" priority="1" operator="greaterThan"><formula>5000</formula></cfRule></conditionalFormatting><dataValidations count="2"><dataValidation type="list" sqref="D2:D500"><formula1>"Rascunho,Enviado,Aprovado,Entregue"</formula1></dataValidation><dataValidation type="list" sqref="B2:B500"><formula1>Listas!$A$2:$A$3</formula1></dataValidation></dataValidations>')
  const itens = aba([
    cs('A1', 'Pedido') + cs('B1', 'Qtd') + cs('C1', 'Preço') + cs('D1', 'Total item'),
    cs('A2', 'PC-1') + cn('B2', 10) + cn('C2', 318, 1) + `<c r="D2" s="1"><f t="shared" ref="D2:D4" si="0">B2*C2</f><v>3180</v></c>`,
    cs('A3', 'PC-2') + cn('B3', 20) + cn('C3', 300, 1) + `<c r="D3" s="1"><f t="shared" si="0"/><v>6000</v></c>`,
    cs('A4', 'PC-2') + cn('B4', 6) + cn('C4', 320, 1) + `<c r="D4" s="1"><f t="shared" si="0"/><v>1920</v></c>`,
  ])
  const listas = aba([cs('A1', 'Obras'), cs('A2', 'Galpão SMS'), cs('A3', 'Lagoa Santa')])
  const fornecedores = aba([cs('A1', 'CNPJ') + cs('B1', 'Nome'), cn('A2', 123) + cs('B2', 'Aço Forte')])
  const arquivos = {
    '[Content_Types].xml': '<Types/>',
    'xl/workbook.xml': '<workbook xmlns:r="r"><sheets><sheet name="Pedidos" sheetId="1" r:id="rId1"/><sheet name="Itens" sheetId="2" r:id="rId2"/><sheet name="Listas" sheetId="3" r:id="rId3"/><sheet name="Fornecedores" sheetId="4" r:id="rId4"/></sheets><definedNames><definedName name="Obras">Listas!$A$2:$A$3</definedName></definedNames></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Type="http://x/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://x/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://x/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Type="http://x/worksheet" Target="worksheets/sheet4.xml"/></Relationships>',
    'xl/sharedStrings.xml': `<sst>${S.map((t) => `<si><t>${t}</t></si>`).join('')}</sst>`,
    'xl/styles.xml': '<styleSheet><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;R$&quot;\\ #,##0.00"/></numFmts><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs></styleSheet>',
    'xl/worksheets/sheet1.xml': pedidos,
    'xl/worksheets/sheet2.xml': itens,
    'xl/worksheets/sheet3.xml': listas,
    'xl/worksheets/sheet4.xml': fornecedores,
  }
  if (macro) arquivos['xl/vbaProject.bin'] = 'binario'
  return zip(arquivos)
}

const gravar = (nome, buf) => { const f = path.join(tmp(), nome); fs.writeFileSync(f, buf); return f }

test('lê abas, cabeçalho, tipos, listas (inclusive da outra aba), cores, ligações e fórmulas', async () => {
  const r = await raioX(gravar('Compras 2026.xlsx', compras()), 'Compras 2026.xlsx')
  assert.equal(r.formato, 'xlsx')
  assert.deepEqual(r.abas.map((a) => a.nome), ['Pedidos', 'Itens', 'Listas', 'Fornecedores'])
  const p = r.abas[0]
  assert.equal(p.cabecalho, 1)
  assert.equal(p.linhas, 2)
  const col = (t) => p.colunas.find((c) => c.titulo === t)
  assert.deepEqual(col('Status').lista, ['Rascunho', 'Enviado', 'Aprovado', 'Entregue'])
  assert.deepEqual(col('Obra').lista, ['Galpão SMS', 'Lagoa Santa'])
  assert.equal(col('Obra').listaDe, 'Listas')
  assert.equal(col('Total').tipo, 'moeda')
  assert.equal(col('Total').cor, 'maior que 5000')
  assert.deepEqual(col('Fornecedor').ligacao, { aba: 'Fornecedores', busca: true })
  assert.deepEqual(col('Total').ligacao, { aba: 'Itens', busca: false })
  const itens = r.abas[1]
  assert.equal(itens.colunas.find((c) => c.titulo === 'Total item').formula, 'B2*C2')
  assert.equal(itens.colunas.find((c) => c.titulo === 'Total item').formulas, 3)
  assert.equal(p.amostra.length, 2)
  assert.deepEqual(r.nomes, [{ nome: 'Obras', ref: 'Listas!$A$2:$A$3' }])
  assert.equal(r.macros, false)
})

test('conferência: refaz as fórmulas com os valores do Excel; acha a que não bate; o que não sabe fica "sem conferir"', async () => {
  const ok = await raioX(gravar('a.xlsx', compras()), 'a.xlsx')
  // 3 totais de item (shared) + 2 SOMASE; os 2 PROCV não são calculados
  assert.deepEqual({ c: ok.contas.conferidas, b: ok.contas.batem, s: ok.contas.semConferir, d: ok.contas.divergem.length }, { c: 5, b: 5, s: 2, d: 0 })
  const errado = await raioX(gravar('b.xlsx', compras({ totalErrado: true })), 'b.xlsx')
  assert.equal(errado.contas.batem, 4)
  assert.deepEqual(errado.contas.divergem[0], { aba: 'Pedidos', celula: 'E3', formula: 'SUMIF(Itens!$A$2:$A$4,A3,Itens!$D$2:$D$4)', excel: 9999, atlas: 7920 })
})

test('macro: só diz que existe (o código não é lido)', async () => {
  const r = await raioX(gravar('c.xlsm', compras({ macro: true })), 'c.xlsm')
  assert.equal(r.formato, 'xlsm')
  assert.equal(r.macros, true)
  assert.match(resumoParaClaude(r), /Tem macro/)
})

test('resumo para o Claude: estrutura e no máximo 3 linhas por aba', async () => {
  const r = await raioX(gravar('d.xlsx', compras()), 'd.xlsx')
  const t = resumoParaClaude(r)
  assert.match(t, /## Aba "Pedidos" · 2 linhas/)
  assert.match(t, /"Status": texto · lista: Rascunho \| Enviado \| Aprovado \| Entregue/)
  assert.match(t, /cor quando: maior que 5000/)
  assert.match(t, /5 recalculadas, 5 batem/)
})

test('.xls antigo, arquivo que não é planilha e grande demais: erros calmos', async () => {
  const xls = Buffer.concat([Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]), Buffer.alloc(100)])
  await assert.rejects(raioX(gravar('v.xls', xls), 'v.xls'), /formato-antigo/)
  await assert.rejects(raioX(gravar('x.xlsx', Buffer.from('lixo qualquer')), 'x.xlsx'), /nao-e-planilha/)
  await assert.rejects(raioX(gravar('z.xlsx', zip({ 'a.txt': 'oi' })), 'z.xlsx'), /nao-e-planilha/)
})

test('.csv brasileiro (ponto e vírgula, R$ 1.234,56, datas)', async () => {
  const csv = 'Data;Descrição;Valor;Categoria\n01/11/2026;Cimento;R$ 1.234,56;Material\n02/11/2026;"Frete; urgente";R$ 80,00;Transporte\n'
  const r = await raioX(gravar('caixa.csv', Buffer.from(csv)), 'caixa.csv')
  const a = r.abas[0]
  assert.equal(a.nome, 'caixa')
  assert.deepEqual(a.colunas.map((c) => [c.titulo, c.tipo]), [['Data', 'data'], ['Descrição', 'texto'], ['Valor', 'moeda'], ['Categoria', 'texto']])
  assert.equal(a.linhas, 2)
  assert.equal(a.amostra[1][1], 'Frete; urgente')
})

test('calculadora: aritmética, funções, SE, comparação, texto; o desconhecido é "nao-sei"', () => {
  const v = { A1: 10, A2: 20, A3: 'x', B1: true }
  const ctx = { celula: (aba, r) => v[r] ?? null, faixa: (aba, a, b) => [[v[a]], [v[b]]] }
  assert.equal(avaliar('A1*2+A2/4', ctx), 25)
  assert.equal(avaliar('SUM(A1:A2)', ctx), 30)
  assert.equal(avaliar('IF(A1>5,"alto","baixo")', ctx), 'alto')
  assert.equal(avaliar('ROUND(A2/3,2)', ctx), 6.67)
  assert.equal(avaliar('A3&"y"', ctx), 'xy')
  assert.equal(avaliar('-A1^2', ctx), 100)
  assert.equal(avaliar('10%', ctx), 0.1)
  assert.throws(() => avaliar('VLOOKUP(A1,A1:A2,1,FALSE)', ctx), /nao-sei/)
  assert.throws(() => avaliar('A1:A2', ctx), /nao-sei/)
})

test('fórmula compartilhada: desloca só as referências relativas', () => {
  assert.equal(deslocar('B2*C2+$E$1', 2, 0), 'B4*C4+$E$1')
  assert.equal(deslocar('SUM(B2:B5)*"B2"', 1, 1), 'SUM(C3:C6)*"B2"')
  assert.equal(deslocar('LOG10(A1)', 1, 0), 'LOG10(A2)')
  assert.equal(deslocar("'Minha Aba'!A1", 3, 0), "'Minha Aba'!A4")
})
