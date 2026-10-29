# Portfólio · Felipe Braz

Página pessoal onde eu me apresento e registro o que estou estudando e construindo em cibersegurança e sistemas. Feita para ser atualizada aos poucos.

![Pré-visualização](docs/preview.png)

## Versões
| Versão | Onde está |
|---|---|
| **v3** (atual) | branch `main`, tag `v3.0.0` |
| v2 | tags `v2.0.0` e `v2.1.0` (fundo de poeira e agente) |
| v1 (site original) | branch `v1`, tag `v1.0.0` |

Veja o [CHANGELOG](CHANGELOG.md).

## Funcionalidades
- Hero de apresentação com data da última atualização
- **Agora**: o que estou estudando, construindo e praticando
- **Projetos** com status (em andamento, concluído, pausado)
- **Notas e writeups** e **Log** de atualizações
- Tema claro e escuro automático, responsivo

## Stack
HTML, CSS e JavaScript puros, sem build. A cena 3D do topo usa three.js (incluído em `assets/climb/vendor/`, sem CDN). Fonte Inter. Publicado no GitHub Pages.

## Como atualizar
Todo o conteúdo fica em `assets/content.js`. Edite, salve e faça commit.

## Rodar localmente
```bash
python3 -m http.server 8000   # a cena 3D precisa de servidor (não abre por file://)
# abra http://localhost:8000
```

## Estrutura
```
index.html          # estrutura e metadados
assets/style.css    # tokens (claro/escuro) e estilos
assets/content.js   # conteúdo editável
assets/app.js       # monta as listas a partir do conteúdo
assets/logo.png     # ícone
assets/climb/       # cena 3D: montanha, pinguim, rota e three.js (mountain.js é o ponto de entrada)
```

## Decisões técnicas
- Sem framework nem build, para publicar direto no GitHub Pages.
- Conteúdo separado da estrutura, para atualizar sem mexer no HTML.
- Direção visual: base Apple, bento grid e atmosfera Linear/Vercel.
- Motion fica para depois: o CSS já tem tokens (`--ease`, `--dur-*`) e respeita `prefers-reduced-motion`.

## Licença
MIT
