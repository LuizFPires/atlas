// Fidelidade com os protótipos F10Pausa (nota u10: pausa por cota não é erro; tom calmo, hora de volta, nenhuma ação obrigatória)
// e F11Ocorrencia (nota u11: único tipo de parada que exige o cliente; passo a passo com prints, aviso no celular/e-mail).
// Diferenças conscientes:
//  - F10: "Ao ligar depois das 14h, clique em Continuar obra" virou "a obra continua sozinha" (regra do milestone e S15/S20: retomada
//    sozinha, nenhuma ação do cliente). A hora, o plano (Pro/Max), a etapa e a tarefa vêm da PonteCota; o convite ao Max só no Pro;
//  - F10: quando a cota renova com a tela aberta, aparece "A cota renovou e a obra já voltou sozinha" (o protótipo não desenha);
//  - F10: o "pause" do protótipo é o ícone SVG de traço "pausa" (a bolinha usa SVG, nunca emoji);
//  - F11: o título, o motivo, os passos e o campo vêm da ocorrência do kit (dado, escapado); os 4 passos do protótipo são o fixture;
//  - F11: cada passo mostra um quadro de print (legenda do print; a imagem em si vem do adaptador real); o protótipo não desenha;
//  - F11: "Assista ao vídeo / Ver o vídeo" virou "Abrir a Ajuda do Atlas" (não existe vídeo; nunca prometer atendimento humano);
//  - F11: "Fazer depois (a obra segue sem o WhatsApp)" é genérico ("sem isso"); a bolinha "●" do selo é o ícone SVG de relógio;
//  - F11: o campo da chave é do tipo senha (a chave é segredo e vai ao cofre, nunca a arquivo); sem microfone: chave não se dita;
//  - F11: o selo âmbar usa o token --aviso do design system.
import f10 from '../../prototipo/F10Pausa.dc.html?raw'
import f11 from '../../prototipo/F11Ocorrencia.dc.html?raw'
import { OCORRENCIA_EXEMPLO } from './ponte-ocorrencia'

const p10 = f10.replace(/\r\n/g, '\n')
const p11 = f11.replace(/\r\n/g, '\n')

test('F10: os textos fixos da pausa estão no protótipo', () => {
  for (const t of [
    'OBRA EM PAUSA · NADA A FAZER',
    'A cota do seu plano Claude acabou por agora. A obra volta sozinha às 14h.',
    'Isso é normal no plano Pro. Tudo o que foi feito está salvo',
    'horas até a cota renovar',
    'Voltar ao painel',
    'Quero terminar mais rápido (ver o plano Max)',
    'Avisamos no seu celular quando a obra voltar.',
  ]) expect(p10).toContain(t)
})

test('F11: os textos fixos e o exemplo da ocorrência estão no protótipo', () => {
  for (const t of [
    'A obra precisa de você · 5 minutos',
    'Conecte o WhatsApp da barbearia',
    'Só você pode criar, porque é a sua conta. O resto da obra continua enquanto isso.',
    'Já colei a chave: continuar',
    'ONDE COLAR A CHAVE',
    'Chave do WhatsApp Business',
    'Fica guardada só no seu computador e na sua conta. O Atlas não vê.',
    'Travou em algum passo?',
    'Também mandamos este passo a passo para o seu e-mail e celular.',
  ]) expect(p11).toContain(t)
  for (const p of OCORRENCIA_EXEMPLO.passos) {
    expect(p11).toContain(p.titulo)
    expect(p11).toContain(p.desc)
  }
  expect(OCORRENCIA_EXEMPLO.campo?.rotulo).toBe('Chave do WhatsApp Business')
})
