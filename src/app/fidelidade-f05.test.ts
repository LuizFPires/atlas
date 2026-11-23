// Fidelidade com os protótipos F05Obras e F06NovaObra: os textos que o cliente lê são os mesmos das telas desenhadas.
// Diferenças conscientes: o app usa ícone SVG no lugar de "✓"/"+" e não desenha a onda do áudio nem o contador "0:42".
import f05 from '../../prototipo/F05Obras.dc.html?raw'
import f06 from '../../prototipo/F06NovaObra.dc.html?raw'
import { ETAPAS_CASA, IDEIAS, PERGUNTAS } from './obras-dados'

test('F05: etapas da casa e ideias batem com o protótipo', () => {
  for (const e of ETAPAS_CASA) {
    expect(f05).toContain(`n: '${e.n}', nome: '${e.nome}'`)
    expect(f05).toContain(`casa: '${e.casa}'`)
    expect(f05).toContain(`atlas: '${e.atlas}'`)
  }
  for (const i of IDEIAS) expect(f05).toContain(`nome: '${i.nome}', desc: '${i.desc}'`)
})

test('F05: textos fixos', () => {
  for (const t of [
    'MINHAS OBRAS',
    'Fazer um sistema é igual construir uma casa.',
    'Veja como é parecido:',
    'NUMA CASA',
    'NO ATLAS',
    'Quem trabalha na obra é o <b style="color:{{t.text}}">Claude</b>: um constrói, outro confere, outro fiscaliza. Você só decide e acompanha.',
    'PRIMEIRO PASSO: O PROJETO',
    'Comece a sua primeira obra',
    'Conte, com as suas palavras, o que a sua barbearia precisa. O Claude desenha as telas junto com você. Nada é construído antes de você aprovar.',
    'Começar do zero →',
    'Já tenho um protótipo',
    'IDEIAS PARA BARBEARIAS · ESCOLHA UMA PARA COMEÇAR',
    'Cada obra vira um sistema separado, com o seu próprio endereço. Todas ficam guardadas na pasta',
    'Atlas\\Obras',
    'Abrir a pasta',
  ]) expect(f05).toContain(t)
  expect(f05).toContain('Tudo pronto, Zé. Agora vamos construir.')
})

test('F06: textos do microfone e do painel batem com o protótipo (quem usa: sem opções prontas, decisão M13)', () => {
  expect(f06).toContain(PERGUNTAS[2].titulo)
  for (const t of [
    'NOVA OBRA · PERGUNTA 3 DE 5',
    'Aperte e fale, como se contasse para um amigo na mesa de um restaurante.',
    'Não precisa falar bonito. Conte como funciona hoje e o que te incomoda. O Atlas escreve tudo para você.',
    'Pode falar, estou ouvindo.',
    'Fale do seu jeito, sem pressa, como num papo de restaurante. Pode errar e voltar atrás: o Atlas entende.',
    'Aperte de novo para terminar',
    'O Atlas escreveu assim. Pode corrigir se quiser:',
    'Prefere escrever?',
    'Digitar em vez de falar',
    'Voltar',
    'Próxima pergunta',
    'O QUE O ATLAS JÁ ENTENDEU',
    'Nome da obra',
    'O problema',
    'Quem usa',
    'Ainda não definido',
    'Nada aqui é definitivo. No protótipo você vê as telas e muda o que quiser.',
  ]) expect(f06).toContain(t)
  expect(PERGUNTAS).toHaveLength(5)
})
