import { caminhoNaObra, criarArquivosFixture, extensaoPermitida, nomeArquivoSeguro, nomeLivre } from './ponte-arquivos'

test('nome de arquivo vira nome seguro e mantém a extensão', () => {
  expect(nomeArquivoSeguro('Logo da Barbearia (final).PNG')).toBe('logo-da-barbearia-final.png')
  expect(nomeArquivoSeguro('../../Windows/system32/x.dll')).toBe('x.dll')
  expect(nomeArquivoSeguro('CON.png')).toBe('con-arquivo.png')
  expect(nomeArquivoSeguro('///')).toBe('arquivo')
})

test('só aceita as extensões de cada tipo', () => {
  expect(extensaoPermitida('imagem', 'a.png')).toBe(true)
  expect(extensaoPermitida('imagem', 'a.exe')).toBe(false)
  expect(extensaoPermitida('design-system', 'design-system.md')).toBe(true)
  expect(extensaoPermitida('design-system', 'design-system.html')).toBe(false)
})

test('o caminho nunca sai da subpasta da obra', () => {
  const B = String.fromCharCode(92)
  const raiz = ["C:","Users","Zé","Atlas","Obras"].join(B)
  expect(caminhoNaObra(raiz, 'barbearia', 'estilo/identidade', 'logo.png')).toBe([raiz, "barbearia", "estilo", "identidade", "logo.png"].join(B))
  expect(() => caminhoNaObra(raiz, '..', 'raiz', 'a.png')).toThrow()
  expect(() => caminhoNaObra(raiz, 'a' + B + 'b', 'raiz', 'a.png')).toThrow()
  expect(() => caminhoNaObra(raiz, 'obra', 'raiz', '..' + B + 'x.png')).toThrow()
  expect(() => caminhoNaObra(raiz, 'obra', 'raiz', 'a..b.png')).toThrow()
})

test('nunca sobrescreve: logo.png, logo-2.png', async () => {
  expect(nomeLivre('logo.png', ['logo.png'])).toBe('logo-2.png')
  const f = criarArquivosFixture()
  const a = await f.guardar('obra', 'estilo/identidade', { nome: 'Logo.png', tamanho: 1 })
  const b = await f.guardar('obra', 'estilo/identidade', { nome: 'logo.png', tamanho: 1 })
  expect([a.nome, b.nome]).toEqual(['logo.png', 'logo-2.png'])
})

test('desistir do diálogo devolve null; arquivo grande demais é recusado', async () => {
  const f = criarArquivosFixture()
  f.fila.push(null, { nome: 'a.png', tamanho: 50 * 1024 * 1024 })
  expect(await f.escolher('imagem')).toBeNull()
  await expect(f.escolher('imagem')).rejects.toThrow('grande-demais')
})
