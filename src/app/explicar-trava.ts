// O Atlas é autoexplicativo (26/11/2026, pedido do Luiz): TODA trava que o processo principal pode devolver tem aqui
// uma explicação em português — o que houve e o que fazer. Nenhuma tela mostra "tente de novo" sem dizer o porquê.
// O teste explicar-trava.test.ts lê todos os códigos lançados em app/ e falha se aparecer um sem explicação.

export type Conta = 'supabase' | 'vercel' | 'github'

export interface Explicacao {
  /** O que aconteceu, em uma frase, sem jargão. */
  houve: string
  /** O que a pessoa faz agora (ou "nada: o Atlas resolve sozinho"). */
  fazer: string
  /** Quando a saída é religar uma conta. */
  conta?: Conta
}

const DEFEITO: Explicacao = {
  houve: 'Isso é um defeito do Atlas, não algo que você fez.',
  fazer: 'Toque em Falar com o Atlas: ele já recebe o código e o caso chega ao suporte.',
}
const INTERNET: Explicacao = {
  houve: 'A internet não respondeu a tempo.',
  fazer: 'Confira se o computador está conectado e tente de novo. Nada se perdeu.',
}

/** Códigos que só aparecem se o próprio Atlas mandou algo errado (validação interna). Explicação: defeito do Atlas. */
export const CODIGOS_INTERNOS = [
  'arquivo-invalido', 'caminho-invalido', 'caminho-inseguro', 'campo-inexistente', 'caso-invalido', 'chave-invalida', 'como-invalido',
  'conta-invalida', 'corpo-invalido', 'destino-invalido', 'endereco-invalido', 'entendimento-invalido', 'entrada-invalida', 'estilo-invalido',
  'estilos-invalidos', 'gateway-invalido', 'grupo-invalido', 'guia-invalido', 'host-nao-permitido', 'ip-nao-publico', 'kit-invalido',
  'link-desconhecido', 'logo-invalido', 'mapa-invalido', 'marca-invalida', 'metodo-invalido', 'modelo-invalido', 'modo-invalido',
  'nomes-invalidos', 'obra-invalida', 'opcao-invalida', 'origem-invalida', 'pagina-fora-da-lista', 'pagina-invalida', 'pasta-invalida',
  'pedido-invalido', 'plano-invalido', 'ponto-invalido', 'posicao-invalida', 'prefs-invalidas', 'progresso-invalido', 'prototipo-invalido',
  'remetente-nao-confiavel', 'resposta-invalida', 'rota-nao-permitida', 'segredo-invalido', 'site-invalido', 'slug-invalido',
  'sugestao-invalida', 'telas-invalidas', 'tela-inexistente', 'token-invalido', 'trava-invalida', 'versao-invalida', 'versoes-invalidas',
  'publicar-nao-implementado', 'sem-token', 'ocorrencia-inexistente', 'versao-inexistente', 'logo-inexistente', 'obra-inexistente',
  'arquivo-inexistente', 'sem-pasta', 'sem-janela',
]

