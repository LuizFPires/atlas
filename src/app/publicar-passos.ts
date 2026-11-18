// Conteúdo da tela F13b (prototipo/F13bPublicando.dc.html): os 4 guias de mão dada da publicação.
// Mesmo padrão do M11 (Contas): cada passo mostra quem faz (VOCÊ ou O ATLAS), o site em inglês vem traduzido (en -> pt) e há "Não consegui".
// INVARIANTE: pagamentos e "Enviar para revisão" são SEMPRE do cliente; o Atlas guia e faz a parte técnica.
// Os nomes dos botões dos sites reais (Registro.br, Apple, Google) precisam ser conferidos no /entregar (app/PENDENTE-ENTREGAR.md).
import type { ItemSite, PassoConta } from './contas-passos'
import type { IdOpcao } from './publicar-dados'
import type { DestinoSite, RegistroDns } from './ponte-publicar'

/** O que o Atlas faz sozinho ao chegar no passo (sempre por uma porta). */
export type AutoPasso = 'nome' | 'dns' | 'publicar' | 'espera' | 'cartaz' | 'adaptador'

export interface PassoGuia extends PassoConta {
  /** O botão principal abre este site oficial (destino fixo, nunca uma URL de dado). */
  abre?: DestinoSite
  auto?: AutoPasso
}

export interface Guia {
  id: IdOpcao
  nome: string
  titulo: string
  intro: string
  passos: PassoGuia[]
}

export interface ContextoGuia {
  /** "Cadeira 1" */
  obra: string
  /** "cadeira1" */
  slug: string
  /** Endereço grátis; vira o real depois que o Atlas publica. */
  endereco: string
  /** "cadeira1.com.br" */
  dominio: string
  /** Registros que a Vercel pediu (lidos na hora); null = ainda lendo. */
  dns: RegistroDns[] | null
  /** false = sem adaptador: o Atlas não afirma que publicou nem que a vistoria passou. */
  real?: boolean
}

const B = (txt: string, destaque = false, dica = 'clique aqui'): ItemSite => ({ tipo: 'botao', txt, destaque, dica })
const C = (txt: string, destaque = false, dica = 'escreva aqui'): ItemSite => ({ tipo: 'campo', txt, destaque, dica })
const S = (txt: string): ItemSite => ({ tipo: 'status', txt })

export function guiaGratis(x: ContextoGuia): Guia {
  return { id: 'gratis', nome: 'Endereço grátis', titulo: `Endereço grátis: ${x.slug}.vercel.app`, intro: 'O jeito mais rápido de colocar no ar. É de graça e fica pronto em minutos.', passos: [
    { quem: 'atlas', auto: 'adaptador', faca: 'Vistoria final: o Atlas usa o sistema como se fosse um cliente, tela por tela, antes de abrir as portas.', calma: 'Se achar algum problema, ele mesmo corrige e testa de novo.', site: { url: 'vistoria do Atlas', titulo: 'Vistoria final', itens: x.real === false ? [S('Ainda não fiz a vistoria de verdade')] : [S('50 testes aprovados'), S('Celular e computador conferidos')] } },
    { quem: 'voce', faca: 'Confirme o endereço grátis do seu sistema.', calma: 'Este endereço é de graça e continua funcionando mesmo se depois você comprar um domínio.', site: { url: 'vercel.com', titulo: 'Endereço do sistema', itens: [C(`${x.slug}.vercel.app`, true, 'confira o nome'), B('Confirmar')] } },
    { quem: 'atlas', auto: 'publicar', faca: 'O Atlas está colocando o sistema no ar, na sua conta da Vercel.', calma: 'Leva poucos minutos. O banco de dados de verdade é ligado agora, vazio e pronto para uso.', site: { url: `vercel.com/${x.slug}`, titulo: 'Publicando…', itens: [S('Montando o sistema'), S('Banco de dados ligado')] } },
    { quem: 'voce', faca: 'Abra no seu celular e faça um teste de verdade: marque um horário.', calma: 'Aponte a câmera para o QR code que aparece no Atlas. Achou algo estranho? Fale com a Ajuda do Atlas.', site: { url: x.endereco, titulo: `${x.obra} · Sua vez, sem fila.`, itens: [B('Marcar horário', true, 'teste aqui')] } },
    { quem: 'atlas', faca: x.real === false ? 'Ainda não publiquei de verdade: esta parte não está ligada neste computador.' : `Pronto! ${x.endereco} está no ar, com cadeado de segurança.`, calma: 'Já pode mandar o endereço para a equipe e para os clientes.', site: { url: x.endereco, titulo: 'No ar', itens: [S('Conexão segura'), S('Funcionando no celular e no computador')] } },
  ] }
}

