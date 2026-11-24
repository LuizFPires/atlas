import canteiroImagem from '../assets/canteiro-3d.jpg'
import { enderecoCanteiroSeguro } from './ponte-painel'

/**
 * Canteiro 3D do painel (F09). SEMPRE 3D, nunca 2D.
 *  - Com o canteiro vivo (servidor local do kit, .claude/canteiro/server.cjs, em 127.0.0.1): mostra a CENA REAL (cena3d.js, Three.js)
 *    num iframe com sandbox. A cena é o código do próprio kit e só conversa com o servidor local; sem `allow-top-navigation`,
 *    `allow-forms`, `allow-popups`. O endereço passa por `enderecoCanteiroSeguro` (só http://127.0.0.1:<porta>).
 *  - Sem canteiro vivo (modo fixture/CI, que não empacota Electron): a imagem 3D de apoio do protótipo.
 * O canteiro do kit abre em 3D (`modo=3d`); o botão 2D dele fica fora do alcance do cliente neste painel (pendência de /entregar:
 * um modo "só 3D" no canteiro).
 */
export function Canteiro3D({ endereco, pct, balao }: { endereco: string | null; pct: number; balao?: { quem: string; texto: string; nivel: string } | null }) {
  const seguro = enderecoCanteiroSeguro(endereco)
  const src = seguro ? `${seguro}${seguro.includes('?') ? '&' : '?'}modo=3d&baloes=0` : null // baloes=0: sem os balões técnicos do kit (M43)
  return (
    <div className="at-pn__canteiro" data-fonte={src ? 'cena-real' : 'imagem'}>
      {src ? (
        <iframe className="at-pn__cena" title="Canteiro em 3D: o prédio da obra subindo, com a equipe de agentes trabalhando ao redor" src={src} sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" />
      ) : (
        <img className="at-pn__cena" src={canteiroImagem} alt="Canteiro em 3D: o prédio da obra subindo, com a equipe de agentes trabalhando ao redor" data-pct={pct} />
      )}
      {/* M41: o balão do canteiro diz a mesma frase do momento (trabalhando, esperando, precisa de você, com defeito). */}
      {balao && <div className={`at-pn__balao at-pn__balao--${balao.nivel}`} role="note" aria-label="O que está acontecendo no canteiro"><b>{balao.quem}</b>{balao.texto}</div>}
      <span className="at-pn__canteiro-rotulo">CANTEIRO 3D · ARRASTE PARA GIRAR</span>
      <span className="at-pn__canteiro-legenda">O prédio sobe a cada tarefa aprovada pelo inspetor de qualidade.</span>
    </div>
  )
}
