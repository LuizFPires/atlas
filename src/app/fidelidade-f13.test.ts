// Fidelidade com os protótipos F13aPublicar (nota u13a) e F13bPublicando (nota u13b).
// Diferenças conscientes:
//  - o nome da obra, o slug e o domínio vêm da obra (o protótipo traz o exemplo "Cadeira 1 / cadeira1"); o DNS é lido pela porta na hora;
//  - "✓", "🔒", "⏳", "▦", "📖", "👆" do protótipo viram o ícone SVG de traço ou somem (nunca emoji/caractere);
//  - F13a mostra só as opções marcadas e F13b só os guias delas; o guia do endereço grátis entra antes de domínio/app instalável (é a base);
//  - "Publicar agora" fica desligado sem nenhuma opção marcada (o protótipo é sempre um link);
//  - as tabelas "Tipo/Nome/Valor" do DNS usam o mesmo cartão com Copiar do guia de contas (M11);
//  - passo 3 e 6 das lojas e o passo do domínio ganharam a frase "o pagamento é só seu" / "o Atlas não vê nem guarda": reforço do invariante;
//  - passo 12 das lojas: "ajusta e reenvia" virou "ajusta; você reenvia" (reenviar para revisão é sempre do cliente);
//  - "Não consegui" abre a Ajuda do Atlas (F17) com o print do passo, como o link do protótipo.
import f13a from '../../prototipo/F13aPublicar.dc.html?raw'
import f13b from '../../prototipo/F13bPublicando.dc.html?raw'
import publicando from './Publicando.tsx?raw'
import publicar from './Publicar.tsx?raw'
import { OPCOES, custoTotal, passosLateral } from './publicar-dados'
import { guiaDominio, guiaGratis, guiaLojas, guiaPwa } from './publicar-passos'

const a = f13a.replace(/\r\n/g, '\n')
const b = f13b.replace(/\r\n/g, '\n')
const ctx = { obra: 'Cadeira 1', slug: 'cadeira1', endereco: 'cadeira1.vercel.app', dominio: 'cadeira1.com.br', dns: [{ tipo: 'A' as const, nome: '@', valor: '76.76.21.21' }, { tipo: 'CNAME' as const, nome: 'www', valor: 'cname.vercel-dns.com' }] }
const limpa = (t: string) => t.replace(/ ✓$/, '')

test('F13a: as 4 opções, textos e custos do protótipo estão na tela do app', () => {
  expect(OPCOES).toHaveLength(4)
  for (const o of OPCOES) {
    for (const t of [o.nome, o.exemplo, o.txt, o.custo]) expect(a).toContain(t)
    expect(a).toContain(o.ic)
  }
  for (const t of ['Onde o seu sistema vai morar?', 'Toque em tudo o que você quer. Dá para começar simples e acrescentar depois, a qualquer momento.', 'Publicar agora →', 'O que for pagamento ou assinatura, quem faz é você. O Atlas mostra o botão certo e espera.', 'O QUE VAI ACONTECER', 'Custo extra para publicar', 'Pago direto a quem cobra. O Atlas não cobra nada a mais.', 'o Atlas faz', 'é com você']) {
    expect(a).toContain(t)
    expect(publicar).toContain(t)
  }
})

test('F13a: a lista lateral e o custo seguem a mesma regra do protótipo', () => {
  const textos = passosLateral({ gratis: true, dominio: true, pwa: true, lojas: true }).map((p) => p.txt)
  for (const t of textos) expect(a).toContain(t)
  expect(a).toContain("sel: { gratis: true, pwa: true }")
  expect(custoTotal({ dominio: true, lojas: true })).toBe('~R$ 40/ano + US$ 99/ano + US$ 25')
  expect(a).toContain("'~R$ 40/ano'")
  expect(a).toContain("'US$ 99/ano + US$ 25'")
})

