import { describe, expect, it } from 'vitest'
import config from './electron-builder.json'
import nsh from './atlas-install.nsh?raw'
import ps1 from './instalar.ps1?raw'
import executar from './executar.mjs?raw'
import pkg from '../package.json'
import { atalhoAreaDeTrabalho, pastaObras, pastaObrasSegura } from './caminhos.ts'
import { PLUGIN_ID, executarPlano, planoDeInstalacao, rodarInstalacao, telaInicial } from './passos.ts'

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

const opc = { recursos: 'C:\\r\\instalador', integridade: async () => true }

describe('plano de instalação', () => {
  it('ordem: node, claude, integridade, plugin, obras, app', () => {
    expect(planoDeInstalacao('Maria', opc).map((p) => p.id)).toEqual(['node', 'claude-code', 'integridade', 'plugin', 'obras', 'app'])
  })
  it('plugin vem da pasta local empacotada, não da internet, e tem verificar real', () => {
    const p = planoDeInstalacao('Maria', opc).find((x) => x.id === 'plugin')!
    expect(p.comando).toContain('C:\\r\\instalador\\plugin-atlas')
    expect(p.comando).not.toMatch(/github|atlas-kit/)
    expect(p.verificar).toContain(PLUGIN_ID)
    expect(p.confirmar).toBe(true)
  })
  it('tela inicial: flag manda; ativado cai em minhas obras', () => {
    expect(telaInicial([])).toBe('F02')
    expect(telaInicial([], true)).toBe('F05')
    expect(telaInicial(['--tela=F12'], true)).toBe('F12')
  })
  it('pula o que já está pronto e para no primeiro erro', async () => {
    const vistos: string[] = []
    const r = await executarPlano(planoDeInstalacao('Maria', opc), {
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
  it('checksum errado aborta antes de instalar o plugin', async () => {
    const vistos: string[] = []
    const r = await executarPlano(planoDeInstalacao('Maria', { ...opc, integridade: async () => false }), {
      roda: async (c) => (vistos.push(c), { codigo: 0 }),
    })
    expect(r.falhou).toBe('integridade')
    expect(vistos.some((c) => c.includes('plugin install'))).toBe(false)
  })
  it('plugin só vale se o verificar passar depois de instalar', async () => {
    const r = await executarPlano(planoDeInstalacao('Maria', opc), {
      roda: async (c) => ({ codigo: c.includes('findstr') ? 1 : 0 }),
    })
    expect(r.falhou).toBe('plugin')
  })
  it('rodarInstalacao (entry real) devolve 0 no sucesso e 1 na falha', async () => {
    expect(await rodarInstalacao('Maria', opc, { roda: async () => ({ codigo: 0 }) })).toBe(0)
    const falha = { roda: async (c: string) => ({ codigo: c.startsWith('mkdir') || c.startsWith('if exist "C:') ? 1 : 0 }) }
    expect(await rodarInstalacao('Maria', opc, falha)).toBe(1)
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
  it('include NSIS cria obras fora de Desktop/Documentos; atalho sem flag; F02 só na instalação', () => {
    expect(nsh).toContain('$PROFILE\\Atlas\\Obras')
    expect(nsh).not.toMatch(/\$(DOCUMENTS|DESKTOP)\\Atlas\\/)
    expect(nsh).toContain('Atlas · minhas obras.lnk')
    expect(nsh).toMatch(/CreateShortCut [^\n]*Atlas\.exe" "" /)
    expect(nsh).toContain('Exec \'"$INSTDIR\\Atlas.exe" --tela=F02\'')
  })
  it('customUnInstall não remove a pasta das obras', () => {
    const un = nsh.slice(nsh.indexOf('!macro customUnInstall'))
    expect(un).not.toMatch(/RMDir|Obras|\$PROFILE/)
    expect(un).toContain('Delete "$DESKTOP')
  })
  it('.nsh é UTF-8 com BOM', () => {
    expect(nsh.charCodeAt(0)).toBe(0xfeff)
  })
  it('empacota ps1, entry, passos e plugin; caminho do nsh existe no pacote', () => {
    const destinos = config.extraResources.map((r) => r.to)
    for (const f of ['instalar.ps1', 'executar.mjs', 'passos.ts', 'caminhos.ts', 'plugin-atlas']) {
      expect(destinos).toContain(`instalador/${f}`)
    }
    expect(nsh).toContain('resources\\instalador\\instalar.ps1')
  })
  it('ps1 só faz bootstrap do Node, aborta em erro e delega ao executarPlano', () => {
    expect(ps1).toContain('OpenJS.NodeJS.LTS')
    expect(ps1.match(/\$LASTEXITCODE/g)!.length).toBeGreaterThanOrEqual(2)
    expect(ps1).toContain('Atualizar-Path')
    expect(ps1).toContain('executar.mjs')
    expect(ps1).not.toMatch(/npm install|marketplace add/)
    expect(executar).toContain('rodarInstalacao')
  })
  it('script de assinatura sem @latest/--yes e com versão exata', () => {
    const s = pkg.scripts.instalador
    expect(s).not.toMatch(/@latest|--yes|npx/)
    expect(s).toMatch(/electron-builder@\d+\.\d+\.\d+/)
  })
})
