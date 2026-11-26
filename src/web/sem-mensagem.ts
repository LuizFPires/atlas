// O Atlas é autoexplicativo (26/11/2026): quando o servidor recusa sem mandar uma frase pronta, a tela ainda diz o que houve
// e o que fazer, com o código do retorno para a Ajuda do Atlas saber exatamente o que foi.

/** Frase para um retorno sem mensagem do servidor (status HTTP). */
export function semMensagem(status: number): string {
  if (status === 429) return 'Muitas tentativas seguidas. Espere uns 10 minutos e tente de novo.'
  if (status >= 500) return `O servidor do Atlas teve um problema (não foi nada que você fez). Tente de novo em alguns minutos; se continuar, use a Ajuda do Atlas (código ${status}).`
  return `O servidor do Atlas não aceitou o pedido (código ${status}). Confira o que foi preenchido e tente de novo; se continuar, use a Ajuda do Atlas.`
}
