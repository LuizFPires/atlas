// Cofre do app. Segredo NUNCA vai para arquivo (invariante do projeto).
// PENDENTE /entregar: adaptador real do Windows Credential Manager / DPAPI (addon nativo, ex.: @napi-rs/keyring).
// Enquanto isso só existe o cofre EM MEMÓRIA (some ao fechar o app) e o app falha fechado se
// ATLAS_COFRE=fixture não estiver ligado: nunca cai em arquivo "por conveniência".
'use strict'

function criarCofreMemoria() {
  const m = new Map()
  return {
    async guardar(c, v) { m.set(c, v) },
    async ler(c) { return m.has(c) ? m.get(c) : null },
    async apagar(c) { m.delete(c) },
  }
}

function criarCofre(env = process.env) {
  if (env.ATLAS_COFRE === 'fixture') return criarCofreMemoria()
  // TODO(/entregar): return criarCofreCredentialManager()
  throw new Error('Cofre do Windows ainda não ligado (pendente de /entregar). Use ATLAS_COFRE=fixture só para teste.')
}

module.exports = { criarCofre, criarCofreMemoria }
