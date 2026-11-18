// Fidelidade com o protótipo F12Retomar (nota u12: ao ligar o computador o Atlas abre sozinho nesta tela; um botão só; retomar em até 2 cliques).
// Diferenças conscientes:
//  - o nome do cliente, a obra, o progresso, a etapa e a hora em que parou vêm da PonteRetomar (dado, escapado); o protótipo traz o exemplo do Zé;
//  - "BOM DIA" muda com a hora (BOA TARDE / BOA NOITE); o protótipo mostra só o da manhã;
//  - "✓" do protótipo é o ícone SVG de traço "check" (nunca emoji/caractere); o play do botão é o SVG "play";
//  - "Continuar obra" religa a linha pelas portas (PontePainel/PonteCota) e leva ao painel (F09), no lugar do link estático do protótipo;
//  - sem a hora da parada, o título diz "ficou parada quando o computador foi desligado" (o protótipo sempre tem a hora);
//  - se religar falhar, um recado calmo aparece e o botão deixa tentar de novo (o protótipo não desenha).
import f12 from '../../prototipo/F12Retomar.dc.html?raw'
import fonte from './Retomar.tsx?raw'

const p12 = f12.replace(/\r\n/g, '\n')

test('F12: os textos fixos da tela estão no protótipo e na tela do app', () => {
  for (const t of [
    'Nada se perdeu. Ela continua exatamente dali.',
    'Continuar obra',
    'Agora não',
    'O Atlas abre sozinho quando você liga o computador. Para desligar isso: Configurações → Abrir com o Windows.',
    'Canteiro 3D da obra, parado onde ficou',
  ]) {
    expect(p12).toContain(t)
    expect(fonte).toContain(t)
  }
  expect(p12).toContain('quando o computador foi desligado.')
  expect(fonte).toContain('quando o computador foi desligado.')
})

test('F12: o botão leva ao painel (F09) e "Agora não" a Minhas obras (F05), como no protótipo', () => {
  expect(p12).toContain('href="F09Painel.dc.html"')
  expect(p12).toContain('href="F05Obras.dc.html"')
})

test('F12: um botão principal só, ícone SVG e sem emoji', () => {
  expect((p12.match(/Continuar obra/g) ?? []).length).toBe(1)
  expect(fonte).toContain('<Icone nome="play"')
  expect(fonte).not.toMatch(/\p{Extended_Pictographic}/u)
})
