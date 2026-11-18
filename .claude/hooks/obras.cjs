// Carteira de obras: registro global dos projetos que usam a linha de produção neste computador.
// Fica em ~/.canteiro/obras.json (no Windows: C:\Users\<você>\.canteiro\obras.json).
// Os hooks registram o projeto sozinhos; um único painel mostra todas as obras.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const PASTA = process.env.CANTEIRO_HOME || path.join(os.homedir(), '.canteiro');
const ARQ = path.join(PASTA, 'obras.json');

const idDe = raiz => crypto.createHash('sha1').update(path.resolve(raiz).toLowerCase()).digest('hex').slice(0, 10);

function lerObras() {
  try { return JSON.parse(fs.readFileSync(ARQ, 'utf8')).obras || {}; } catch { return {}; }
}

// Registra (ou atualiza) a obra. Barato: só regrava o arquivo global no máximo a cada 30 s por obra.
function registrar(raiz) {
  try {
    raiz = path.resolve(raiz);
    const marca = path.join(raiz, '.canteiro', 'registro');
    try { if (Date.now() - fs.statSync(marca).mtimeMs < 30000) return idDe(raiz); } catch {}
    fs.mkdirSync(path.dirname(marca), { recursive: true });
    fs.writeFileSync(marca, String(Date.now()));
    fs.mkdirSync(PASTA, { recursive: true });
    const obras = lerObras();
    const id = idDe(raiz);
    obras[id] = { raiz, nome: (obras[id] && obras[id].nome) || path.basename(raiz), visto: Date.now() };
    const tmp = ARQ + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ obras }, null, 2));
    fs.renameSync(tmp, ARQ); // troca atômica: dois projetos ao mesmo tempo não corrompem o arquivo
    return id;
  } catch { return null; }
}

function remover(id) {
  const obras = lerObras();
  delete obras[id];
  fs.mkdirSync(PASTA, { recursive: true });
  fs.writeFileSync(ARQ, JSON.stringify({ obras }, null, 2));
}

module.exports = { lerObras, registrar, remover, idDe, ARQ };