export function guiaDominio(x: ContextoGuia): Guia {
  const dados = (x.dns ?? []).map((r) => ({ tipo: r.tipo, nome: r.nome, valor: r.valor }))
  const campos = (x.dns ?? []).map((r) => C(`Tipo: ${r.tipo} · Dados: ${r.valor}`, true, r.tipo === 'A' ? 'cole a 1ª linha' : 'cole a 2ª linha'))
  return { id: 'dominio', nome: 'Seu domínio', titulo: `Seu próprio endereço: ${x.dominio}`, intro: 'O Registro.br é o cartório dos endereços .com.br. O domínio fica no seu nome e o Atlas te acompanha até ele estar no ar.', passos: [
    { quem: 'atlas', auto: 'nome', abre: 'registro', faca: `O Atlas conferiu: ${x.dominio} está livre. Clique no botão verde para abrir o Registro.br já com o nome pesquisado.`, calma: 'O Registro.br é o site oficial dos endereços .com.br no Brasil.', site: { url: 'registro.br', titulo: `${x.dominio} está disponível`, itens: [B('Registrar', true)] } },
    { quem: 'voce', faca: 'Clique em Registrar. Depois entre com a sua conta. Não tem? Clique em Criar conta e use o seu CPF ou o CNPJ da empresa.', calma: 'O domínio fica no seu nome, para sempre seu. O Atlas nunca vê a sua senha.', site: { url: 'registro.br/login', titulo: 'Entre para continuar', itens: [C('CPF ou CNPJ', true, 'seu CPF ou CNPJ'), C('Senha'), B('Entrar'), B('Criar conta')] } },
    { quem: 'voce', faca: 'Escolha por quantos anos quer o endereço e pague com Pix.', calma: 'Custa cerca de R$ 40 por ano. O Pix confirma em minutos; o boleto pode levar até 3 dias. O pagamento é só seu: o Atlas espera e te avisa.', site: { url: 'registro.br/pagamento', titulo: 'Pagamento', itens: [B('1 ano'), B('Pagar com Pix', true)] } },
    { quem: 'voce', faca: `Pagamento confirmado! Agora vamos ligar o endereço ao seu sistema. Abra o domínio ${x.dominio} e clique em DNS.`, calma: 'DNS é a "placa" que mostra para a internet onde fica o seu sistema.', site: { url: 'registro.br/painel', titulo: 'Meus domínios', itens: [B(x.dominio, true, 'abra este'), B('DNS')] } },
    { quem: 'voce', auto: 'dns', faca: 'Clique em Editar zona e crie estas duas linhas. Use os botões Copiar e cole lá, uma de cada vez.', calma: 'Não precisa entender o que é: o Atlas já preparou tudo, lendo na hora o que a Vercel pede. É só copiar e colar.', dados, site: { url: 'registro.br/painel/dns', titulo: 'Editar zona', itens: campos } },
    { quem: 'voce', faca: 'Clique em Salvar. Pronto, a sua parte acabou!', calma: 'Daqui pra frente o Atlas faz o resto sozinho.', site: { url: 'registro.br/painel/dns', titulo: 'Editar zona', itens: [B('Salvar alterações', true)] } },
    { quem: 'atlas', auto: 'espera', faca: 'O Atlas está esperando a internet reconhecer o novo endereço.', calma: 'Pode levar de alguns minutos a algumas horas. Pode fechar e fazer outra coisa: o Atlas avisa no celular quando estiver no ar.', site: { url: x.dominio, titulo: 'Procurando o seu endereço na internet…', itens: [S('Conferindo a cada 5 minutos')] } },
    { quem: 'atlas', faca: `Pronto! ${x.dominio} está no ar, com cadeado de segurança.`, calma: `O endereço grátis (${x.slug}.vercel.app) continua funcionando e leva para o mesmo lugar.`, site: { url: x.dominio, titulo: `${x.obra} · Sua vez, sem fila.`, itens: [S('Conexão segura'), B('Marcar horário')] } },
  ] }
}

