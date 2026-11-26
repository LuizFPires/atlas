// O que a Ajuda do Atlas (F17) recebe quando o cliente toca em "Não consegui fazer este passo":
// o "print" do passo (a imagem do site que ele estava vendo) e onde ele parou. Sem senha, sem dado pessoal.
export interface PedidoAjudaPasso {
  origem: 'F04' | 'F13b' | 'guia'
  conta: string
  passo: number
  totalPassos: number
  print: { url: string; titulo: string; botaoCerto?: string }
  /** Guias com o site ao lado (M58): o que o passo pede e o que já se sabe dos problemas comuns daquele site. */
  instrucao?: string
  saber?: string
}
