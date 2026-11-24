import { describe, expect, it } from 'vitest'
import config from './electron-builder.json'
import nsh from './atlas-install.nsh?raw'
import ps1 from './instalar.ps1?raw'
import executar from './executar.mjs?raw'
import principal from '../app/main.cjs?raw'
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
    expect(atalhoAreaDeTrabalho('C:\\Users\\M\\Desktop\\')).toBe('C:\\Users\\M\\Desktop\\Atlas.lnk')
  })
})


describe('plano de instalação', () => {
  it('ordem: node, git, gh, claude, obras, app', () => {
    expect(planoDeInstalacao('Maria').map((p) => p.id)).toEqual(['node', 'git', 'gh', 'claude-code', 'obras', 'app'])
  })
  it('instala o Git (o Claude Code no Windows precisa do Git Bash) e o GitHub CLI, e confere depois de instalar', () => {
    const plano = planoDeInstalacao('Maria')
    const git = plano.find((p) => p.id === 'git')!
    const gh = plano.find((p) => p.id === 'gh')!
    expect(git.comando).toContain('--id Git.Git')
    expect(gh.comando).toContain('--id GitHub.cli')
    for (const p of [git, gh]) {
      expect(p.confirmar).toBe(true)
      expect(p.comando).toContain('--silent')
    }
    // o PATH do processo não muda logo depois do winget: a conferência também olha a pasta padrão
    expect(git.verificar).toContain('Git\\cmd\\git.exe')
    expect(gh.verificar).toContain('GitHub CLI\\gh.exe')
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
        if (c.includes('git') || c.includes('gh')) return { codigo: 0 }
        if (c === 'claude --version') return { codigo: 1 }
        if (c.startsWith('npm install')) return { codigo: 1 }
        return { codigo: 0 }
      },
    })
    expect(r.pulados).toEqual(['node', 'git', 'gh'])
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
    // Luiz, 24/11/2026: o atalho se chama só "Atlas"; o antigo ("Atlas · minhas obras") é apagado ao instalar e ao atualizar.
    expect(nsh).toContain('CreateShortCut "$DESKTOP\\Atlas.lnk"')
    expect(nsh).toMatch(/customInstall[\s\S]*Delete "\$DESKTOP\\Atlas · minhas obras\.lnk"[\s\S]*CreateShortCut/)
    expect(nsh).toMatch(/customUnInstall[\s\S]*Delete "\$DESKTOP\\Atlas\.lnk"/)
    expect(nsh).toMatch(/CreateShortCut [^\n]*Atlas\.exe" "" /)
    // O nome do instalador baixado leva o código do link; o app lê daí (app/link-instalacao.cjs) e o cliente não volta à página.
    expect(nsh).toContain('Exec \'"$INSTDIR\\Atlas.exe" --tela=F02 "--instalador=$EXEFILE"\'')
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
    // canteiro 3D e hooks do painel vão junto, FORA do asar (o servidor roda como processo à parte)
    const kit = config.extraResources.filter((r) => r.to.startsWith('kit/')).map((r) => `${r.from}>${r.to}`)
    expect(kit).toEqual(['.claude/canteiro>kit/canteiro', '.claude/hooks>kit/hooks'])
    expect(config.files).toContain('dist-app/**/*')
    expect(config.files).not.toContain('dist/**/*')
    // A raiz do projeto é a pasta do app: sem isto o electron-builder empacota só app/ e deixa a tela (dist-app) de fora.
    expect(config.directories.app).toBe('.')
    expect(config.extraMetadata.main).toBe('app/main.cjs')
    expect(config.electronVersion).toMatch(/^\d+\.\d+\.\d+$/)
  })
  it('o app e o instalador usam o ícone do Atlas, não o do Electron', () => {
    expect(config.win.icon).toBe('instalador/recursos/icon.ico')
    expect(Object.keys(import.meta.glob('./recursos/icon.ico', { eager: true, query: '?url' }))).toHaveLength(1)
    expect(Object.keys(import.meta.glob('../app/icone.png', { eager: true, query: '?url' }))).toHaveLength(1)
    expect(principal).toContain("icon: path.join(__dirname, 'icone.png')")
  })
  it('a janela do app não mostra o menu padrão do Electron (File, Edit, View, Window)', () => {
    expect(principal).toContain('Menu.setApplicationMenu(null)')
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

// Luiz, 24/11/2026: o ícone do Atlas é uma bola preta (círculo), não um quadrado.
describe('ícone redondo', () => {
  it('o ícone tem os 7 tamanhos e o de 256 px tem transparência (RGBA), que deixa os cantos do círculo vazados', async () => {
    const fs = await import('node:fs')
    const buf = fs.readFileSync('instalador/recursos/icon.ico')
    const n = buf.readUInt16LE(4)
    expect(n).toBeGreaterThanOrEqual(7)
    // ícone de 256 px guardado como PNG: confere a transparência pelo cabeçalho PNG (cor com alfa) e o tamanho
    const entradas = Array.from({ length: n }, (_, i) => ({ w: buf[6 + i * 16] || 256, off: buf.readUInt32LE(6 + i * 16 + 12) }))
    const grande = entradas.find((e) => e.w === 256)!
    expect(buf.subarray(grande.off + 1, grande.off + 4).toString()).toBe('PNG')
    expect(buf[grande.off + 25]).toBe(6) // RGBA
  })
})
