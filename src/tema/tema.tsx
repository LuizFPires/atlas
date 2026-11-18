import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Tema = 'escuro' | 'claro'
const CHAVE = 'atlas.tema'

function inicial(): Tema {
  try {
    return localStorage.getItem(CHAVE) === 'claro' ? 'claro' : 'escuro'
  } catch {
    return 'escuro'
  }
}

const Ctx = createContext<{ tema: Tema; setTema: (t: Tema) => void }>({ tema: 'escuro', setTema: () => {} })

export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(inicial)
  useEffect(() => {
    document.documentElement.dataset.theme = tema
    try {
      localStorage.setItem(CHAVE, tema)
    } catch {
      /* sem armazenamento: segue sem salvar */
    }
  }, [tema])
  return <Ctx.Provider value={{ tema, setTema }}>{children}</Ctx.Provider>
}

export const useTema = () => useContext(Ctx)
