// Fidelidade com o protótipo F14PosObra (nota u14).
// Diferenças conscientes:
//  - o nome da obra no rótulo vem da obra aberta; o protótipo traz o exemplo "AGENDA DA BARBEARIA DO ZÉ";
//  - o texto de exemplo do campo e o plano ("feriados") são do protótipo; no app o plano vem do Claude (mock em fixture);
//  - o "Pode fazer" do protótipo é um link para o painel; aqui ele primeiro CONFERE A LICENÇA (S4 /verificar), roda a correção
//    e só então oferece "Ver como está indo". Sem licença em dia, nada roda e aparece um recado calmo (invariante, ausente do protótipo);
//  - "Anexar print" funciona (PonteArquivos; só imagens, SVG recusado); o botão "Enviar para o Claude" só liga com texto ou print;
//  - o histórico vem da porta (no protótipo é fixo); "Para conferir"/"No ar" mantidos.
import f14 from '../../prototipo/F14PosObra.dc.html?raw'
import tela from './PosObra.tsx?raw'
import posobra from './ponte-posobra.ts?raw'

const f = f14.replace(/\r\n/g, '\n')

test('F14: os textos fixos do protótipo estão na tela do app', () => {
  for (const t of ['O que você quer mudar?', 'Quero mudar algo', 'Algo não funciona', 'Aperte e fale, como se contasse para um amigo no restaurante', 'Ou escreva, se preferir. O Atlas escreve o que você falar aqui embaixo.', 'Anexar print', 'Enviar para o Claude', 'O CLAUDE ENTENDEU ASSIM', 'O sistema no ar só muda quando você aprovar.', 'Pode fazer', 'Não é isso', 'PEDIDOS ANTERIORES', 'Todo pedido vira uma versão de teste. O sistema no ar só muda quando você confere e clica em']) {
    expect(f).toContain(t)
    expect(tela + posobra).toContain(t)
  }
  for (const t of ['Cor do botão de marcar', 'Lembrete 2 h antes', 'Relatório de comissão', 'Para conferir', 'No ar']) {
    expect(f).toContain(t)
    expect(tela + posobra).toContain(t)
  }
})

test('F14: sem emoji, sem abrir link vindo de dado e a licença é conferida antes de executar', () => {
  expect(tela + posobra).not.toMatch(/[\u2713\u{1F300}-\u{1FAFF}]/u)
  expect(tela).not.toMatch(/window\.open|openExternal|dangerouslySetInnerHTML|href=/)
  // A tela só executa por executarComLicenca; nunca chama posobra.executar direto.
  expect(tela).toContain('executarComLicenca(')
  expect(tela).not.toMatch(/posobra\.executar\(/)
})
