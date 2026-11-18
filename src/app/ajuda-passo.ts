// O que a Ajuda do Atlas (F17) recebe quando o cliente toca em "Não consegui fazer este passo":
// o "print" do passo (a imagem do site que ele estava vendo) e onde ele parou. Sem senha, sem dado pessoal.
export interface PedidoAjudaPasso {
  origem: 'F04' | 'F13b'
  conta: string
  passo: number
  totalPassos: number
  print: { url: string; titulo: string; botaoCerto?: string }
}
