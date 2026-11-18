// Fidelidade com o protótipo F17Ajuda (nota u17).
// Diferenças conscientes:
//  - o protótipo usa emoji/caracteres (🎤, 📸, 📎, ✓, ×) e a imagem do monograma; o app usa ícones SVG de traço (regra do Atlas);
//  - o campo de mensagem ganhou um botão "Enviar" (seta) além do Enter, para quem não sabe que Enter envia;
//  - a conversa do protótipo é um exemplo fixo (Vercel/GitHub); no app vem do Claude pela porta PonteAjuda (mock em fixture);
//  - os botões do passo só aparecem na resposta que traz passos e só a última resposta tem botões ativos;
//  - o aviso de erro (canto inferior) usa o título do erro de verdade; no protótipo é "Algo deu errado ao publicar.".
import f17 from '../../prototipo/F17Ajuda.dc.html?raw'
import tela from './Ajuda.tsx?raw'
import ponte from './ponte-ajuda.ts?raw'

const f = f17.replace(/\r\n/g, '\n')

test('F17: os textos fixos do protótipo estão no painel do app', () => {
  for (const t of ['Ajuda do Atlas', '● responde na hora, a qualquer hora', 'Abrir a página certa', 'Ainda não deu', 'Tirar print da tela', 'Anexar imagem', 'Fale ou escreva o que aconteceu…', 'Mensagem para a Ajuda do Atlas', 'A Ajuda do Atlas já abriu ao lado, com o print da tela.', 'falado', 'Algo deu errado ao publicar.', 'Pode falar, escrever ou mandar outro print.', 'Depois eu publico de novo sozinho.']) {
    expect(f).toContain(t)
    expect(tela + ponte).toContain(t)
  }
  expect(f).toContain('Fiz, deu certo')
  expect(tela).toContain('Fiz, deu certo')
})

test('F17: painel de 520 px com estilos próprios, só por tokens', () => {
  expect(f).toContain('width:520px')
  expect(f).toContain('height:72px')
  expect(tela).toContain("import './ajuda.css'")
  expect(tela).toContain('at-ajuda-p__mic')
})

test('F17: sem emoji, sem abrir URL de dado, sem prometer atendimento humano', () => {
  expect(tela + ponte).not.toMatch(/[\u2713\u00D7\u{1F300}-\u{1FAFF}]/u)
  expect(tela).not.toMatch(/window\.open|openExternal|dangerouslySetInnerHTML|href=|<img/)
  // a tela só pede ao adaptador uma página pelo id (lista fechada); nunca passa URL
  expect(tela).toContain('ehPaginaId(')
  expect(tela).not.toMatch(/abrirPagina\([^)]*url/i)
  // a resposta do Claude passa sempre pelo normalizador
  expect(tela).toContain('normalizarResposta(await ajuda.conversar(')
  // texto de produto sem promessa de gente (o filtro PROMETE_HUMANO é a única menção)
  const semFiltro = (tela + ponte).split(/\r?\n/).filter((l) => !/^\s*\/\/|PROMETE_HUMANO =|^\s*\/?\*/.test(l)).join('\n')
  expect(semFiltro).not.toMatch(/atendente|falar com alguém|nossa equipe|suporte humano/i)
})
