// Senha do dono criada no próprio Atlas (Guilherme, 28/11/2026: "não funcionou o reset de senha"). Protótipo aprovado pelo Luiz
// em 28/11/2026 (tela 1). O e-mail padrão do Supabase só chega à equipe do projeto; aqui a senha vai direto para a conta do
// sistema, sem e-mail. A senha só existe neste formulário e na chamada: não é guardada pelo Atlas.
import { useState } from 'react'

interface Props {
  acesso: { email: string; novo: boolean; senha?: boolean }
  endereco?: string | null
  definirSenha?: (senha: string) => Promise<unknown>
}

const ERROS: Record<string, string> = {
  'senha-curta': 'A senha precisa ter 8 letras ou mais.',
  'senha-longa': 'Essa senha é longa demais. Use uma mais curta.',
  'supabase-sem-chave': 'A conta do Supabase não está ligada neste computador. Ligue em Contas ligadas e tente de novo.',
  'sem-acesso': 'Não achei a sua conta no sistema. Toque em "Colocar no ar" de novo para o Atlas criar.',
}

export function AcessoDoDono({ acesso, endereco, definirSenha }: Props) {
  const [s1, setS1] = useState('')
  const [s2, setS2] = useState('')
  const [ver, setVer] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [pronta, setPronta] = useState(!!acesso.senha)
  const [trocando, setTrocando] = useState(false)
  const tamanho = s1.length >= 8
  const iguais = s1.length > 0 && s1 === s2
  const salvar = async () => {
    if (!definirSenha || !tamanho || !iguais) return
    setSalvando(true); setErro('')
    try { await definirSenha(s1); setPronta(true); setTrocando(false); setS1(''); setS2('') } catch (e) {
      const c = e instanceof Error ? e.message : String(e)
      setErro(ERROS[c] ?? 'Não consegui salvar a senha agora. Confira a internet e tente de novo.')
    } finally { setSalvando(false) }
  }

  if (pronta && !trocando) {
    return (
      <section className="at-noar__card at-acd at-acd--ok" aria-label="Seu acesso">
        <span className="at-noar__rot at-acd__rot-ok">SEU ACESSO DE DONO</span>
        <div className="at-acd__ok">
          <span className="at-acd__ic" aria-hidden="true">✓</span>
          <div>
            <b>Senha criada.</b>
            <span>Entre no sistema com <b>{acesso.email}</b> e a senha que você criou. A sua equipe você coloca em Usar o sistema → Pessoas da equipe.</span>
          </div>
        </div>
        <div className="at-acd__pe">
          {definirSenha && <button type="button" className="at-acd__sec" onClick={() => { setTrocando(true); setErro('') }}>Trocar a senha</button>}
          {endereco && <a className="at-acd__prim" href={endereco} target="_blank" rel="noopener noreferrer">Abrir o sistema ↗</a>}
        </div>
      </section>
    )
  }
  if (!definirSenha) {
    return (
      <section className="at-noar__card at-acd" aria-label="Seu acesso">
        <span className="at-noar__rot">SEU ACESSO DE DONO</span>
        <b className="at-acd__email">{acesso.email}</b>
        <span className="at-acd__txt">Atualize o Atlas para criar a sua senha por aqui.</span>
      </section>
    )
  }
  return (
    <section className="at-noar__card at-acd" aria-label="Seu acesso">
      <span className="at-noar__rot">SEU ACESSO DE DONO</span>
      <b className="at-acd__email">{acesso.email}</b>
      <span className="at-acd__txt">{trocando ? 'Escolha a nova senha.' : 'Crie aqui a senha que você vai usar para entrar no sistema. Não precisa esperar e-mail.'}</span>
      <label className="at-acd__campo">
        <span>Senha</span>
        <span className={`at-acd__inp${tamanho ? ' at-acd__inp--ok' : ''}`}>
          <input type={ver ? 'text' : 'password'} value={s1} onChange={(e) => setS1(e.target.value)} autoComplete="new-password" aria-label="Senha" />
          <button type="button" onClick={() => setVer((v) => !v)}>{ver ? 'esconder' : 'mostrar'}</button>
        </span>
      </label>
      <label className="at-acd__campo">
        <span>Repita a senha</span>
        <span className={`at-acd__inp${iguais ? ' at-acd__inp--ok' : ''}`}>
          <input type={ver ? 'text' : 'password'} value={s2} onChange={(e) => setS2(e.target.value)} autoComplete="new-password" aria-label="Repita a senha" onKeyDown={(e) => { if (e.key === 'Enter') void salvar() }} />
        </span>
      </label>
      <div className="at-acd__regras" aria-live="polite">
        <span className={tamanho ? 'at-acd__v' : ''}>{tamanho ? '✓' : '·'} 8 letras ou mais</span>
        <span className={iguais ? 'at-acd__v' : ''}>{iguais ? '✓' : '·'} as duas iguais</span>
      </div>
      {erro && <span className="at-acd__erro" role="alert">{erro}</span>}
      <div className="at-acd__pe">
        <span className="at-acd__nota">O Atlas grava a senha direto na sua conta do sistema e não guarda em lugar nenhum.</span>
        {trocando && <button type="button" className="at-acd__sec" onClick={() => setTrocando(false)}>Voltar</button>}
        <button type="button" className="at-acd__prim" disabled={!tamanho || !iguais || salvando} onClick={() => void salvar()}>{salvando ? 'Salvando…' : 'Salvar senha'}</button>
      </div>
    </section>
  )
}
