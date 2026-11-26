import monoEscuro from '../assets/monograma-fundo-escuro.png'
import monoClaro from '../assets/monograma-fundo-claro.png'
import nome from '../assets/nome-atlas.png'
import canteiro from '../assets/canteiro-3d.jpg'

/** Monograma: `fundo` é o fundo onde ele será colocado. */
export function Monograma({ fundo = 'escuro', largura = 44, altura = 24 }: { fundo?: 'escuro' | 'claro'; largura?: number; altura?: number }) {
  return <img src={fundo === 'escuro' ? monoEscuro : monoClaro} alt="" width={largura} height={altura} style={{ objectFit: 'contain' }} />
}

/** Nome em fundo claro é aplicado escurecido (design-system). */
export function NomeAtlas({ fundo = 'escuro', largura = 114, altura = 17 }: { fundo?: 'escuro' | 'claro'; largura?: number; altura?: number }) {
  return <img src={nome} alt="Atlas" width={largura} height={altura} style={{ objectFit: 'contain', filter: fundo === 'claro' ? 'brightness(0.15)' : undefined }} />
}

/** Imagem-assinatura: canteiro 3D com o prédio subindo (no app, a cena real do .claude/canteiro). */
export function ImagemAssinatura({ className, alt = 'Canteiro 3D com o prédio subindo' }: { className?: string; alt?: string }) {
  return <img src={canteiro} alt={alt} className={className} style={{ maxWidth: '100%', borderRadius: 'var(--raio-cartao)' }} />
}
