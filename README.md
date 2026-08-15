# Painel de Ocupação de Salas INOVALAB

PWA para visualização rápida da ocupação atual e futura dos espaços do INOVALAB.

## Acesso

- Cloudflare Workers: https://ocupacao-salas-inovalab.rogerio-bittencourt-1a9.workers.dev
- O backend permanece no Google Apps Script e os calendários Google continuam sendo as fontes oficiais.
- A publicação anterior no ChatGPT Sites permanece disponível e não é modificada por esta implantação.

## Público

Equipe responsável pela gestão e operação dos ambientes.

## Funcionalidades

- estado livre, ocupado ou reservado de cada sala;
- horários de início e término dos eventos;
- indicadores de ocupação dos quatro espaços;
- visão adequada para monitores, computadores, tablets e celulares;
- atualização dos dados sem acesso direto aos calendários;
- instalação e compartilhamento como PWA.

## Arquitetura e integrações

A interface `public/ocupacao.html` consome `/api/ocupacao`. A API consulta o Apps Script, que consolida os eventos das agendas Google de cada espaço. As agendas permanecem como fontes oficiais.

## Estrutura

- `app/`: aplicação e API serverless;
- `public/ocupacao.html`: painel visual;
- `google-apps-script/`: integração com os calendários;
- `public/`: manifesto, ícones e favicon.

## Desenvolvimento

```bash
pnpm install
pnpm dev
pnpm test
pnpm run build
pnpm run deploy
```

## Operação

Ao incluir ou substituir uma agenda, atualize o backend Google, confirme o fuso horário e teste eventos simultâneos e eventos de dia inteiro.

## Acervo complementar

Os manuais, capturas, ícones e o pack oficial preservados em `1. Projetos` estão catalogados em [`docs/acervo-google-drive.md`](docs/acervo-google-drive.md).

## Licença

Projeto de uso institucional do INOVALAB — IFSC Câmpus Continente.
