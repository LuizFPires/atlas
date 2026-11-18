param([Parameter(Mandatory = $true)][string]$Obras)
# Passos idempotentes; espelha instalador/passos.ts. Sem segredos.
$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
}
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
  npm install -g '@anthropic-ai/claude-code'
}
# Plugin Atlas fica no perfil do usuário (nunca na pasta das obras)
claude plugin marketplace add atlas-kit/atlas
claude plugin install atlas@atlas-kit
New-Item -ItemType Directory -Force -Path $Obras | Out-Null
