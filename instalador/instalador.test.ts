import { describe, expect, it } from 'vitest'
import config from './electron-builder.json'
import nsh from './atlas-install.nsh?raw'
import ps1 from './instalar.ps1?raw'
import { atalhoAreaDeTrabalho, pastaObras, pastaObrasSegura } from './caminhos.ts'
import { executarPlano, planoDeInstalacao, telaInicial } from './passos.ts'

describe('caminhos', () => {
  it('monta a pasta das obras a partir do usuário', () => {
    expect(pastaObras('Maria')).toBe('C:\\Users\\Maria\\Atlas\\Obras')
  })
  it('rejeita usuário inválido', () => {
    expect(() => pastaObras('')).toThrow()
    expect(() => pastaObras('a\\b')).toThrow()
  })
  it('recusa Desktop, Documentos e OneDrive', () => {
    expect(pastaObrasSegura(pastaObras('Maria'))).toBe(true)
    expect(pastaObrasSegura('C:\\Users\\M\\Desktop\\Atlas\\Obras')).toBe(false)
    expect(pastaObrasSegura('C:\\Users\\M\\OneDrive\\Obras')).toBe(false)
    expect(pastaObrasSegura('C:\\Users\\M\\Documents\\Obras')).toBe(false)
  })
  it('atalho na área de trabalho', () => {
    expect(atalhoAreaDeTrabalho('C:\\Users\\M\\Desktop\\')).toBe('C:\\Users\\M\\Desktop\\Atlas · minhas obras.lnk')
  })
})

describe('plano de instalação', () => {
  it('ordem: node, claude, plugin, obras, app, ativação', () => {
    expect(planoDeInstalacao('Maria').map((p) => p.id)).toEqual(['node', 'claude-code', 'plugin', 'obras', 'app', 'ativacao'])
  })
  it('termina abrindo a F02', () => {
    const ultimo = planoDeInstalacao('Maria').at(-1)!
    expect(ultimo.comando).toContain('--tela=F02')
    expect(telaInicial([])).toBe('F02')
    expect(telaInicial(['--tela=F12'])).toBe('F12')
  })
  it('pula o que já está pronto e para no primeiro erro', async () => {
    const vistos: string[] = []
    const r = await executarPlano(planoDeInstalacao('Maria'), {
      roda: async (c) => {
        vistos.push(c)
        if (c === 'node --version') return { codigo: 0 }
        if (c === 'claude --version') return { codigo: 1 }
        if (c.startsWith('npm install')) return { codigo: 1 }
        return { codigo: 0 }
      },
    })
    expect(r.pulados).toEqual(['node'])
    expect(r.falhou).toBe('claude-code')
    expect(vistos.some((c) => c.includes('plugin'))).toBe(false)
  })
})

describe('config do electron-builder e scripts', () => {
  it('usa NSIS e Azure Trusted Signing sem segredos no arquivo', () => {
    expect(config.win.target[0].target).toBe('nsis')
    expect(config.nsis.include).toBe('instalador/atlas-install.nsh')
    const txt = JSON.stringify(config.win.azureSignOptions)
    expect(txt).toContain('${env.')
    expect(txt).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/)
  })
  it('include NSIS cria obras fora de Desktop/Documentos e abre F02', () => {
    expect(nsh).toContain('$PROFILE\\Atlas\\Obras')
    expect(nsh).not.toMatch(/\$(DOCUMENTS|DESKTOP)\\Atlas\\/)
    expect(nsh).toContain('Atlas · minhas obras.lnk')
    expect(nsh).toContain('--tela=F02')
  })
  it('script instala Node, Claude Code e plugin', () => {
    expect(ps1).toContain('OpenJS.NodeJS.LTS')
    expect(ps1).toContain('@anthropic-ai/claude-code')
    expect(ps1).toContain('claude plugin install')
  })
})
