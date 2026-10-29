# Contexto do projeto: Portfólio v2 do Felipe Braz

Leia este arquivo inteiro antes de mexer em qualquer coisa. Ele resume o que foi decidido e feito numa conversa anterior (Claude Cowork) e o que falta fazer.

## Quem e o quê
- Dono: Luiz Felipe Cruz Braz (Felipe), estudante de Ciência da Computação no CESAR School. Foco em cibersegurança e sistemas (CTFs, segurança ofensiva, pentest). Monitor de Infraestrutura de Software.
- GitHub: `lipaocbraz` · LinkedIn: `felipecbraz`
- Repositório: https://github.com/lipaocbraz/Portfolio (já existia com um site antigo, a v1).
- Idioma: responda sempre em português brasileiro, de forma direta e humana, sem excesso de formatação. Aponte problemas com honestidade.

## Objetivo da página
Não é uma vitrine para recrutador. É uma página para **o Felipe se apresentar e mostrar o que está fazendo**, atualizada aos poucos ("diário vivo"). Seções: Hero, Agora, Projetos (com status), Notas e writeups, Log, Sobre.

## Direção visual (já aprovada num style board)
- Base **Apple** (muito espaço em branco, tipografia grande, uma ideia por tela) + **bento grid** + atmosfera **Linear/Vercel** (borda fina, gradiente sutil).
- Tema claro e escuro automático (`prefers-color-scheme`).
- Fonte: Inter (fallback system-ui/SF Pro).
- Tokens (em `assets/style.css`):
  - Claro: bg `#FBFBFD`, card `#FFFFFF`, surface `#F5F5F7`, line `#E5E5EA`, ink `#1D1D1F`, muted `#6E6E73`, accent `#0071E3`, ok `#30D158`, warn `#FF9F0A`
  - Escuro: bg `#000`, card `#111113`, surface `#1C1C1E`, line `#2C2C2E`, ink `#F5F5F7`, muted `#98989D`, accent `#2997FF`, ok `#32D74B`
  - Raios: 8/16/24/28/999. Espaçamento em múltiplos de 8.
- Motion: o Felipe pretende implementar no futuro. O CSS já tem `--ease`, `--dur-1/2/3` e respeita `prefers-reduced-motion`.

## Estado atual do código
Site estático, **HTML + CSS + JS puros, sem build**, para GitHub Pages. Exceção aceita pelo Felipe: a cena 3D do topo usa **three.js**, incluído localmente em `assets/climb/vendor/` (sem CDN).

```
index.html          # estrutura e metadados (title, description, Open Graph parcial)
assets/style.css    # tokens claro/escuro e estilos (responsivo)
assets/content.js   # TODO O CONTEÚDO EDITÁVEL (window.CONTENT)
assets/app.js       # renderiza Agora, Projetos, Notas e Log a partir de content.js
assets/logo.png     # logo antigo, usado como favicon
docs/preview.png    # screenshot usado no README
README.md, CHANGELOG.md, LICENSE (MIT)
```

- Atualizar o site = editar `assets/content.js` (agora, projetos, notas, log, `updated`) e dar commit.
- O Felipe escolheu originalmente atualizar via Markdown; na v1 simplificamos para `content.js` (sem build). Migrar para `.md` é uma opção futura, só se a página crescer.
- Testado (Playwright) em 1440px e 390px, claro e escuro: sem erros de console e sem scroll horizontal.

## Git e versionamento
- Repositório local pronto em `~/Desktop/Portfolio-v2` (clone do repo antigo, já com commits).
- **v1** (site antigo): preservada na tag `v1.0.0` e no branch `v1`.
- **v2** (atual): na `main`, tag `v2.0.0`.
- Commits: padrão Conventional Commits (`feat`, `fix`, `docs`, `chore`...). Autor local configurado como `Felipe Braz <felipecbraz@hotmail.com>` (e-mail do histórico antigo; o Felipe pode trocar).
- **O push ainda NÃO foi feito** (a sessão anterior não tinha credencial do GitHub). Comando: `git push origin main v1 --tags`. Se o push da `main` for recusado por causa do histórico, avisar o Felipe antes de qualquer `--force`.
- Regras do projeto: nunca commitar senhas, tokens ou `.env` reais (usar `.env.example`); repositório com descrição, topics e link da landing preenchidos; README com descrição de uma linha, screenshot, funcionalidades, stack, como rodar, estrutura, decisões técnicas e licença.

## O que ainda falta
1. **Fazer o push** e ativar o GitHub Pages (Settings → Pages → branch `main`, raiz). URL esperada: `lipaocbraz.github.io/Portfolio/`. Todos os caminhos no site são relativos, então funciona em subpasta.
2. Preencher metadados quando o endereço estiver no ar: `og:url` e `og:image` (1200x630). Hoje só há `og:title`, `og:description`, `og:type`, `og:locale`.
3. Preencher descrição, topics e link do repositório no GitHub.
4. **Revisar o conteúdo**: os textos de Agora, Projetos e Sobre foram escritos a partir do que se sabia do Felipe. Em especial: o status do Hubrequin ("Em desenvolvimento") **não foi confirmado**, e o link dele aponta provisoriamente para o perfil do GitHub. Notas começa vazia de propósito (não inventar writeups).
5. Screenshots/GIFs reais nos cards de projeto (hoje há um bloco com gradiente como placeholder).
6. ~~Fundo animado~~ **Feito na v3.0.0**: cena 3D em `assets/climb/` (o texto abaixo descreve o pedido original de poeira, que ficou na tag `v2.1.0`).

