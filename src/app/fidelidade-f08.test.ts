// Fidelidade com o protótipo F08Aprovar (nota u08: antes de começar, mostrar etapas, prazo e quanto do plano a obra usa;
// deixar claro que depois de começar ainda dá para ajustar).
// Diferenças conscientes:
//  - ESTENDE o protótipo com a escolha do MODO da obra (automático em destaque, ou aprovar cada etapa): decisão do usuário de 18/11,
//    registrada no PLAN (M18); a UI do seletor segue o design system;
//  - os ✓ do protótipo são o ícone SVG de traço "check" (CLAUDE.md: sem emoji/ícone em texto);
//  - o aviso das lojas (D-U-N-S, 12 testadores / 14 dias, S14) ganhou um cartão próprio; a frase do protótipo ("Avise já: a papelada das
//    lojas leva alguns dias, e o Atlas adianta durante a obra") está nele;
//  - a nota u08 pede "depois de começar ainda dá para ajustar": ganhou uma linha própria, além de "Ajustes entram no pós-obra";
//  - a previsão compara com o OUTRO plano ("No Max seria..."/"No Pro seria...") conforme o plano detectado; as 8 etapas e os prazos
//    de exemplo são os do protótipo e vêm da PonteConstrucao (o real vem do Claude lendo telas.md/regras.md);
//  - "Começar a obra" gera o PLAN.md e dispara a construção (PonteConstrucao); o protótipo só liga para o painel (F09, M19);
//    o rótulo "PREVISÃO NO SEU PLANO (PRO)" é calculado do plano detectado.
import proto from '../../prototipo/F08Aprovar.dc.html?raw'
import { ETAPAS_EXEMPLO, PREVISAO_EXEMPLO } from './ponte-construcao'

const protoLF = proto.replace(/\r\n/g, '\n')

test('textos fixos da tela batem com o protótipo', () => {
  for (const t of [
    'PROTÓTIPO APROVADO · VERSÃO 3',
    'Pronto para a obra. Confira antes de começar.',
    'O QUE VAI SER CONSTRUÍDO',
    'PREVISÃO NO SEU PLANO',
    'com pausas da cota',
    'Você pode deixar rodando à noite: a obra pausa e volta sozinha.',
    'Combinado antes de começar',
    'Você pode pausar quando quiser.',
    'Pode desligar o computador: a obra é salva a cada passo.',
    'Mudou de ideia? Ajustes entram no pós-obra, sem perder nada.',
    'Quer o app na App Store ou no Google Play?',
    'a papelada das lojas leva alguns dias, e o Atlas adianta durante a obra.',
    'Voltar ao protótipo',
    'Começar a obra',
  ]) expect(protoLF).toContain(t)
})

test('as 8 etapas de exemplo e a previsão são as do protótipo', () => {
  expect(ETAPAS_EXEMPLO).toHaveLength(8)
  for (const e of ETAPAS_EXEMPLO) for (const campo of [e.n, e.nome, e.desc]) expect(protoLF).toContain(campo)
  expect(protoLF).toContain('≈ 2 dias')
  expect(protoLF).toContain('No Max seria cerca de 1 dia.')
  expect(PREVISAO_EXEMPLO.pro.dias).toBe(2)
  expect(PREVISAO_EXEMPLO.max.dias).toBe(1)
})