test('F13b: todo texto de passo do protótipo (faca, calma, intro) está no app, igual', () => {
  const evaluados = [guiaGratis(ctx), guiaDominio(ctx), guiaPwa(ctx), guiaLojas(ctx)]
  const doApp = new Set(evaluados.flatMap((g) => [g.intro, ...g.passos.flatMap((p) => [p.faca, p.calma])]))
  const doProto: string[] = []
  const re = /(?:faca|calma|intro): '([^']*)'/g
  for (let m = re.exec(b); m; m = re.exec(b)) doProto.push(limpa(m[1]))
  expect(doProto.length).toBeGreaterThan(60)
  const DIFERENCAS_CONSCIENTES = [
    'Confirme o endereço grátis do seu sistema. Se quiser outro nome, é só falar.', // não há campo para trocar o nome aqui (revisão M22)
    'Custa cerca de R$ 40 por ano. O Pix confirma em minutos; o boleto pode levar até 3 dias. O Atlas espera e te avisa.',
    'Não precisa entender o que é: o Atlas já preparou tudo. É só copiar e colar.',
    'Custa US$ 99 por ano. Se for no nome da empresa, a Apple pede o número D-U-N-S, que é grátis mas pode levar alguns dias. O Atlas te ajuda a pedir.',
    'Custa US$ 25, uma vez só. O Google pede um documento com foto para confirmar quem você é.',
    'É só desta vez. Nas próximas versões o Atlas envia sozinho.',
    'Na primeira vez, o Atlas vai pedir para você entrar com o seu Apple ID. Confirme com o código que aparece no seu iPhone.',
    'Esse botão é sempre seu: é você quem decide publicar.',
    'O Atlas acompanha a revisão e avisa no celular. Se a loja pedir alguma mudança, ele explica, ajusta e reenvia.',
  ]
  const faltando = doProto.filter((t) => !doApp.has(t) && !DIFERENCAS_CONSCIENTES.includes(t))
  expect(faltando).toEqual([])
  // as diferenças conscientes existem mesmo no protótipo (a lista não vira lixo) e o app tem a versão reforçada
  for (const t of DIFERENCAS_CONSCIENTES) expect(b).toContain(t)
})

test('F13b: quantidade de passos por guia e quem faz cada um (V = VOCÊ, A = O ATLAS) iguais ao protótipo', () => {
  const quemApp = (g: { passos: Array<{ quem: string }> }) => g.passos.map((p) => (p.quem === 'voce' ? 'V' : 'A')).join('')
  const bloco = (nome: string) => {
    const i = b.indexOf(`const ${nome} = [`)
    return b.slice(i, b.indexOf('\n];', i))
  }
  const quemProto = (nome: string) => [...bloco(nome).matchAll(/\{ quem: '([AV])'/g)].map((m) => m[1]).join('')
  expect(quemApp(guiaGratis(ctx))).toBe(quemProto('GRATIS'))
  expect(quemApp(guiaDominio(ctx))).toBe(quemProto('DOM'))
  expect(quemApp(guiaPwa(ctx))).toBe(quemProto('PWA'))
  expect(quemApp(guiaLojas(ctx))).toBe(quemProto('LOJAS'))
  expect(guiaGratis(ctx).passos).toHaveLength(5)
  expect(guiaDominio(ctx).passos).toHaveLength(8)
  expect(guiaPwa(ctx).passos).toHaveLength(5)
  expect(guiaLojas(ctx).passos).toHaveLength(13)
})

test('F13b: textos fixos da tela, traduções e botões do protótipo', () => {
  for (const t of ['Não consegui fazer este passo', 'Pode fechar o Atlas a qualquer momento. Quando voltar, ele continua deste passo.', 'TOQUE PARA VER CADA GUIA', 'Ver a entrega das chaves →', 'Fiz isso →', 'Continuar →', 'PASSO']) {
    expect(b).toContain(t)
  }
  for (const t of ['Não consegui fazer este passo', 'Pode fechar o Atlas a qualquer momento. Quando voltar, ele continua deste passo.', 'TOQUE PARA VER CADA GUIA', 'Ver a entrega das chaves →', 'Fiz isso →', 'Continuar →']) expect(publicando).toContain(t)
  for (const [en, pt] of [['Start Your Enrollment', 'Começar a inscrição'], ['Create account', 'Criar conta'], ['New App', 'Novo app'], ['Submit for Review', 'Enviar para revisão']]) {
    expect(b).toContain(`en: '${en}', pt: '${pt}'`)
    expect(guiaLojas(ctx).passos.some((p) => p.en === en && p.pt === pt)).toBe(true)
  }
  expect(b).toContain('href="F13Entrega.dc.html"')
  expect(b).toContain('href="F17Ajuda.dc.html"')
})

test('sem emoji nas telas novas (ícone SVG de traço)', () => {
  const emoji = /\p{Extended_Pictographic}/u
  for (const f of [publicando, publicar]) expect(f).not.toMatch(emoji)
  for (const g of [guiaGratis(ctx), guiaDominio(ctx), guiaPwa(ctx), guiaLojas(ctx)]) expect(JSON.stringify(g)).not.toMatch(emoji)
})
