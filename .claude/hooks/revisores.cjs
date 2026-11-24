#!/usr/bin/env node
// Quais revisores a etapa 3 precisa chamar, pelo que o milestone mudou (economia de tokens, decisão do Luiz em 24/11/2026:
// "seguranca e desempenho só quando forem relevantes"). O qa vale sempre. Sem gastar tokens: lê só a lista de arquivos do git.
// Uso: node .claude/hooks/revisores.cjs <base>      (ex.: main)  → imprime "qa", "qa seguranca", "qa seguranca desempenho"…
'use strict';
const path = require('path');

// Segurança: entrada de gente de fora, dados de clientes, segredos, permissões, dependências, dinheiro.
const RE_SEGURANCA = [
  /(^|\/)supabase\//i, /(^|\/)migrations?\//i, /\.sql$/i, /(^|\/)(api|functions|server|backend|edge)\//i,
  /auth|login|logout|senha|password|token|sess(ao|ion)|permiss|role|rls|polic(y|ies)|admin|convite|invite/i,
  /(^|\/)\.env|secret|segredo|credenc|chave|key\b/i, /(^|\/)(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/i,
  /(^|\/)(vercel\.json|netlify\.toml|middleware\.[jt]s|app\.json|eas\.json)$/i,
  /upload|storage|arquivo|file|cookie|cors|crypto|webhook|pagamento|payment|checkout|cobran|pix|stripe|mercado-?pago/i,
];
// Desempenho: banco, consultas, listas que crescem, carregamento, imagens e o tamanho do pacote.
const RE_DESEMPENHO = [
  /(^|\/)supabase\//i, /(^|\/)migrations?\//i, /\.sql$/i, /(^|\/)(api|functions|server|backend|services?|store|queries|hooks)\//i,
  /lista|list|tabela|table|feed|busca|search|filtro|filter|relat[oó]rio|report|dashboard|painel|grafico|chart|pagina[cç][aã]o|pagination|infinite|virtual/i,
  /(^|\/)(package\.json|vite\.config\.[jt]s|next\.config\.[jt]s|webpack\.config\.[jt]s)$/i, /\.(png|jpe?g|webp|gif|mp4|webm|woff2?)$/i,
];
// Só isto mudou? Então nem a regra acima vale (documentação e testes não abrem brecha nem pesam no app).
const RE_INOFENSIVO = [/\.(md|txt)$/i, /(^|\/)(docs|prototipo)\//i, /\.(test|spec|teste)\.[cm]?[jt]sx?$/i, /(^|\/)(tests?|__tests__|e2e)\//i, /(^|\/)\.atlas\//i];

function revisoresPara(arquivos) {
  const lista = (arquivos || []).map((a) => String(a).trim().split(path.sep).join('/')).filter(Boolean);
  const relevantes = lista.filter((a) => !RE_INOFENSIVO.some((r) => r.test(a)));
  const out = ['qa'];
  if (relevantes.some((a) => RE_SEGURANCA.some((r) => r.test(a)))) out.push('seguranca');
  if (relevantes.some((a) => RE_DESEMPENHO.some((r) => r.test(a)))) out.push('desempenho');
  return out;
}

if (require.main === module) {
  const base = process.argv[2] || 'main';
  if (!/^[\w./-]{1,100}$/.test(base) || base.includes('..')) { console.log('qa seguranca desempenho'); process.exit(0); }
  let arquivos = [];
  try {
    arquivos = require('child_process').execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(), encoding: 'utf8', timeout: 20000 }).split(/\r?\n/);
  } catch { console.log('qa seguranca desempenho'); process.exit(0); } // sem o diff, na dúvida chama os três
  console.log(revisoresPara(arquivos).join(' '));
}

module.exports = { revisoresPara };
