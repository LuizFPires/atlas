import { describe, expect, it } from 'vitest'
import config from './electron-builder.json'
import nsh from './atlas-install.nsh?raw'
import ps1 from './instalar.ps1?raw'
import executar from './executar.mjs?raw'
import pkg from '../package.json'
import { atalhoAreaDeTrabalho, pastaObras, pastaObrasSegura } from './caminhos.ts'
import { executarPlano, planoDeInstalacao, rodarInstalacao, telaInicial } from './passos.ts'

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
  it('ordem: node, claude, obras, app', () => {
    expect(planoDeInstalacao('Maria').map((p) => p.id)).toEqual(['node', 'claude-code', 'obras', 'app'])
  })
  it('não instala plugin: o kit vem do servidor a cada obra e nunca fica no disco do cliente', () => {
    const tudo = planoDeInstalacao('Maria').map((p) => `${p.verificar ?? ''} ${p.comando ?? ''}`).join(' ')
    expect(tudo).not.toMatch(/plugin|marketplace/)
  })
  it('tela inicial: flag manda; ativado cai em minhas obras', () => {
    expect(telaInicial([])).toBe('F02')
    expect(telaInicial([], true)).toBe('F05')
    expect(telaInicial(['--tela=F12'], true)).toBe('F12')
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
  it('rodarInstalacao (entry real) devolve 0 no sucesso e 1 na falha', async () => {
    expect(await rodarInstalacao('Maria', { roda: async () => ({ codigo: 0 }) })).toBe(0)
    const falha = { roda: async (c: string) => ({ codigo: c.startsWith('mkdir') || c.startsWith('if exist "C:') ? 1 : 0 }) }
    expect(await rodarInstalacao('Maria', falha)).toBe(1)
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
  it('empacota ps1, entry e passos (sem plugin); caminho do nsh existe no pacote', () => {
    const destinos = config.extraResources.map((r) => r.to)
    for (const f of ['instalar.ps1', 'executar.mjs', 'passos.ts', 'caminhos.ts']) {
      expect(destinos).toContain(`instalador/${f}`)
    }
    expect(destinos).not.toContain('instalador/plugin-atlas')
    expect(nsh).toContain('resources\\instalador\\instalar.ps1')
  })
  it('o pacote leva o app e a tela dele (dist-app), abre por app/main.cjs e fixa a versão do Electron', () => {
    expect(config.files).toContain('app/**/*')
    expect(config.files).toContain('dist-app/**/*')
    expect(config.files).not.toContain('dist/**/*')
    // A raiz do projeto é a pasta do app: sem isto o electron-builder empacota só app/ e deixa a tela (dist-app) de fora.
    expect(config.directories.app).toBe('.')
    expect(config.extraMetadata.main).toBe('app/main.cjs')
    expect(config.electronVersion).toMatch(/^\d+\.\d+\.\d+$/)
  })
  it('o aviso de erro não trava a instalação silenciosa', () => {
    expect(nsh).toMatch(/MessageBox MB_ICONEXCLAMATION "[^"]+" \/SD IDOK/)
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
