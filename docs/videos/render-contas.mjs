import pw from '/home/claude/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright/index.js'; const { chromium } = pw
import { spawn, execFileSync } from 'node:child_process'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
const contas = JSON.parse(readFileSync('/home/claude/video-contas/contas.json', 'utf8'))
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--allow-file-access-from-files'] })
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
for (const conta of contas) {
  await p.goto('file:///home/claude/video-contas/conta.html'); await p.evaluate(() => document.fonts.ready)
  const { cortes } = await p.evaluate((c) => window.montar(c), conta)
  const arquivos = []
  for (const [i, [a, z]] of cortes.entries()) {
    const nome = `${conta.id}-${i}.mp4`, tmp = `${conta.id}-${i}.tmp.mp4`
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-r', '30', '-f', 'mp4', tmp], { stdio: ['pipe', 'inherit', 'inherit'] })
    for (let f = 0; f < Math.round((z - a) * 30); f++) {
      await p.evaluate((t) => window.setT(t), a + f / 30)
      const buf = await p.screenshot({ type: 'jpeg', quality: 92 })
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r))
    }
    ff.stdin.end()
    if (await new Promise((r) => ff.on('close', r)) !== 0) throw new Error(`ffmpeg ${nome}`)
    renameSync(tmp, nome); arquivos.push(nome)
  }
  writeFileSync(`${conta.id}.txt`, arquivos.map((f) => `file '${f}'`).join('\n'))
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${conta.id}.txt`, '-c', 'copy', '-movflags', '+faststart', `video-conta-${conta.id}.mp4`])
  console.log('ok', conta.id)
}
await b.close()
