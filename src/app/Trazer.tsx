import { useState } from 'react'
import { Botao, CampoFalado, Icone } from '../ui'
import { linkCurto } from './estilo-dados'
import { normalizarLinkPrototipo, type PonteImportar, type Recebido, type ZipEscolhido } from './ponte-importar'
import type { PonteObras } from './ponte-obras'
import { conferirPacote, LISTA_VERIFICACAO, RECADO } from './trazer-dados'
import './trazer.css'

interface Props {
  obras: PonteObras
  importar: PonteImportar
  onVoltar: () => void
  /** Depois de conferido. A tela de ajustar o protótipo (F07) é do M16; até lá volta às obras. */
  onConcluir?: () => void
}

const MB = (n: number) => `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`

const recadoDoErro = (e: unknown) => {
  switch (e instanceof Error ? e.message : '') {
    case 'tipo-nao-aceito': return 'Esse arquivo não é um .zip. Mande o prototipo-atlas.zip que a outra IA te devolveu.'
    case 'grande-demais': return 'Esse .zip é grande demais (o limite é 50 MB). Peça para a outra IA mandar sem vídeos nem arquivos pesados.'
    case 'muitas-entradas':
    case 'zip-bomba':
    case 'compressao-suspeita': return 'Esse .zip tem coisa demais ou está estranho, então eu não abri por segurança. Peça para a outra IA refazer só com as telas, os textos e as imagens.'
    case 'arquivo-nao-aceito': return 'Tem um arquivo dentro do .zip que eu não aceito (por exemplo um programa). Não abri nada. Peça para a outra IA mandar só telas, textos e imagens.'
    case 'caminho-inseguro':
    case 'link-nao-aceito': return 'O .zip tem um jeito de guardar arquivos que não é seguro, então eu não abri. Peça para a outra IA gerar de novo.'
    case 'zip-vazio': return 'Esse .zip está vazio. Peça para a outra IA mandar de novo.'
    case 'ja-recebido': return 'Essa obra já tem um protótipo guardado. Use outro nome de obra.'
    case 'indisponivel': return 'A importação ainda não está ligada neste computador. Quando estiver, este botão passa a funcionar; por enquanto, não há nada que você precise refazer.'
    default: return 'Não consegui receber esse arquivo agora. Tente de novo em instantes.'
  }
}

