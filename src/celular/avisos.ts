// M41 — aviso no celular (Web Push). O dono liga uma vez neste celular; o notebook avisa quando a cota do Claude volta, quando
// a obra para ou fica pronta. Só sai do celular o endereço do serviço de aviso do navegador e as chaves públicas da assinatura.

export type SituacaoAvisos = 'sem-suporte' | 'iphone-tela-inicio' | 'bloqueado' | 'ligado' | 'pode-ligar'

export function situacaoDosAvisos(a: { suporta: boolean; permissao: NotificationPermission; iphone: boolean; instalado: boolean; assinado?: boolean }): SituacaoAvisos {
  if (a.iphone && !a.instalado) return 'iphone-tela-inicio' // no iPhone, só o Atlas adicionado à Tela de Início recebe avisos
  if (!a.suporta) return 'sem-suporte'
  if (a.permissao === 'denied') return 'bloqueado'
  if (a.permissao === 'granted' && a.assinado) return 'ligado'
  return 'pode-ligar'
}

/** Chave pública VAPID (base64url) em bytes, como o navegador pede. */
export function chaveEmBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (b64url + '='.repeat((4 - (b64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const bytes = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export async function ligarAvisos(d: {
  pedirPermissao: () => Promise<NotificationPermission>
  chave: () => Promise<string>
  assinar: (o: { userVisibleOnly: true; applicationServerKey: Uint8Array<ArrayBuffer> }) => Promise<{ toJSON(): unknown }>
  enviar: (assinatura: unknown) => Promise<void>
}): Promise<'ligado' | 'bloqueado'> {
  if ((await d.pedirPermissao()) !== 'granted') return 'bloqueado'
  const sub = await d.assinar({ userVisibleOnly: true, applicationServerKey: chaveEmBytes(await d.chave()) })
  await d.enviar(sub.toJSON())
  return 'ligado'
}

/** O ambiente real do navegador (fora dos testes). */
export function ambienteDoNavegador() {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined
  const suporta = !!nav && 'serviceWorker' in nav && typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window
  const iphone = !!nav && /iPhone|iPad|iPod/.test(nav.userAgent)
  const instalado = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (nav as unknown as { standalone?: boolean })?.standalone === true)
  const permissao: NotificationPermission = suporta ? Notification.permission : 'default'
  return { suporta, iphone, instalado: !!instalado, permissao }
}