const EXPLICACOES: Record<string, Explicacao> = {
  // Licença, Claude e cota
  'sem-licenca': { houve: 'O servidor do Atlas não reconheceu a licença deste computador.', fazer: 'Confira a internet e a assinatura em Conta. Se a licença estiver em outro computador, ela vale para um computador ativo por vez.' },
  'claude-nao-logado': { houve: 'O Claude não está conectado neste computador.', fazer: 'Abra a tela Claude no menu, entre com a sua conta do Claude e tente de novo.' },
  'claude-nao-instalado': { houve: 'O Claude ainda não está instalado neste computador.', fazer: 'Abra a tela Claude no menu: o Atlas instala e conecta para você.' },
  'claude-falhou': { houve: 'O Claude não conseguiu terminar esse pedido.', fazer: 'Tente de novo. Se a sua cota do plano acabou, o Atlas pausa e retoma sozinho quando ela renovar.' },
  'cota-nao-renovou': { houve: 'A cota do seu plano do Claude ainda não renovou.', fazer: 'Nada a fazer: o Atlas confere sozinho e retoma quando renovar.' },
  'nao-sei': { houve: 'O Claude não conseguiu entender essa parte com segurança.', fazer: 'Conte com outras palavras ou mande mais um exemplo.' },

  // Linha de produção (construção)
  'ja-rodando': { houve: 'Outra obra está trabalhando agora neste computador (o Claude trabalha uma obra de cada vez).', fazer: 'Espere ela terminar ou mude a vez no Canteiro de obras. O Atlas retoma sozinho.' },
  'outra-obra-trabalhando': { houve: 'Outra obra está trabalhando agora neste computador (o Claude trabalha uma obra de cada vez).', fazer: 'Escolha se esta obra entra na fila ou passa na frente.' },
  'ja-iniciada': { houve: 'Esta obra já começou a ser construída.', fazer: 'Acompanhe pelo Canteiro de obras.' },
  'obra-sem-plano': { houve: 'A obra não tem mais o plano de construção (o arquivo PLAN.md sumiu da pasta).', fazer: 'Não apague arquivos da pasta da obra. Toque em Falar com o Atlas para recuperar.' },
  'plan-invalido': { houve: 'O plano de construção da obra (PLAN.md) está danificado e o Atlas não consegue acrescentar etapas.', fazer: 'Toque em Falar com o Atlas para recuperar o plano.' },
  'sem-plano': { houve: 'Esta obra ainda não tem plano de construção.', fazer: 'Volte ao protótipo e aprove as telas: o plano nasce daí.' },
  'kit-faltando': { houve: 'As instruções de construção do Atlas não chegaram a este computador.', fazer: 'Confira a internet e tente de novo. Elas são baixadas a cada obra e nunca ficam guardadas no computador.' },
  'kit-indisponivel': { houve: 'O servidor do Atlas não entregou as instruções de construção agora.', fazer: 'Tente de novo em alguns minutos. Nada se perdeu.' },
  'kit-grande': { houve: 'As instruções de construção chegaram corrompidas.', fazer: 'Tente de novo. Se repetir, toque em Falar com o Atlas.' },
  'kit-temp': { houve: 'Não consegui preparar uma pasta temporária para a construção.', fazer: 'Confira se o disco não está cheio e tente de novo.' },
  'obra-com-config-suspeita': { houve: 'Apareceu na pasta da obra um arquivo de configuração que o Atlas não criou, e por segurança ele não mexe na obra.', fazer: 'Toque em Falar com o Atlas: ele mostra qual arquivo é e como tirar.' },
  'obra-concluida': { houve: 'Esta obra já está concluída.', fazer: 'Para mudar algo, use Pedir mudança na obra.' },
  'nada-para-corrigir': { houve: 'A vistoria já não tem pontos para corrigir.', fazer: 'Toque em Colocar no ar de novo.' },
  'politica-bloqueado': { houve: 'Este pedido foi parado pela regra de uso do Atlas.', fazer: 'Leia o aviso na tela da obra; se achar que foi engano, conte por lá.' },
  'pedido-vazio': { houve: 'O pedido chegou vazio.', fazer: 'Conte o que você quer mudar e mande de novo.' },
  'texto-vazio': { houve: 'Não chegou nenhum texto.', fazer: 'Escreva ou fale o que você quer e mande de novo.' },
  'ocupado': { houve: 'O Atlas ainda está trabalhando no pedido anterior desta obra.', fazer: 'Espere terminar; a tela atualiza sozinha.' },
  'ajuda-ocupada': { houve: 'O Atlas ainda está respondendo a pergunta anterior.', fazer: 'Espere a resposta aparecer e mande a próxima.' },
  'sem-numero-livre': { houve: 'O protótipo chegou ao limite de telas.', fazer: 'Junte ou apague telas que não usa e tente de novo.' },
  'sem-mapa': { houve: 'O mapa das telas do protótipo não foi encontrado.', fazer: 'Toque em Falar com o Atlas para refazer o mapa.' },
  'sem-prototipo': { houve: 'Esta obra ainda não tem protótipo.', fazer: 'Comece pelo protótipo: conte a ideia e o Atlas desenha as telas.' },
  'sem-raio-x': { houve: 'A planilha ainda não foi lida.', fazer: 'Volte um passo e mande a planilha de novo.' },
  'sem-etapas': { houve: 'Ainda não há etapas para mostrar.', fazer: 'Nada a fazer: elas aparecem quando a construção começar.' },
  'sem-teste': { houve: 'Esta obra ainda não tem um teste para abrir.', fazer: 'Nada a fazer: ele aparece quando a construção terminar uma etapa.' },
  'nao-abriu': { houve: 'Não consegui abrir o sistema para teste neste computador.', fazer: 'Tente de novo. Se repetir, toque em Falar com o Atlas.' },
  'cancelado': { houve: 'O pedido foi cancelado.', fazer: 'Comece de novo quando quiser.' },

  // Arquivos trazidos pelo cliente
  'grande-demais': { houve: 'O arquivo é grande demais para o Atlas receber.', fazer: 'Mande uma versão menor (ou em partes).' },
  'tipo-nao-aceito': { houve: 'Esse tipo de arquivo não é aceito aqui.', fazer: 'Mande em PDF, imagem, planilha (Excel/CSV) ou texto.' },
  'arquivo-nao-aceito': { houve: 'Esse arquivo não é aceito aqui.', fazer: 'Mande em PDF, imagem, planilha (Excel/CSV) ou texto.' },
  'zip-bomba': { houve: 'O arquivo compactado se expande demais e foi recusado por segurança.', fazer: 'Mande os arquivos soltos, sem compactar.' },
  'compressao-suspeita': { houve: 'O arquivo compactado parece corrompido e foi recusado por segurança.', fazer: 'Mande os arquivos soltos, sem compactar.' },
  'zip-vazio': { houve: 'O arquivo compactado está vazio.', fazer: 'Confira o arquivo e mande de novo.' },
  'link-nao-aceito': { houve: 'A pasta tem atalhos para outros lugares do computador, e por segurança o Atlas não segue atalhos.', fazer: 'Copie os arquivos de verdade para uma pasta e mande essa pasta.' },
  'caminho-com-link': { houve: 'A pasta tem atalhos para outros lugares do computador, e por segurança o Atlas não segue atalhos.', fazer: 'Copie os arquivos de verdade para uma pasta e mande essa pasta.' },
  'muitos-links': { houve: 'A pasta tem atalhos demais.', fazer: 'Copie os arquivos de verdade para uma pasta e mande essa pasta.' },
  'muitas-entradas': { houve: 'A pasta tem arquivos demais para trazer de uma vez.', fazer: 'Mande só a parte que importa (por exemplo, a pasta do projeto, sem backups).' },
  'precisa-adaptar': { houve: 'Esse sistema precisa ser adaptado antes de ser vendido para outras empresas.', fazer: 'Confirme a adaptação na tela de lançamento.' },
  'nao-validou': { houve: 'Não consegui conferir os arquivos trazidos.', fazer: 'Confira se a pasta ainda existe e se não está aberta em outro programa, e tente de novo.' },
  'nao-gravou': { houve: 'Não consegui gravar os arquivos na pasta da obra.', fazer: 'Confira se o disco não está cheio e se a pasta Atlas › Obras existe, e tente de novo.' },
  'extrair': { houve: 'Não consegui abrir um arquivo que o Atlas baixou.', fazer: 'Confira a internet e tente de novo; o download recomeça do zero.' },

  // Publicação e contas do cliente
  'sem-conta-supabase': { houve: 'A sua conta do Supabase (onde fica o banco de dados do sistema) não está ligada a este computador.', fazer: 'Religue a conta e tente de novo.', conta: 'supabase' },
  'supabase-limite-gratis': { houve: 'A sua conta grátis do Supabase já tem 2 bancos ativos, que é o limite do plano grátis.', fazer: 'No site do Supabase, pause ou apague um projeto que você não usa (ou mude para o plano pago) e toque em Tentar de novo.' },
  'supabase-401': { houve: 'O Supabase não aceitou a ligação com a sua conta (ela pode ter vencido).', fazer: 'Religue a conta e tente de novo.', conta: 'supabase' },
  'supabase-403': { houve: 'O Supabase não deu permissão para criar o banco nesta conta.', fazer: 'Religue a conta com um usuário dono da organização e tente de novo.', conta: 'supabase' },
  'supabase-429': { houve: 'O Supabase pediu uma pausa (muitos pedidos seguidos).', fazer: 'Espere um minuto e tente de novo.' },
  'supabase-sem-organizacao': { houve: 'A sua conta do Supabase ainda não tem uma organização.', fazer: 'Crie uma organização no site do Supabase (é grátis) e tente de novo.' },
  'supabase-nao-criou': { houve: 'O Supabase não confirmou a criação do banco.', fazer: 'Tente de novo em alguns minutos.' },
  'supabase-falhou': { houve: 'O Supabase não conseguiu criar o banco desta obra.', fazer: 'No site do Supabase, apague o projeto com o nome desta obra e tente de novo.' },
  'supabase-demorou': { houve: 'O Supabase está demorando para preparar o banco novo (às vezes passa de 10 minutos).', fazer: 'Toque em Tentar de novo daqui a pouco; o Atlas continua do mesmo banco.' },
  'supabase-link': { houve: 'Não consegui conectar a obra ao banco novo no Supabase.', fazer: 'Tente de novo em alguns minutos; se repetir, toque em Falar com o Atlas.' },
  'supabase-migrations': { houve: 'O banco foi criado, mas as tabelas do sistema não subiram.', fazer: 'Toque em Falar com o Atlas para ele corrigir pela linha da obra.' },
  'supabase-funcoes': { houve: 'O banco e as tabelas estão prontos, mas as funções do servidor não subiram.', fazer: 'Toque em Falar com o Atlas para ele corrigir pela linha da obra.' },
  'supabase-resposta': { houve: 'O Supabase respondeu de um jeito inesperado.', fazer: 'Tente de novo em alguns minutos.' },
  'sem-token-vercel': { houve: 'A sua conta da Vercel (onde o sistema fica publicado) não está ligada a este computador.', fazer: 'Religue a conta e tente de novo.', conta: 'vercel' },
  'vercel-link': { houve: 'A Vercel não aceitou ligar a obra à sua conta.', fazer: 'Religue a conta da Vercel e tente de novo.', conta: 'vercel' },
  'vercel-variaveis': { houve: 'A Vercel não aceitou as configurações do banco desta obra.', fazer: 'Religue a conta da Vercel e tente de novo.', conta: 'vercel' },
  'vercel-deploy': { houve: 'A Vercel não conseguiu montar o sistema. No plano grátis ela aceita até 100 publicações por dia.', fazer: 'Tente de novo (se a conta tiver sido desligada, religue antes); se repetir, toque em Falar com o Atlas.', conta: 'vercel' },
  'vercel-dominio': { houve: 'A Vercel não aceitou o seu domínio.', fazer: 'Confira se o domínio está ativo no Registro.br e tente de novo.' },
  'vercel-dns': { houve: 'A Vercel ainda não enxerga o seu domínio apontado para ela.', fazer: 'Mudanças no Registro.br levam até algumas horas para valer. Tente de novo mais tarde.' },
  'dns-indisponivel': { houve: 'Não consegui conferir o domínio agora.', fazer: 'Tente de novo em alguns minutos.' },
  'dominio-invalido': { houve: 'Esse domínio não está escrito do jeito certo.', fazer: 'Confira: tem que terminar em .com.br (ou outro final do Registro.br), sem https:// nem barras.' },
  'nome-ocupado': { houve: 'Esse nome de endereço já é de outra pessoa.', fazer: 'Escolha um dos nomes sugeridos ou escreva outro.' },
  'nome-invalido': { houve: 'Esse nome não serve como endereço de internet.', fazer: 'Use só letras, números e hífen, sem acento nem espaço.' },
  'sem-nome-livre': { houve: 'Não achei um nome livre parecido com o da obra.', fazer: 'Escreva outro nome para o endereço.' },
  'teste-falhou': { houve: 'O sistema foi publicado, mas não respondeu no teste. O Atlas não diz que está no ar sem conferir.', fazer: 'Tente de novo em alguns minutos; se repetir, toque em Falar com o Atlas.' },
  'ferramentas-indisponiveis': { houve: 'Faltam neste computador as ferramentas da Vercel e do Supabase, e não consegui instalar agora.', fazer: 'Confira a internet e tente de novo; o Atlas instala sozinho.' },
  'gh-falhou': { houve: 'O GitHub não aceitou o pedido.', fazer: 'Religue a conta do GitHub e tente de novo.', conta: 'github' },
  'obra-fora-do-ar': { houve: 'O sistema desta obra ainda não está no ar.', fazer: 'Primeiro toque em Colocar no ar; depois volte aqui.' },
  'sem-codigo': { houve: 'A conta não devolveu o código de ligação a tempo.', fazer: 'Tente ligar a conta de novo e confirme no navegador que abrir.' },

  // Vender o sistema (lançamento, página de vendas, lojas)
  'sem-gateway': { houve: 'Ainda falta escolher onde você recebe os pagamentos (Stripe ou Asaas, na sua conta).', fazer: 'Escolha o gateway na tela de lançamento.' },
  'nao-comecado': { houve: 'O lançamento desta obra ainda não começou.', fazer: 'Toque em Começar o lançamento.' },
  'sem-lancamento': { houve: 'O lançamento desta obra ainda não começou.', fazer: 'Toque em Começar o lançamento.' },
  'ja-construindo': { houve: 'A página de vendas já está sendo montada.', fazer: 'Espere terminar; a tela atualiza sozinha.' },
  'ja-montando': { houve: 'O app para as lojas já está sendo montado.', fazer: 'Espere terminar; a tela atualiza sozinha.' },
  'sem-pagina': { houve: 'A página de vendas ainda não foi montada.', fazer: 'Toque em Montar a página.' },
  'sem-marcacoes': { houve: 'Não há marcações na página para mandar.', fazer: 'Marque na página o que quer mudar e mande de novo.' },
  'teste-nao-passou': { houve: 'A página de vendas ainda não passou no teste.', fazer: 'Espere o teste terminar ou peça a correção.' },
  'vendas-fechadas': { houve: 'As vendas desta página ainda não foram abertas.', fazer: 'Toque em Aprovar e publicar quando estiver tudo certo.' },
  'sem-painel': { houve: 'O painel do dono ainda não está no ar.', fazer: 'Ele fica pronto junto com a página de vendas.' },
  'falta-expo': { houve: 'Falta ligar a sua conta da Expo (usada para montar o app das lojas).', fazer: 'Ligue a conta da Expo na tela das lojas e tente de novo.' },
  'sem-arquivo': { houve: 'O arquivo do app para a Play Store ainda não ficou pronto.', fazer: 'Espere a montagem do app terminar e toque em Baixar de novo.' },
  'segredo-obrigatorio': { houve: 'Falta preencher a chave pedida.', fazer: 'Cole a chave no campo e confirme.' },

  // Celular, atualização e instalação
  'celular-nao-conectado': { houve: 'O celular ainda não está ligado a este computador.', fazer: 'Abra o link no celular e confirme; a escolha já ficou guardada.' },
  'link-negado': { houve: 'O servidor não liberou o link do celular para esta licença.', fazer: 'Confira a assinatura em Conta e tente de novo.' },
  'link-indisponivel': { houve: 'O servidor do Atlas não gerou o link agora.', fazer: 'Tente de novo em alguns minutos.' },
  'servidor-indisponivel': { houve: 'O servidor do Atlas não respondeu.', fazer: 'Confira a internet e tente de novo em alguns minutos.' },
  'download': { houve: 'A atualização não baixou inteira.', fazer: 'Confira a internet; o Atlas tenta de novo sozinho.' },
  'impressao-diferente': { houve: 'A atualização baixada não bateu com a original e foi descartada por segurança.', fazer: 'Nada a fazer: o Atlas baixa de novo sozinho.' },
  'impressao-digital': { houve: 'Uma ferramenta baixada não bateu com a original e foi descartada por segurança.', fazer: 'Tente de novo; o download recomeça do zero.' },
  'sem-versao': { houve: 'Não consegui descobrir a versão das ferramentas para baixar.', fazer: 'Confira a internet e tente de novo.' },
  'npm': { houve: 'Não consegui instalar o Claude neste computador.', fazer: 'Confira a internet e tente de novo; se repetir, toque em Falar com o Atlas.' },
  'git-sem-resposta': { houve: 'A instalação das ferramentas de desenvolvedor do Mac não terminou.', fazer: 'Confirme a janela do Mac que pede para instalar as ferramentas e tente de novo.' },
  'sem-trava': { houve: 'Não há uma trava aberta nesta obra.', fazer: 'Nada a fazer.' },

  // Rede (genéricos)
  'sem-conexao': INTERNET,
  'timeout': INTERNET,
  'falhou': INTERNET,
  'indisponivel': { houve: 'Essa parte do Atlas não está disponível neste computador.', fazer: 'Atualize o Atlas (Conta → Atualizar) e tente de novo.' },
  'resposta-inesperada': { houve: 'O serviço respondeu de um jeito inesperado.', fazer: 'Tente de novo em alguns minutos.' },
  'resposta-grande': { houve: 'O serviço respondeu com dados demais.', fazer: 'Tente de novo; se repetir, toque em Falar com o Atlas.' },
  'resposta-estranha': { houve: 'O serviço respondeu de um jeito inesperado.', fazer: 'Tente de novo em alguns minutos.' },
}

