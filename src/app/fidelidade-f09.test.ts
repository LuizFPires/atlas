// Fidelidade com o protótipo F09Painel (nota u09: o cliente não lê código; o prédio, o % e o "agora na obra" bastam;
// detalhes técnicos atrás de "ver detalhes").
// Diferenças conscientes:
//  - ESTENDE o protótipo com o MODO DA OBRA (automático ou passo a passo, M18): uma faixa "MODO DA OBRA" mostra o modo ativo e deixa
//    trocar a qualquer momento; no passo a passo, ao fim de cada etapa aparece o cartão "Pode seguir". Decisão do usuário de 18/11;
//  - o "Salvo há 12 s" do protótipo virou "Salvo a cada passo" (o app não mede o tempo do último salvamento);
//  - o "✓" do círculo da faixa de obra pronta é o ícone SVG de traço "check" (CLAUDE.md: sem emoji/símbolo em texto);
//  - a linha "Simular no protótipo" (cota acabou, precisa de você, desligou o PC, obra concluída) só existia para navegar entre telas
//    do protótipo: no app vira o `simular` do fixture e as paradas reais mostram o selo e o aviso (F10/F11/F12 são de outros milestones);
//  - "AGORA NA OBRA" e o prazo (FALTA, PREVISÃO) vêm da PontePainel; os exemplos do protótipo (IM/QA/FI) são o fixture;
//  - "X de 50 tarefas" é "X de N tarefas" (N lido do PLAN da obra);
//  - a imagem do canteiro só aparece sem canteiro vivo; com ele, a cena real (cena3d.js) entra num iframe com sandbox;
//  - "Ver detalhes" (nota u09) é o botão que mostra as etapas e suas tarefas; o protótipo não desenha esse botão.
import proto from '../../prototipo/F09Painel.dc.html?raw'
import { momentoDaObra } from './momento-obra'
import { TEXTO_MODO } from './ponte-construcao'

const protoLF = proto.replace(/\r\n/g, '\n')

test('textos fixos da tela batem com o protótipo', () => {
  for (const t of [
    'OBRA 1 DE 1',
    'Agenda da Barbearia do Zé',
    'AVANÇO DA OBRA',
    'ETAPA',
    'FALTA',
    'PREVISÃO',
    'AGORA NA OBRA',
    'Equipe de execução',
    'Inspetor de qualidade',
    'Fiscal',
    'Pausar obra',
    'Continuar obra',
    'Ver como ficou',
    'Ver versão de teste',
    'Obra pronta! Falta só escolher onde o seu sistema vai morar.',
    'Endereço grátis, domínio próprio, app no celular ou nas lojas. Você escolhe no próximo passo.',
    'Publicar o sistema →',
    'CANTEIRO 3D · ARRASTE PARA GIRAR',
    'O prédio sobe a cada tarefa aprovada pelo inspetor de qualidade.',
    'pode desligar o computador quando quiser',
    'nenhuma pendência sua',
  ]) expect(protoLF).toContain(t)
})

// M41 (O1–O4 aprovados em 24/11/2026) substitui o selo "Obra em andamento" da F09 pelos 4 estados (PLAN.md, Notas da M41).
test('os selos de estado: os 4 estados da M41, mais pausada e concluída da F09', () => {
  expect(protoLF).toContain('Pausada por você')
  expect(protoLF).toContain('Obra concluída')
  const sit = { pct: 10, tarefas: 1, feitas: 0, etapa: null, etapas: [], restante: null, previsao: null, agora: [], pausadaPorVoce: false, parada: null, etapaPronta: null, temTeste: false }
  expect(momentoDaObra({ ...sit, pausadaPorVoce: true }, 'pausada').selo).toBe('Pausada por você')
  expect(momentoDaObra({ ...sit, pct: 100 }, 'concluida').selo).toBe('Obra concluída')
  expect(momentoDaObra({ ...sit, agora: [{ sigla: 'IM', quem: 'x', oque: 'y', tom: 'ativo' }] }, 'andando').selo).toBe('Trabalhando')
})

test('o modo da obra (extensão ao protótipo) tem texto de leigo, sem tokens nem jargão', () => {
  for (const m of Object.values(TEXTO_MODO)) expect(`${m.titulo} ${m.explica}`).not.toMatch(/token|json|PLAN\.md|commit|milestone/i)
})
