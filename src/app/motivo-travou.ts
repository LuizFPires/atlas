// Por que um comando de avanço da obra não saiu, em português (26/11/2026: antes era sempre "tente de novo").
// Vale para "Corrigir e continuar" (vistoria) e "Pode fazer" (pós-obra). O código vem do processo principal.

/** Motivo em português; `acao` é o nome do botão para tentar de novo e `geral` a frase quando o código é desconhecido. */
export function motivoDoTravamento(codigo: string, acao: string, geral: string): string {
  switch (codigo) {
    case 'ja-rodando': return `Outra obra está trabalhando agora neste computador. Quando ela terminar, toque em ${acao} de novo.`
    case 'sem-licenca': return 'O servidor não reconheceu a licença deste computador. Confira a internet e a assinatura em Conta e tente de novo.'
    case 'plan-invalido': case 'obra-sem-plano': return 'Não consegui acrescentar isto ao plano da obra (o arquivo PLAN.md sumiu ou está danificado). Peça ao Atlas para destravar.'
    case 'obra-com-config-suspeita': return 'Apareceu um arquivo estranho de configuração na pasta da obra, e por segurança o Atlas não mexe nela. Peça ao Atlas para destravar.'
    case 'kit-indisponivel': return 'O servidor do Atlas não entregou as instruções da obra agora. Nada se perdeu: tente de novo em alguns minutos.'
    case 'kit-faltando': return 'O kit de construção não chegou a este computador. Confira a internet e tente de novo.'
    case 'claude-nao-logado': case 'claude-nao-instalado': return 'O Claude não está conectado neste computador. Entre de novo na tela Claude e tente outra vez.'
    default: return `${geral}${codigo ? ` (código: ${codigo.slice(0, 40)})` : ''}`
  }
}
