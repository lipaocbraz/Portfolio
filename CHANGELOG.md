# Changelog

## [3.0.0] - 2026-10-29
### Alterado
- Fundo substituído por uma cena 3D (three.js): o pinguim do mascote sobe uma montanha de neve pela rota real do cenário, passa por um túnel e chega ao cume acenando.
- A cena aparece em miniatura no canto superior direito, com câmera aérea que gira com o scroll. No cume, ela cresce até a tela inteira e a página passa a fazer parte do cenário (céu atrás do conteúdo).
- three.js incluído localmente em `assets/climb/vendor/`, sem CDN.

### Removido
- Fundo de poeira (`background.js`) e agente flutuante (`agent.js`, `assets/mascot/`). Continuam na tag `v2.1.0`.

## [2.1.0] - 2026-10-29
### Adicionado
- Fundo animado em canvas: poeira estelar que, ao rolar, forma o mascote (silhueta e cores do personagem) e depois explode.
- Agente flutuante com o mascote vetorial animado (respira, pisca, acena), que nasce na explosão.
- Tema claro e escuro no fundo, com ajuste de brilho das cores.

## [2.0.0] - 2026-10-28
### Alterado
- Redesenho completo: de vitrine de projetos para um diário vivo (Agora, Projetos, Notas, Log).
- Conteúdo centralizado em `assets/content.js`.
- Tema claro e escuro automático; fonte Inter.

### Removido
- Arquivos da v1 da `main` (continuam na tag `v1.0.0` e no branch `v1`).

## [1.0.0]
- Portfólio original em HTML, CSS e JavaScript.