export function guiaPwa(x: ContextoGuia): Guia {
  return { id: 'pwa', nome: 'App instalável', titulo: 'App instalável, sem loja', intro: 'Seus clientes instalam pelo navegador e o ícone fica na tela do celular, igual a um aplicativo.', passos: [
    { quem: 'atlas', faca: 'O Atlas prepara o ícone do app (a sua logomarca) e o nome que aparece na tela do celular.', calma: 'É o que faz o sistema parecer um aplicativo de verdade quando o cliente instala.', site: { url: x.endereco, titulo: 'Ícone e nome do app', itens: [S(`Ícone ${x.obra} em todos os tamanhos`), S('Abre em tela cheia, sem barra do navegador')] } },
    { quem: 'voce', faca: 'Teste no Android: abra o endereço no Chrome, toque nos três pontinhos e depois em Instalar app.', calma: 'Em alguns celulares o nome é "Adicionar à tela inicial".', en: 'Install app', pt: 'Instalar app', site: { url: x.endereco, titulo: 'Chrome no Android', itens: [B('⋮  (três pontinhos)'), B('Instalar app', true)] } },
    { quem: 'voce', faca: 'Teste no iPhone: abra o endereço no Safari, toque em Compartilhar (o quadrado com a setinha) e depois em Adicionar à Tela de Início.', calma: 'No iPhone tem que ser pelo Safari. O Atlas avisa isso para os seus clientes.', en: 'Add to Home Screen', pt: 'Adicionar à Tela de Início', site: { url: x.endereco, titulo: 'Safari no iPhone', itens: [B('Compartilhar'), B('Adicionar à Tela de Início', true)] } },
    { quem: 'atlas', auto: 'cartaz', faca: 'O Atlas cria um cartaz com QR code e as instruções, para você imprimir no balcão ou mandar no WhatsApp.', calma: 'Assim os seus clientes instalam sozinhos, sem precisar de você.', site: { url: 'cartaz do Atlas', titulo: `Instale o app da ${x.obra}`, itens: [S('QR code'), S('Android: Instalar app · iPhone: Compartilhar → Tela de Início')] } },
    { quem: 'atlas', faca: 'Pronto! O app instalável está funcionando no Android e no iPhone.', calma: 'Não precisa de loja nem de pagamento. Quando você mudar algo no sistema, o app atualiza sozinho.', site: { url: 'tela inicial do celular', titulo: `${x.obra} instalado`, itens: [S('Android'), S('iPhone')] } },
  ] }
}