## Tarefa pendente: fundo animado em canvas com pinguim
Pedido do Felipe (JavaScript puro, sem bibliotecas). Implementar como `assets/background.js` (ou similar) + ajustes no CSS/HTML. Requisitos:

**Conceito.** Canvas fixo atrás de todo o conteúdo (`position: fixed; inset: 0; pointer-events: none; z-index` baixo). Partículas soltas flutuam no hero e, conforme o scroll, se organizam até formar a silhueta de um pinguim na seção final (Sobre/contato). Rolar para cima desmonta. O progresso do scroll (0 a 1) controla a interpolação (lerp) entre posição "solta" e posição "no pinguim", sempre suave, sem saltos.

**Estilo do pinguim.** Minimalista, "desenhado por designer da Apple": formas geométricas simples e arredondadas, sem contorno. Corpo em gota/elipse vertical com cabeça fundida, barriga como elipse clara, bico pequeno e arredondado, olhos como dois pontos, asas como curvas suaves coladas ao corpo, pés mínimos arredondados. Frontal, simétrico, calmo. Reconhecível mesmo só com pontos.

**Geração da forma.** Desenhar em canvas offscreen com elipses/arcos, ler os pixels e transformar os pixels preenchidos em posições-alvo. Separar alvos por região (corpo, barriga, bico/pés, olhos) para colorir cada grupo.

**Partículas.** ~1500 no desktop, ~700 no celular, 1 a 2 px com variação. Estado solto: deriva lenta e orgânica (neve/poeira) com profundidade (algumas maiores e mais opacas, outras menores e mais fracas). Cada partícula guarda posição solta e posição-alvo.

**Cor.** Duas cores neutras (clara e escura) que invertem entre tema claro e escuro via `prefers-color-scheme`. **Uma única cor de destaque (ciano suave)**, só em poucas partículas (olhos e bico). Opacidade geral baixa para não competir com o texto. (Atenção: a paleta atual usa azul `#0071E3`/`#2997FF` como accent; o ciano do pinguim é uma cor extra pedida explicitamente, usar só no canvas.)

**Arco do scroll.**
- Hero: partículas soltas + silhueta do pinguim bem fraca que se desfaz nos primeiros pixels de scroll.
- Projetos: partículas começam a se agrupar em manchas, sem forma definida.
- Notas/writeups: a silhueta já pode ser adivinhada.
- Sobre/contato: pinguim completo e "acorda": olhos acendem em ciano com brilho curto.

**Interação.** Mouse: partículas próximas se afastam e voltam como mola suave, mesmo com o pinguim formado. Com o pinguim completo, expor um ponto de entrada para um futuro chat de agente: função/evento (ex.: `onPenguinClick`) e um estado "falando" que faz as partículas do corpo tremerem ou brilharem de leve.

**Performance e acessibilidade.** `requestAnimationFrame`; limitar `devicePixelRatio` a 2; pausar em `visibilitychange`; respeitar `prefers-reduced-motion` (mostrar o pinguim já formado e estático, sem animação); recalcular alvos e tamanho no `resize` com debounce; no celular, pinguim centralizado; no desktop, posicionado para não cobrir o texto principal. Código organizado e comentado, com parâmetros (quantidade, cores, velocidade, força do mouse) no topo.

Sugestão: o progresso do scroll pode ser calculado por seção (usar `getBoundingClientRect` das seções `#agora`, `#projetos`, `#notas`, `#sobre`) em vez de só `scrollY / altura`, para o arco acompanhar o conteúdo real. Como o canvas fica atrás do texto, garantir contraste (opacidade baixa) nos dois temas.

## Ferramentas e arquivos de apoio (na máquina do Felipe)
- `~/Desktop/Apple-Design/`: mockups feitos no FigCraft (`portfolio-style-board.figcraft` é o style board aprovado; há também v1/v2 de layout e PNGs). O FigCraft está instalado; foi gerado via CLI headless.
- `~/Desktop/portfolio/`: cópia da v2 antes de entrar no repositório (pode ser ignorada; a fonte da verdade é `~/Desktop/Portfolio-v2`).
- Existe uma prévia publicada como artifact do Claude (privada), só para visualização.
- Pasta vazia `Apple-Design/_to_delete_Portfolio-repo`: sobra de um clone que travou; pode apagar.

## Como trabalhar aqui
- Respostas curtas e diretas, em português. Mostrar o que mudou, sem recapitular tudo.
- Antes de commitar: abrir o site localmente (`python3 -m http.server 8000`) e conferir claro/escuro e largura de celular.
- Não inventar conteúdo pessoal (projetos, datas, writeups). Se precisar de um dado, perguntar.
