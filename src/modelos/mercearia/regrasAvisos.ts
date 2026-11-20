// App-modelo MERCEARIA — regras dos avisos (puras, calculadas da lista de produtos da PortaDados).
import { diasAteValidade, type Produto } from './dados'

/** Abaixo disso (ou igual a zero) o produto entra em "repor". Constante do modelo; configurar por produto é pendência. */
export const ESTOQUE_MINIMO = 5
/** Quantos dias antes do vencimento já avisa. */
export const DIAS_AVISO_VALIDADE = 7

export interface AvisoValidade { produto: Produto; dias: number; vencido: boolean }
export interface Avisos { estoqueBaixo: Produto[]; validade: AvisoValidade[] }

export function calcularAvisos(produtos: Produto[], hoje: string, minimo = ESTOQUE_MINIMO, janela = DIAS_AVISO_VALIDADE): Avisos {
  const estoqueBaixo = produtos.filter((p) => p.quantidade < minimo).sort((a, b) => a.quantidade - b.quantidade || a.nome.localeCompare(b.nome))
  const validade = produtos
    .filter((p) => p.validade !== '')
    .map((p) => { const dias = diasAteValidade(p.validade, hoje); return { produto: p, dias, vencido: dias < 0 } })
    .filter((a) => a.dias <= janela)
    .sort((a, b) => a.dias - b.dias)
  return { estoqueBaixo, validade }
}