// Erros do sistema operacional (o Windows manda o nome em maiúsculas: EPERM, EBUSY...).
const DO_SISTEMA: Record<string, Explicacao> = {
  EPERM: { houve: 'O Windows não deixou mexer num arquivo da obra (ele está aberto em outro programa, ou o antivírus/OneDrive está segurando).', fazer: 'Feche a pasta da obra e os programas que usam esses arquivos, espere um minuto e tente de novo.' },
  EACCES: { houve: 'O computador não deu permissão para mexer num arquivo da obra.', fazer: 'Feche a pasta da obra e os programas que usam esses arquivos e tente de novo.' },
  EBUSY: { houve: 'Um arquivo da obra está em uso por outro programa.', fazer: 'Feche a pasta da obra e os programas que usam esses arquivos e tente de novo.' },
  ENOSPC: { houve: 'O disco do computador está cheio.', fazer: 'Libere espaço (apague arquivos grandes ou esvazie a lixeira) e tente de novo.' },
  ENOENT: { houve: 'Um arquivo da obra sumiu da pasta (pode ter sido apagado ou movido).', fazer: 'Não mova nem apague arquivos de dentro da pasta Atlas › Obras. Toque em Falar com o Atlas para recuperar.' },
  ETIMEDOUT: INTERNET, ECONNRESET: INTERNET, ENOTFOUND: INTERNET, ECONNREFUSED: INTERNET, EAI_AGAIN: INTERNET,
}

