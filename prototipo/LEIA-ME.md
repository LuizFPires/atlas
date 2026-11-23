# Protótipo do Atlas (aprovado em 18/11/2026)

Fonte da verdade da obra. Versão navegável: https://claude.ai/artifact/2gqPXha5vfKL6YcdkXDCsH (página "Fluxo completo").

Cada tela é um arquivo `.dc.html`, um modelo HTML com dados em JavaScript no fim do arquivo:
- `{{...}}` são valores;
- `sc-for` é uma lista;
- `sc-if` é uma condição;
- `dc-import name="Shell"` é o menu lateral;
- `/_blob/<id>` são as imagens da pasta `assets/`.

Todas as telas têm tema escuro (padrão) e claro. As cores de cada tema estão no objeto `T` de cada arquivo.

| Arquivo da imagem | `/_blob/` |
|---|---|
| assets/monograma-fundo-escuro.png | 3ffac3c67d7d512dd74d51dc13a52fb7 |
| assets/monograma-fundo-claro.png | 0f7fdc2ab38162a05663832cd15a027d |
| assets/nome-atlas.png | a8a1f7c17882253fc0bb950b7874b2c2 |
| assets/canteiro-3d.jpg | bfb9db5689c302bc51beabc3a8ef1062 |

## Fluxo (ordem do canvas.json)

| Fase | Tela | O que é |
|---|---|---|
| 0 · Venda | F00Vendas | Página de vendas: vídeo, 3 passos, o que dá para construir, 3D, como funciona, para quem é e não é, preço, dúvidas |
| | F00bCadastro | Pagou: 4 respostas (nome, empresa, o que faz, e-mail) e o e-mail sai |
| 1 · Instalar | F01Email | E-mail de boas-vindas com o botão de instalar |
| | F02Ativacao | Código de 6 dígitos, instalação e 3 avisos (fala, canteiro, pasta) |
| | F03Claude | Login no Claude passo a passo e o plano detectado |
| | F04Contas | GitHub, Supabase e Vercel com guia de mão dada; pagamentos fica para depois |
| | F04bCelular | Computador ligado, acompanhamento pelo app do Claude, frequência das notícias |
| 2 · Projeto | F05Obras | Analogia da casa; começar do zero ou trazer protótipo |
| | F06NovaObra | Perguntas guiadas com microfone |
| | F06bEstilo | Projeto 1/3: estilo (design system) por referências ou identidade existente |
| | F06cTrazer | Caminho alternativo: recado pronto para trazer protótipo de outra IA |
| | F07Prototipo | Projeto 2/3: telas com o Claude |
| | F07bBatismo | Projeto 3/3: nome e logomarca |
| | F08Aprovar | Etapas, prazo no plano do cliente e aviso das lojas |
| 3 · Obra | F09Painel | Obra rodando com o canteiro 3D; ao concluir, "Publicar o sistema" |
| | F10Pausa | Pausa pela cota do Claude |
| | F11Ocorrencia | Precisa do cliente |
| | F12Retomar | Ligou o computador: Continuar obra |
| 4 · Entrega | F13aPublicar | Onde o sistema vai morar (4 opções) |
| | F13bPublicando | Guias de publicação: endereço grátis, domínio, app instalável, lojas |
| | F13Entrega | Entrega das chaves |
| | F14PosObra | Pós-obra: pedir mudança |
| | F15Portal | Portal web do cliente: licença, troca de computador, pagamentos |
| | F16Admin | Painel do administrador (Luiz) |
| | F17Ajuda | Ajuda do Atlas: todo o suporte é o próprio Atlas |
| Componentes | Shell | Menu lateral do app (inclui "Falar com o Atlas" e "Ajuda do Atlas") |
| Identidade | Main, OpcaoA, OpcaoB, OpcaoC | Direções visuais; A (escuro) e B (claro) foram as escolhidas |

As notas amarelas do `canvas.json` (u00 a u17) explicam as regras de cada tela.

## Atlas no celular (PWA) — aprovado em 23/11/2026

Pasta `celular/`, com o próprio `canvas.json`. Canvas navegável: https://claude.ai/artifact/NGEAJp3GeaMCEsUYfS5NFX (comece em M00 · Entrar). As imagens usam os `/_blob/` desse canvas: monograma d75562038b21cd8e298dcfc0c04ef9cd, nome a100dc4e2e64acf4a114194b3e713597, canteiro 212adbee8fe55acdda68303347927aec.

| Tela | O que é |
|---|---|
| Entrar | E-mail da compra e código de 6 números |
| Main | Minhas obras: estado do notebook, começar obra nova, abas Em andamento · Concluídas · Paradas · Excluídas |
| Ideia | Etapa 1 de 3: o relato livre falado, com o texto editável |
| Visual | Etapa 2 de 3: fotos/prints de referência, marca própria ou 3 estilos; cores |
| Desenhando | O notebook desenhando: progresso e o mapa de telas surgindo |
| Prototipo | O app do cliente navegável em tela cheia; ajuste falado na barra de baixo; Aprovar |
| Nome | Etapa 3 de 3: 3 nomes sugeridos ou o nome falado |
| Aprovar | Resumo, 7 etapas, prazo, modo automático ou etapa por etapa; Deixar o Atlas construir |
| Obra | Canteiro com %, "precisa de você", notícias e etapas, pausar, falar com o Atlas |
| Desligado | Notebook desligado: o pedido fica guardado e começa sozinho |
