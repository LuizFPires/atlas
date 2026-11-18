# Bootstrap do instalador: so garante o Node (winget) e entrega o resto a executar.mjs,
# que roda a mesma logica testada (passos.ts / executarPlano). Sem segredos.
$ErrorActionPreference = 'Stop'

function Atualizar-Path {
  $maquina = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $usuario = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$maquina;$usuario"
}

function Node-Serve {
  $n = Get-Command node -ErrorAction SilentlyContinue
  if (-not $n) { return $false }
  $v = (& node --version) -replace '^v', ''
  return ([int]($v.Split('.')[0]) -ge 22)
}

if (-not (Node-Serve)) {
  winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) { Write-Error "winget falhou ($LASTEXITCODE)"; exit 1 }
  Atualizar-Path
  if (-not (Node-Serve)) { Write-Error 'Node nao encontrado depois da instalacao'; exit 1 }
}

# O resto (Claude Code, plugin local com checksum, pasta das obras, app) e o executarPlano
& node --experimental-strip-types (Join-Path $PSScriptRoot 'executar.mjs')
if ($LASTEXITCODE -ne 0) { Write-Error "instalacao falhou ($LASTEXITCODE)"; exit 1 }
exit 0
