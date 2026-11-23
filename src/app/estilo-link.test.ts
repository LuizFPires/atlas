// Link de referência colado pelo cliente: links de anúncio vêm cheios de rastreio (utm_..., fbclid). O Atlas limpa e aceita.
import { normalizarLink } from './estilo-dados'

const PIERRE = 'https://lp.pierre.finance/lp/converse?utm_campaign=PIERRE_CONVERSAO_LEADS_ADV_2026&utm_source=facebook&utm_medium=paid_social&utm_content=video_depoimento_cliente_satisfeito_v3_final&utm_term=publico_lookalike_1pct_investidores&fbclid=IwZXh0bgNhZW0BMABhZGlkAasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasd&gclid=abc123'

test('link de anúncio com rastreio longo: aceita e tira o rastreio', () => {
  expect(normalizarLink(PIERRE)).toBe('https://lp.pierre.finance/lp/converse')
})

test('mantém os parâmetros que não são de rastreio', () => {
  expect(normalizarLink('loja.com/busca?q=tenis&utm_source=x')).toBe('https://loja.com/busca?q=tenis')
})

test('link enorme mesmo sem rastreio: fica só o endereço da página', () => {
  expect(normalizarLink(`https://site.com/pagina?dados=${'a'.repeat(800)}`)).toBe('https://site.com/pagina')
})

test('continua recusando o que não é site', () => {
  for (const ruim of ['javascript:alert(1)', 'ftp://x.com', 'oi', 'https://user:senha@x.com']) expect(normalizarLink(ruim)).toBeNull()
})
