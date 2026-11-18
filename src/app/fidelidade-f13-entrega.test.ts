// Fidelidade com o protótipo F13Entrega (nota u13).
// Diferenças conscientes:
//  - o título usa o nome da obra ("Cadeira 1 está no ar."); o protótipo traz o exemplo "A agenda da sua barbearia está no ar.";
//  - o QR do protótipo é um desenho fixo; aqui é gerado localmente do endereço publicado no M22 (qrcode-generator, sem serviço externo);
//  - o endereço "[endereço-da-barbearia].app" do protótipo vira o endereço real (.vercel.app / .com.br), só se http/https do próprio sistema;
//  - sem o sistema no ar (sem adaptador/endereço real) a tela NÃO mostra QR nem link: estado honesto, o título vira "está pronta";
//  - "✓" vira o ícone SVG de traço; os 3 números vêm do painel da obra, e "de obra" (duração) só aparece se existir;
//  - ganhou "Copiar o link" (o protótipo só tem o WhatsApp); "Quero mudar algo" leva à lista de obras até o pós-obra (F14) existir.
import f13 from '../../prototipo/F13Entrega.dc.html?raw'
import entrega from './Entrega.tsx?raw'

const f = f13.replace(/\r\n/g, '\n')

test('F13: os textos fixos do protótipo estão na tela do app', () => {
  for (const t of ['Obra entregue', 'etapas', 'tarefas testadas', 'de obra', 'Aponte a câmera do celular', 'Abre o sistema. Toque em "Adicionar à tela inicial" e ele vira um aplicativo.', 'Mandar para a equipe pelo WhatsApp', 'Quero mudar algo', 'Prédio pronto. O código é seu, guardado no seu GitHub, para sempre.', 'Prédio concluído no canteiro 3D', 'QR code para abrir o sistema no celular']) {
    expect(f).toContain(t)
    expect(entrega).toContain(t)
  }
})

test('F13: o app não usa emoji nem QR/imagem de serviço externo', () => {
  expect(entrega).not.toMatch(/[\u2713\u{1F300}-\u{1FAFF}]/u)
  expect(entrega).not.toMatch(/api\.qrserver|chart\.googleapis|quickchart/)
})
