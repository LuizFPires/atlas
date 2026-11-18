import { useEffect } from 'react'
import type { PonteDesktop } from './ponte'

/** O computador é o canteiro: enquanto `ativo` (instalando ou em obra), ele não pode dormir. Solta ao sair. */
export function useImpedirSono(ponte: Pick<PonteDesktop, 'impedirSono'>, ativo: boolean) {
  useEffect(() => {
    if (!ativo) return
    void ponte.impedirSono(true)
    return () => { void ponte.impedirSono(false) }
  }, [ponte, ativo])
}
