// @vitest-environment node
// Testa as regras PURAS de segurança do app Windows (app/seguro-puro.cjs: sem electron).
// (Sem @types/node no projeto: os módulos do Node entram por nome em variável, só neste teste.)
const mod = (nome: string): Promise<any> => import(/* @vite-ignore */ nome); // eslint-disable-line @typescript-eslint/no-explicit-any

type Puro = {
  caminhoSeguro: (raiz: string, ...p: string[]) => string;
  urlOficial: (u: string) => string;
};
let puro: Puro, fs: any, os: any, path: any; // eslint-disable-line @typescript-eslint/no-explicit-any
beforeAll(async () => {
  fs = await mod("node:fs");
  os = await mod("node:os");
  path = await mod("node:path");
  const { createRequire } = await mod("node:module");
  puro = createRequire(import.meta.url)("../../app/seguro-puro.cjs");
});
const caminhoSeguro = (...a: [string, ...string[]]) => puro.caminhoSeguro(...a);
const urlOficial = (u: string) => puro.urlOficial(u);

describe("caminhoSeguro", () => {
  let raiz: string;
  beforeAll(() => {
    raiz = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-raiz-"));
  });
  afterAll(() => {
    fs.rmSync(raiz, { recursive: true, force: true });
  });

  it("aceita caminho válido dentro da raiz", () => {
    expect(caminhoSeguro(raiz, "obra", "a.txt")).toBe(
      path.join(raiz, "obra", "a.txt"),
    );
  });
  it("recusa ..", () => {
    expect(() => caminhoSeguro(raiz, "..", "x")).toThrow(
      "caminho-fora-da-raiz",
    );
    expect(() => caminhoSeguro(raiz, "a/../../x")).toThrow(
      "caminho-fora-da-raiz",
    );
  });
  it("recusa caminho absoluto", () => {
    expect(() =>
      caminhoSeguro(raiz, path.resolve(os.tmpdir(), "fora")),
    ).toThrow();
  });
  it('recusa fluxo ADS "a:b"', () => {
    expect(() => caminhoSeguro(raiz, "a:b")).toThrow();
    expect(() => caminhoSeguro(raiz, "arq.txt:oculto")).toThrow();
  });
  it("recusa link simbólico/junção", () => {
    const fora = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-fora-"));
    try {
      fs.symlinkSync(fora, path.join(raiz, "elo"), "junction");
    } catch {
      fs.rmSync(fora, { recursive: true, force: true });
      return;
    } // sem permissão para criar link: não testável aqui
    expect(() => caminhoSeguro(raiz, "elo", "x")).toThrow("caminho-com-link");
    fs.rmSync(fora, { recursive: true, force: true });
  });
});

describe("urlOficial", () => {
  it("aceita só https de host oficial", () => {
    expect(urlOficial("https://claude.ai/login")).toBe(
      "https://claude.ai/login",
    );
    expect(urlOficial("https://CLAUDE.ai/upgrade")).toBe(
      "https://claude.ai/upgrade",
    );
  });
  it.each([
    "https://claude.ai.evil.com/",
    "https://evilclaude.ai/",
    "http://claude.ai/",
    "javascript:alert(1)",
    "file:///C:/Windows/system.ini",
    "https://user:pw@claude.ai/",
    "https://user@claude.ai/",
    "https://claude.ai:8443/",
    "nao é url",
  ])("recusa %s", (u) => {
    expect(() => urlOficial(u)).toThrow();
  });
});
