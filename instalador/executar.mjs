// Entry real do instalador: roda a MESMA lógica testada (passos.ts) com executor de verdade.
// Uso (feito por instalar.ps1): node --experimental-strip-types executar.mjs
import { spawn } from 'node:child_process'
import { userInfo } from 'node:os'
import { rodarInstalacao } from './passos.ts'

const exec = {
  roda: (comando) =>
    new Promise((resolve) => {
      const p = spawn(comando, { shell: true, stdio: 'inherit' })
      p.on('error', () => resolve({ codigo: 1 }))
      p.on('close', (c) => resolve({ codigo: c ?? 1 }))
    }),
}

const codigo = await rodarInstalacao(userInfo().username, exec, (m) => console.log(m))
process.exit(codigo)
