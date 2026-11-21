// Medição de visitas ANÔNIMA e agregada: um número total, sem cookie, sem IP guardado,
// sem identificar ninguém. Por não usar dado pessoal, roda sob interesse legítimo (LGPD)
// e NÃO exige consentimento nem banner. Se um dia entrar uma ferramenta de análise, ela
// tem de ser cookieless/anônima (ex.: Plausible) pra manter essa garantia.
export const medicaoAnonima = () => true