export function guiaLojas(x: ContextoGuia): Guia {
  return { id: 'lojas', nome: 'App Store e Google Play', titulo: 'Nas lojas: App Store e Google Play', intro: 'O caminho mais longo: tem contas, pagamentos e revisão das lojas. O Atlas acompanha cada passo até o app aparecer na busca.', passos: [
    { quem: 'atlas', auto: 'adaptador', faca: 'Antes de tudo: para ir para as lojas, o Atlas transforma o seu sistema num app de celular de verdade.', calma: 'A Apple recusa app que é só um site embrulhado. Por isso o Atlas faz um app próprio, com o mesmo visual e os mesmos dados.', site: { url: 'Atlas', titulo: 'Preparando o app das lojas', itens: [S(`Montando o app ${x.obra}`)] } },
    { quem: 'voce', abre: 'apple-inscricao', faca: 'Crie a sua conta de desenvolvedor da Apple. Clique em Start Your Enrollment e entre com o seu Apple ID.', calma: 'Custa US$ 99 por ano, e o pagamento é seu. Se for no nome da empresa, a Apple pede o número D-U-N-S, que é grátis mas pode levar alguns dias. O Atlas te ajuda a pedir.', en: 'Start Your Enrollment', pt: 'Começar a inscrição', site: { url: 'developer.apple.com/programs/enroll', titulo: 'Apple Developer Program', itens: [B('Start Your Enrollment', true)] } },
    { quem: 'voce', abre: 'google-console', faca: 'Crie a sua conta no Google Play Console e pague a taxa única.', calma: 'Custa US$ 25, uma vez só, e o pagamento é seu. O Google pede um documento com foto para confirmar quem você é.', en: 'Create account', pt: 'Criar conta', site: { url: 'play.google.com/console/signup', titulo: 'Google Play Console', itens: [B('Create account', true)] } },
    { quem: 'atlas', auto: 'adaptador', faca: 'Enquanto as contas são aprovadas, o Atlas prepara tudo o que as lojas pedem: textos, telas de exemplo, ícone e política de privacidade.', calma: 'Você só vai conferir. Ninguém precisa escrever nada do zero.', site: { url: 'Atlas', titulo: 'Material das lojas', itens: [S('Textos e descrição'), S('6 telas de exemplo'), S('Política de privacidade')] } },
    { quem: 'voce', abre: 'app-store-connect', faca: 'Crie o app no App Store Connect: clique no + e em New App. Copie e cole o que o Atlas preparou.', calma: 'O identificador nunca mais muda depois de publicado. Por isso o Atlas já escolheu um bom.', en: 'New App', pt: 'Novo app', dados: [{ tipo: 'Nome', nome: '', valor: x.obra }, { tipo: 'ID', nome: '', valor: `br.com.${x.slug}.app` }], site: { url: 'appstoreconnect.apple.com/apps', titulo: 'Apps', itens: [B('+', true, 'comece aqui'), B('New App')] } },
    { quem: 'voce', faca: 'Na primeira vez, vai abrir a janela oficial da Apple para você entrar com o seu Apple ID. Confirme com o código que aparece no seu iPhone.', calma: 'É só desta vez. O Atlas não vê nem guarda a sua senha nem o código: quem entra é você, na página da Apple. Nas próximas versões o envio é automático.', site: { url: 'Apple ID', titulo: 'Entrar com o Apple ID', itens: [C('seu Apple ID', true, 'seu e-mail da Apple'), C('código de 6 números')] } },
    { quem: 'atlas', auto: 'adaptador', faca: 'O Atlas monta o app na nuvem e envia para teste: TestFlight (Apple) e teste interno (Google).', calma: 'Funciona no seu computador com Windows. Não precisa de Mac.', site: { url: 'Atlas', titulo: 'Enviando para teste', itens: [S('iPhone: no TestFlight'), S('Android: no teste interno')] } },
    { quem: 'voce', abre: 'testflight', faca: 'Teste no seu celular: instale o app TestFlight no iPhone e abra o convite que chegou no seu e-mail.', calma: 'No Android, o convite de teste abre direto na Play Store.', site: { url: 'TestFlight', titulo: `${x.obra} · Teste`, itens: [B('Instalar', true)] } },
    { quem: 'voce', faca: 'Só no Google, para conta pessoal nova: chame 12 pessoas para testar o app por 14 dias.', calma: 'É uma regra do Google. O Atlas prepara a mensagem pronta para você mandar no WhatsApp e conta os dias.', site: { url: 'play.google.com/console', titulo: 'Teste fechado', itens: [S('Testadores: 12 de 12'), S('Dias de teste: 3 de 14')] } },
    { quem: 'voce', faca: 'Confira e copie as respostas de privacidade e de classificação etária que o Atlas já preencheu.', calma: 'São formulários das lojas. O Atlas respondeu com base no que o seu app realmente faz.', site: { url: 'appstoreconnect.apple.com', titulo: 'App Privacy', itens: [C('Rascunho do Atlas colado', true, 'confira'), B('Save')] } },
    { quem: 'voce', faca: 'Aperte Enviar para revisão, na Apple e no Google.', calma: 'Esse botão é sempre seu: é você quem decide publicar. O Atlas nunca aperta por você.', en: 'Submit for Review', pt: 'Enviar para revisão', site: { url: 'appstoreconnect.apple.com', titulo: `${x.obra} · 1.0`, itens: [B('Submit for Review', true)] } },
    { quem: 'atlas', auto: 'adaptador', faca: 'O Atlas acompanha a revisão e avisa no celular. Se a loja pedir alguma mudança, ele explica e ajusta; você reenvia.', calma: 'A Apple costuma responder em alguns dias. O Google também.', site: { url: 'Atlas', titulo: 'Em revisão', itens: [S('Apple: em revisão'), S('Google: em revisão')] } },
    { quem: 'atlas', auto: 'adaptador', faca: x.real === false ? 'Ainda não publiquei de verdade: esta parte não está ligada neste computador.' : `Publicado! A ${x.obra} está na App Store e no Google Play.`, calma: x.real === false ? 'Quando o Atlas estiver ligado às lojas, é aqui que você vê o app publicado.' : 'Os seus clientes já encontram pelo nome na busca das lojas.', site: { url: 'App Store · Google Play', titulo: `${x.obra} · Sua vez, sem fila.`, itens: [S('App Store'), S('Google Play')] } },
  ] }
}

export function montarGuia(id: IdOpcao, x: ContextoGuia): Guia {
  return { gratis: guiaGratis, dominio: guiaDominio, pwa: guiaPwa, lojas: guiaLojas }[id](x)
}
