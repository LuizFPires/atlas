# Instalador — pendências para /entregar

- Credenciais Azure Trusted Signing (variáveis AZURE_PUBLISHER_NAME, AZURE_TS_ENDPOINT, AZURE_TS_PROFILE, AZURE_TS_ACCOUNT + AZURE_TENANT_ID/CLIENT_ID/CLIENT_SECRET como secrets do runner; nunca em arquivo).
- Runner Windows para `npm run instalador` (o CI ubuntu não builda o .exe).
- Build assinado e teste numa máquina Windows limpa (inclui OneDrive ativo).
- Ajustar ids reais: marketplace do plugin (`atlas-kit/atlas`), executável do app (M9 empacota o Electron, pasta `app/`), ícone em `instalador/recursos`.
- `electron` e `electron-builder` não são dependências do projeto de propósito (mantém `npm ci` leve); o script usa npx.