/** F06c: trazer um protótipo feito em outra IA. Passo 1: recado para copiar. Passo 2: o .zip e o link que a IA devolveu. */
export function TrazerPrototipo({ obras, importar, onVoltar, onConcluir }: Props) {
  const [copiado, setCopiado] = useState(false)
  const [aviso, setAviso] = useState('')
  const [nome, setNome] = useState('')
  const [zip, setZip] = useState<ZipEscolhido | null>(null)
  const [recebido, setRecebido] = useState<Recebido | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [linkTxt, setLinkTxt] = useState('')
  const [link, setLink] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(RECADO)
      setCopiado(true)
      setAviso('')
    } catch {
      setCopiado(false)
      setAviso('Não consegui copiar sozinho. Selecione o texto do recado, copie e cole na outra conversa.')
    }
  }

  const escolherZip = async () => {
    if (!nome.trim()) { setErro('Primeiro dê um nome para a obra. Pode ser o nome do seu sistema.'); return }
    setErro('')
    setOcupado(true)
    try {
      const z = await importar.escolherZip()
      if (!z) return
      setZip(z)
      await importar.validar(z.token) // só cria a pasta da obra se o pacote passar
      const { pasta } = await obras.criarSubpasta(nome.trim())
      setRecebido(await importar.receber(pasta, z.token))
    } catch (e) {
      setZip(null)
      setRecebido(null)
      setErro(recadoDoErro(e))
    } finally { setOcupado(false) }
  }

  const conferencia = recebido ? conferirPacote(recebido, link) : []

  const anotarLink = () => {
    if (!linkTxt.trim()) return
    const l = normalizarLinkPrototipo(linkTxt)
    if (!l) { setErro('Esse link não parece certo. Cole o endereço completo do protótipo no ar (começa com https).'); return }
    setErro('')
    setLink(l)
  }

  return (
    <div className="at-trazer">
      <div className="at-trazer__col">
        <header className="at-trazer__cab">
          <span className="at-trazer__rotulo">NOVA OBRA · JÁ TENHO UM PROTÓTIPO</span>
          <h1>Fez o protótipo em outra IA? Traga para cá.</h1>
          <span>Vale protótipo feito no Claude, no ChatGPT, no Codex, no Lovable ou em qualquer outra. São 3 passos.</span>
        </header>

        <section className="at-trazer__card" aria-label="Passo 1: o recado">
          <div className="at-trazer__passo"><span className="at-trazer__bola">1</span><b>Copie este recado e mande na conversa onde você fez o protótipo</b></div>
          <pre className="at-trazer__recado" tabIndex={0} aria-label="Recado para a outra IA">{RECADO}</pre>
          <div className="at-trazer__linha">
            <button type="button" className="at-trazer__copiar" onClick={copiar}>
              {copiado && <Icone nome="check" tamanho={16} />}{copiado ? 'Copiado' : 'Copiar recado'}
            </button>
            <span>A IA vai te devolver um arquivo .zip e um link do protótipo no ar.</span>
          </div>
          {aviso && <p className="at-nova__erro" role="alert">{aviso}</p>}
        </section>

        <section className="at-trazer__card" aria-label="Passo 2: o que a IA devolveu">
          <div className="at-trazer__passo"><span className="at-trazer__bola">2</span><b>Traga o que a IA devolveu</b></div>
          <CampoFalado rotulo="Nome da obra" obs="(como você quer chamar o seu sistema)" valor={nome} onChange={setNome} placeholder="Ex.: Agenda da Barbearia do Zé" />
          <div className="at-trazer__dois">
            <button type="button" className={`at-trazer__caixa at-trazer__caixa--zip ${recebido ? '' : 'at-trazer__caixa--vazia'}`} onClick={escolherZip} disabled={ocupado} aria-label="prototipo-atlas.zip: escolher arquivo">
              <Icone nome="caixa" tamanho={22} />
              <span className="at-trazer__caixa-txt">
                <b>{zip?.nome ?? 'prototipo-atlas.zip'}</b>
                <span>{ocupado ? 'Conferindo com cuidado…' : recebido && zip ? `recebido · ${MB(zip.tamanho)}` : 'Escolher o arquivo .zip'}</span>
              </span>
            </button>
            <div className={`at-trazer__caixa ${link ? '' : 'at-trazer__caixa--vazia'}`}>
              <Icone nome="celular" tamanho={22} />
              <span className="at-trazer__caixa-txt">
                <b>{link ? linkCurto(link) : 'Link do protótipo no ar'}</b>
                <span>{link ? 'anotado' : 'Cole o link abaixo'}</span>
              </span>
            </div>
          </div>
          <form className="at-trazer__link" onSubmit={(e) => { e.preventDefault(); anotarLink() }}>
            <CampoFalado rotulo="Link do protótipo" obs="(o endereço que a IA te mandou)" valor={linkTxt} onChange={setLinkTxt} placeholder="agenda-ze.lovable.app" />
            <Botao type="submit" variante="secundario">Anotar link</Botao>
          </form>
          {erro && <p className="at-nova__erro" role="alert">{erro}</p>}
        </section>

        <div className="at-trazer__rodape">
          <Botao variante="secundario" onClick={onVoltar}>← Voltar</Botao>
          <Botao disabled={!recebido} onClick={() => onConcluir ? onConcluir() : onVoltar()}>Abrir no Atlas e ajustar →</Botao>
        </div>
      </div>

      <aside className="at-trazer__lado" aria-label="Passo 3: o Atlas conferiu">
        <div className="at-trazer__passo"><span className="at-trazer__bola">3</span><b>{recebido ? 'O Atlas conferiu o que chegou' : 'O Atlas confere o que chegou'}</b></div>
        {recebido ? (
          <ul className="at-trazer__checks" aria-label="O que chegou">
            {conferencia.map((c) => (
              <li key={c.id} className="at-trazer__check">
                <span className={`at-trazer__check-ic ${c.tipo === 'falta' ? 'at-trazer__check-ic--aviso' : ''}`} aria-label={c.tipo === 'ok' ? 'Tudo certo' : 'Atenção'}>{c.tipo === 'ok' ? <Icone nome="check" tamanho={14} /> : '!'}</span>
                <div><b>{c.titulo}</b><span>{c.txt}</span></div>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <span className="at-trazer__vazio">Assim que o .zip chegar, eu confiro aqui o que veio e o que falta. O que faltar, o Claude completa no mesmo estilo. O .zip precisa ter:</span>
            <ul className="at-trazer__checks" aria-label="O que o .zip deve ter">
              {LISTA_VERIFICACAO.map((i) => (
                <li key={i.id} className="at-trazer__check"><div><b>{i.nome}{i.obrigatorio ? '' : ' (opcional)'}</b><span>{i.desc}</span></div></li>
              ))}
            </ul>
          </>
        )}
        <div className="at-trazer__guardado">
          {recebido
            ? <>Tudo foi guardado na pasta da obra: <b>Atlas\Obras\{recebido.pasta}</b>. Você não precisa mexer nela.</>
            : <>O que chegar fica guardado na pasta da obra, dentro de <b>Atlas\Obras</b>. Você não precisa mexer nela.</>}
        </div>
      </aside>
    </div>
  )
}
