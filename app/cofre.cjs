// Cofre do app. Segredo NUNCA vai para arquivo em claro (invariante do projeto).
//
// O QUE FAZ: guarda/lê/apaga o token do dispositivo cifrado pelo Windows. Usa `electron.safeStorage`, que no Windows
// usa DPAPI (a chave é amarrada ao usuário do Windows). Escolhido no lugar de addon nativo (keytar/keyring) e de
// PowerShell: não tem dependência nativa, não passa o segredo na linha de comando e é o caminho recomendado pelo Electron.
// No disco fica SÓ o blob cifrado (userData\cofre\<sha256 da chave>.bin); sem o usuário do Windows ele não abre.
// FALHA FECHADA: se o cifrador do SO não estiver disponível, guardar/ler lançam erro (nunca cai em claro nem em arquivo simples).
//
// COMO TESTAR (Windows): `npx electron app/main.cjs`, ativar o app, fechar e abrir de novo: não pede ativação outra vez.
// Abrir o arquivo userData\cofre\*.bin no bloco de notas: deve ser binário ilegível. `ATLAS_COFRE=fixture` = cofre em memória (só teste).
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

function criarCofreMemoria() {
  const m = new Map()
  return {
    async guardar(c, v) { m.set(c, v) },
    async ler(c) { return m.has(c) ? m.get(c) : null },
    async apagar(c) { m.delete(c) },
  }
}

// A chave vira nome de arquivo por hash: nada vindo do renderer chega ao caminho.
const CHAVE_OK = /^[a-z0-9][a-z0-9/_.-]{0,63}$/i

/** `deps` existe para teste: { safeStorage, pasta }. Em produção vem do Electron. */
function criarCofreSafeStorage(deps) {
  const { safeStorage, pasta } = deps
  const arquivo = (chave) => {
    if (typeof chave !== 'string' || !CHAVE_OK.test(chave) || chave.includes('..')) throw new Error('cofre-chave-invalida')
    return path.join(pasta, `${crypto.createHash('sha256').update(chave).digest('hex')}.bin`)
  }
  const pronto = () => {
    if (!safeStorage || !safeStorage.isEncryptionAvailable()) throw new Error('cofre-indisponivel')
    // Em outros SOs o Electron pode cair num "basic_text" sem cofre de verdade: recusa.
    if (typeof safeStorage.getSelectedStorageBackend === 'function' && safeStorage.getSelectedStorageBackend() === 'basic_text') throw new Error('cofre-indisponivel')
  }
  return {
    async guardar(chave, valor) {
      const alvo = arquivo(chave)
      pronto()
      const blob = safeStorage.encryptString(String(valor))
      fs.mkdirSync(pasta, { recursive: true })
      const tmp = `${alvo}.${process.pid}.tmp`
      fs.writeFileSync(tmp, blob, { flag: 'w', mode: 0o600 })
      fs.renameSync(tmp, alvo)
    },
    async ler(chave) {
      const alvo = arquivo(chave)
      pronto()
      let blob
      try { blob = fs.readFileSync(alvo) } catch (e) { if (e.code === 'ENOENT') return null; throw e }
      try { return safeStorage.decryptString(blob) } catch { return null } // blob de outro usuário/corrompido = como se não existisse
    },
    async apagar(chave) {
      const alvo = arquivo(chave)
      try { fs.unlinkSync(alvo) } catch (e) { if (e.code !== 'ENOENT') throw e }
    },
  }
}

function criarCofre(env = process.env, deps = null) {
  if (env.ATLAS_COFRE === 'fixture') return criarCofreMemoria()
  if (deps) return criarCofreSafeStorage(deps)
  const { app, safeStorage } = require('electron')
  return criarCofreSafeStorage({ safeStorage, pasta: path.join(app.getPath('userData'), 'cofre') })
}

module.exports = { criarCofre, criarCofreMemoria, criarCofreSafeStorage }