/** Famílias de código com número (supabase-500, http-404...). */
function porFamilia(c: string): Explicacao | null {
  if (DO_SISTEMA[c]) return DO_SISTEMA[c]
  let m = /^supabase-(\d{3})$/.exec(c)
  if (m) return Number(m[1]) >= 500
    ? { houve: 'O site do Supabase está com problema agora.', fazer: 'Tente de novo em alguns minutos. Nada se perdeu.' }
    : { houve: `O Supabase recusou o pedido (código ${m[1]}).`, fazer: 'Toque em Falar com o Atlas: ele já recebe o código.' }
  m = /^http-(\d{3})$/.exec(c)
  if (m) return Number(m[1]) >= 500
    ? { houve: 'O serviço está com problema agora.', fazer: 'Tente de novo em alguns minutos. Nada se perdeu.' }
    : { houve: `O serviço recusou o pedido (código ${m[1]}).`, fazer: 'Toque em Falar com o Atlas: ele já recebe o código.' }
  if (c.startsWith('vercel-')) return { houve: 'A Vercel não aceitou a publicação agora (conta desligada ou a Vercel fora do ar).', fazer: 'Religue a conta da Vercel e tente de novo.', conta: 'vercel' }
  if (c.startsWith('supabase-')) return { houve: 'O Supabase não terminou de preparar o banco.', fazer: 'Tente de novo em alguns minutos.' }
  return null
}

