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
  const a = await f.guardar('obra', 'estilo/identidade', f.registrar('logo', { nome: 'Logo.png', tamanho: 1 }))
  const b = await f.guardar('obra', 'estilo/identidade', f.registrar('logo', { nome: 'logo.png', tamanho: 1 }))
  expect([a.nome, b.nome]).toEqual(['logo.png', 'logo-2.png'])
})

test('desistir do diálogo devolve null; arquivo grande demais é recusado', async () => {
  const f = criarArquivosFixture()
  f.fila.push(null, { nome: 'a.png', tamanho: 50 * 1024 * 1024 })
  expect(await f.escolher('imagem')).toBeNull()
  await expect(f.escolher('imagem')).rejects.toThrow('grande-demais')
})

test('guardar só aceita o token que escolher devolveu e revalida tipo, tamanho e destino', async () => {
  const f = criarArquivosFixture()
  await expect(f.guardar('obra', 'estilo/identidade', 'tok-forjado')).rejects.toThrow('token-invalido')
  // Descritor forjado com extensão fora do tipo, grande demais, ou fora do .md na raiz.
  await expect(f.guardar('obra', 'estilo/identidade', f.registrar('logo', { nome: 'x.exe', tamanho: 1 }))).rejects.toThrow('tipo-nao-aceito')
  await expect(f.guardar('obra', 'estilo/identidade', f.registrar('logo', { nome: 'x.png', tamanho: 50 * 1024 * 1024 }))).rejects.toThrow('grande-demais')
  await expect(f.guardar('obra', 'raiz', f.registrar('manual', { nome: 'manual.pdf', tamanho: 1 }))).rejects.toThrow('tipo-nao-aceito')
  expect(f.guardados).toEqual([])
  const ok = await f.guardar('obra', 'raiz', f.registrar('manual', { nome: 'design-system.md', tamanho: 1 }))
  expect(ok.nome).toBe('design-system.md')
})

test('o token vale uma vez só', async () => {
  const f = criarArquivosFixture()
  const a = (await f.escolher('imagem'))!
  await f.guardar('obra', 'estilo/referencias', a.token)
  await expect(f.guardar('obra', 'estilo/referencias', a.token)).rejects.toThrow('token-invalido')
})

test('SVG não é aceito como logo (pode carregar script)', () => {
  expect(extensaoPermitida('logo', 'logo.svg')).toBe(false)
  expect(extensaoPermitida('logo', 'logo.webp')).toBe(true)
})
