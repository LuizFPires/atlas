import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { ContasProntas, todasLigadas } from './ContasProntas'
import type { SituacaoContas } from './ponte-ligar-contas'

const tudo: SituacaoContas = { github: { ligado: true, usuario: 'appbomdia' }, supabase: { ligado: true, usuario: null }, hosp: { ligado: true, usuario: 'luiz-pires' } }

test('todas ligadas só quando GitHub, Supabase e Vercel estão ligados', () => {
  expect(todasLigadas(tudo)).toBe(true)
  expect(todasLigadas({ ...tudo, hosp: { ligado: false, usuario: null } })).toBe(false)
  expect(todasLigadas(null)).toBe(false)
})

test('segunda obra: mostra as contas já ligadas e segue com um clique (sem passo a passo de criar conta)', async () => {
  const onContinuar = vi.fn()
  const onOutras = vi.fn()
  render(<TemaProvider><ContasProntas situacao={tudo} onContinuar={onContinuar} onOutras={onOutras} /></TemaProvider>)
  expect(screen.getByText('As suas contas já estão ligadas neste computador.')).toBeInTheDocument()
  expect(screen.getByText(/ligado como appbomdia/)).toBeInTheDocument()
  expect(screen.getByText(/ligado como luiz-pires/)).toBeInTheDocument()
  expect(screen.queryByText(/O GitHub é um cofre/)).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Continuar →' }))
  expect(onContinuar).toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Quero usar outras contas nesta obra' }))
  expect(onOutras).toHaveBeenCalled()
})