/** Explicação de um código. Nunca devolve vazio: código desconhecido vira "defeito do Atlas" com o código. */
export function explicarTrava(codigo: string): Explicacao & { codigo: string; conhecido: boolean } {
  const c = codigoDe(String(codigo || ''))
  const e = EXPLICACOES[c] ?? porFamilia(c) ?? (CODIGOS_INTERNOS.includes(c) ? DEFEITO : null)
  if (e) return { ...e, codigo: c, conhecido: true }
  return { ...DEFEITO, houve: c ? 'Aconteceu algo que o Atlas ainda não sabe explicar.' : DEFEITO.houve, codigo: c, conhecido: false }
}

/** Código de um erro qualquer (o processo principal manda só o código na mensagem). */
export function codigoDe(e: unknown): string {
  // Só o código do começo ("EPERM: operation not permitted, open C:\\..." vira "EPERM"): nunca texto cru nem caminho na tela.
  const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
  return /^([A-Za-z][A-Za-z0-9_-]{1,40})(?=$|[:\s])/.exec(msg.trim())?.[1] ?? ''
}

/** Frase pronta para a tela: "<o que falhou> <o que houve> <o que fazer> (código: x)". */
export function textoDaTrava(e: unknown, oQueFalhou = ''): string {
  const x = explicarTrava(codigoDe(e))
  const partes = [oQueFalhou.trim(), x.houve, x.fazer].filter(Boolean).join(' ')
  return x.codigo ? `${partes} (código: ${x.codigo})` : partes
}

/** Existe explicação própria (não é só o "defeito do Atlas")? Para o teste de cobertura. */
export function temExplicacao(codigo: string): boolean {
  return codigo in EXPLICACOES || porFamilia(codigo) !== null || CODIGOS_INTERNOS.includes(codigo)
}

/** Para o Falar com o Atlas: um detalhe que é só um código ganha a explicação junto (a Ajuda sabe o que houve e o que fazer). */
export function detalheExplicado(detalhe: string | undefined): string | undefined {
  if (!detalhe) return detalhe
  const c = codigoDe(detalhe)
  if (!c || c !== detalhe.trim()) return detalhe
  const x = explicarTrava(c)
  return `${c} — ${x.houve} ${x.fazer}`.slice(0, 600)
}
