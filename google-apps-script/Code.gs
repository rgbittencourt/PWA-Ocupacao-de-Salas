/**
 * ============================================================================
 * PAINEL DE OCUPAÇÃO DE SALAS — INOVALAB
 * IFSC Campus Continente
 * ============================================================================
 * Projeto STANDALONE e ISOLADO — não compartilhar doGet() com outros apps
 * (Mapa de Armários, Termos, Central de Relatórios, Painel Operacional, etc).
 *
 * Lê as 4 agendas do Google Calendar via CalendarApp (não usa planilha) e
 * calcula, em tempo real, ocupação, horas, rankings, mapa de calor e insights
 * para as 4 salas: Podcast/Videocast, Lab. de Mídias Digitais, Webconf e
 * Estúdio de Gravação.
 * ============================================================================
 */

// ===================== CONFIGURAÇÃO — AJUSTE AQUI =====================

// IDs das agendas do Google Calendar de cada sala
const CALENDARIOS = {
  podcast: 'podcast.inovalab.cte@gmail.com',
  lab:     'lmd.inovalab.cte@gmail.com',
  webconf: 'webconf.inovalab.cte@gmail.com',
  estudio: 'estudio.inovalab.cte@gmail.com'
};

const SALA_LABEL = {
  podcast: 'Podcast / Videocast',
  lab:     'Lab. de Mídias Digitais',
  webconf: 'Webconf (01 · 02 · 03)',
  estudio: 'Estúdio de Gravação'
};

const SALA_ICON = {
  podcast: 'ti-microphone',
  lab:     'ti-devices',
  webconf: 'ti-wifi',
  estudio: 'ti-video'
};

const SALA_COR = {
  podcast: 'teal',
  lab:     'blue',
  webconf: 'purple',
  estudio: 'amber'
};

// Capacidade SEMANAL de cada sala, em horas úteis disponíveis para reserva.
// A % de ocupação é calculada como: horas reservadas ÷ (capacidade semanal × nº de semanas do período).
// AJUSTE estes valores para refletir o horário real de funcionamento de cada espaço.
const CAPACIDADE_SEMANAL_HORAS = {
  podcast: 15,    // ex.: seg-sex, ~3h/dia úteis de gravação
  lab:     17.5,  // ex.: seg-sex, ~3,5h/dia
  webconf: 36,    // 3 máquinas x 12h/semana cada
  estudio: 19     // ex.: seg-sex, ~3,8h/dia
};

// Nomes das máquinas da Webconf, usados para tentar identificar qual máquina
// foi reservada a partir do TÍTULO ou LOCAL do evento (ex.: "Webconf 02 - Fulano").
const WEBCONF_MAQUINAS = ['Webconf 01', 'Webconf 02', 'Webconf 03'];

// ===================== WEB APP =====================

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'getOcupacaoData') {
    try {
      var resultado = getOcupacaoData(e.parameter.periodo || 'ano');
      return ContentService.createTextOutput(JSON.stringify(resultado))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        erro: true,
        mensagem: err.message || String(err)
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Ocupação dos Espaços — INOVALAB')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Função principal chamada pelo front-end via google.script.run.
 * periodo: 'semana' | 'mes' | 'ano'
 */
function getOcupacaoData(periodo) {
  const range = getPeriodoRange_(periodo);
  const salas = {};

  Object.keys(CALENDARIOS).forEach(function (chave) {
    salas[chave] = computeSalaStats_(chave, range);
  });

  const kpis = computeKpis_(salas, range);
  const heatmap = computeHeatmap_(salas);
  const ranking = computeRanking_(salas);
  const insights = computeInsights_(salas);

  return {
    periodo: periodo,
    atualizadoEm: Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'HH:mm'),
    kpis: kpis,
    salas: salas,
    heatmap: heatmap,
    ranking: ranking,
    insights: insights
  };
}

// ===================== CÁLCULO DE PERÍODO =====================

function getPeriodoRange_(periodo) {
  const fim = new Date();
  const inicio = new Date();
  let dias = 7;
  if (periodo === 'mes') dias = 30;
  if (periodo === 'ano') dias = 365;
  inicio.setDate(inicio.getDate() - dias);
  return { inicio: inicio, fim: fim, dias: dias, semanas: dias / 7 };
}

// ===================== ESTATÍSTICAS POR SALA =====================

function computeSalaStats_(chave, range) {
  const cal = CalendarApp.getCalendarById(CALENDARIOS[chave]);
  const eventos = cal ? cal.getEvents(range.inicio, range.fim) : [];

  let horasTotais = 0;
  const solicitantesMap = {}; // nome -> {qtd, horas}
  const proximosEventos = [];
  const porDiaSemana = [0, 0, 0, 0, 0, 0, 0]; // Dom..Sáb
  const maquinas = {}; // apenas para webconf
  let pessoasAtendidas = 0;

  WEBCONF_MAQUINAS.forEach(function (m) { maquinas[m] = 0; });

  eventos.forEach(function (ev) {
    const inicio = ev.getStartTime();
    const fim = ev.getEndTime();
    const horas = (fim - inicio) / (1000 * 60 * 60);
    horasTotais += horas;
    porDiaSemana[inicio.getDay()] += 1;

    const nome = extractSolicitante_(ev);
    if (!solicitantesMap[nome]) solicitantesMap[nome] = { qtd: 0, horas: 0 };
    solicitantesMap[nome].qtd += 1;
    solicitantesMap[nome].horas += horas;

    pessoasAtendidas += extractNumeroParticipantes_(ev);

    if (chave === 'webconf') {
      const maquina = extractMaquinaWebconf_(ev);
      if (maquina && maquinas.hasOwnProperty(maquina)) maquinas[maquina] += 1;
    }

    if (inicio >= new Date()) {
      proximosEventos.push({
        data: Utilities.formatDate(inicio, 'America/Sao_Paulo', 'dd/MM HH:mm'),
        nome: nome,
        duracao: formatDuracao_(horas)
      });
    }
  });

  proximosEventos.sort(function (a, b) { return a.data.localeCompare(b.data); });

  const capacidadeHoras = CAPACIDADE_SEMANAL_HORAS[chave] * range.semanas;
  const ocupacaoPct = capacidadeHoras > 0
    ? Math.round((horasTotais / capacidadeHoras) * 100)
    : 0;

  const solicitantes = Object.keys(solicitantesMap)
    .map(function (nome) {
      return { nome: nome, qtd: solicitantesMap[nome].qtd, horas: solicitantesMap[nome].horas };
    })
    .sort(function (a, b) { return b.qtd - a.qtd; });

  const totalReservas = eventos.length;
  solicitantes.forEach(function (s) {
    s.pct = totalReservas > 0 ? Math.round((s.qtd / totalReservas) * 100) : 0;
  });

  return {
    chave: chave,
    label: SALA_LABEL[chave],
    icon: SALA_ICON[chave],
    cor: SALA_COR[chave],
    reservas: totalReservas,
    horas: horasTotais,
    horasFormatado: formatDuracao_(horasTotais),
    ocupacaoPct: ocupacaoPct,
    duracaoMedia: totalReservas > 0 ? formatDuracao_(horasTotais / totalReservas) : '—',
    pessoasAtendidas: pessoasAtendidas,
    proximosEventos: proximosEventos.slice(0, 5),
    solicitantes: solicitantes,
    semNomeInformado: totalReservas > 0 && solicitantes.length === 1 && solicitantes[0].nome === 'Não informado',
    pctSemNome: totalReservas > 0
      ? Math.round(((solicitantesMap['Não informado'] ? solicitantesMap['Não informado'].qtd : 0) / totalReservas) * 100)
      : 0,
    porDiaSemana: porDiaSemana,
    maquinas: chave === 'webconf'
      ? WEBCONF_MAQUINAS.map(function (m) {
          return { nome: m, reservas: maquinas[m], pctUso: totalReservas > 0 ? Math.round((maquinas[m] / totalReservas) * 100) : 0 };
        })
      : null
  };
}

/**
 * Extrai o nome do solicitante a partir do evento.
 * ORDEM DE TENTATIVA (ajuste conforme o formato real usado nos formulários):
 *   1. Descrição contendo "Solicitante:" ou "Nome:"
 *   2. Título no formato "Sala - Nome" ou "Nome - Assunto" (após um " - ")
 *   3. E-mail do primeiro convidado (guest), usando a parte antes do @
 *   4. "Não informado"
 *
 * ATENÇÃO: esta é uma heurística. Compartilhe alguns títulos/descrições reais
 * de eventos das agendas para calibrar esta função com precisão.
 */
function extractSolicitante_(ev) {
  const descricao = (ev.getDescription() || '').trim();
  const titulo = (ev.getTitle() || '').trim();

  let m = descricao.match(/(?:Solicitante|Nome)\s*:\s*(.+)/i);
  if (m && m[1]) return m[1].split('\n')[0].trim();

  if (titulo.indexOf(' - ') > -1) {
    const partes = titulo.split(' - ');
    const candidato = partes[partes.length - 1].trim();
    if (candidato) return candidato;
  }

  const guests = ev.getGuestList();
  if (guests && guests.length > 0) {
    const email = guests[0].getEmail();
    if (email) return email.split('@')[0];
  }

  if (titulo) return titulo;

  return 'Não informado';
}

/**
 * Tenta extrair o número de participantes/alunos da descrição do evento
 * (ex.: "Alunos: 24" ou "Participantes: 18"). Retorna 0 se não encontrado.
 */
function extractNumeroParticipantes_(ev) {
  const descricao = (ev.getDescription() || '');
  const m = descricao.match(/(?:Alunos|Participantes)\s*:\s*(\d+)/i);
  if (m && m[1]) return parseInt(m[1], 10);
  return 0;
}

/**
 * Identifica qual máquina da Webconf foi usada, a partir do título ou local.
 */
function extractMaquinaWebconf_(ev) {
  const texto = ((ev.getTitle() || '') + ' ' + (ev.getLocation() || '')).toLowerCase();
  for (let i = 0; i < WEBCONF_MAQUINAS.length; i++) {
    if (texto.indexOf(WEBCONF_MAQUINAS[i].toLowerCase()) > -1) return WEBCONF_MAQUINAS[i];
  }
  return null;
}

function formatDuracao_(horasDecimal) {
  const h = Math.floor(horasDecimal);
  const m = Math.round((horasDecimal - h) * 60);
  if (h === 0 && m === 0) return '0h';
  if (m === 0) return h + 'h';
  return h + 'h' + (m < 10 ? '0' + m : m);
}

// ===================== KPIs =====================

function computeKpis_(salas, range) {
  let totalReservas = 0, horasTotais = 0, pessoasAtendidas = 0, somaOcupacao = 0;
  const chaves = Object.keys(salas);

  chaves.forEach(function (k) {
    totalReservas += salas[k].reservas;
    horasTotais += salas[k].horas;
    pessoasAtendidas += salas[k].pessoasAtendidas;
    somaOcupacao += salas[k].ocupacaoPct;
  });

  return {
    totalReservas: totalReservas,
    horasFormatado: formatDuracao_(horasTotais),
    ocupacaoMediaPct: Math.round(somaOcupacao / chaves.length),
    pessoasAtendidas: pessoasAtendidas
  };
}

// ===================== MAPA DE CALOR =====================

function computeHeatmap_(salas) {
  const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const rooms = Object.keys(salas);
  const matrizBruta = rooms.map(function (k) { return salas[k].porDiaSemana; });

  // Normaliza para 5 níveis (0-4) para colorir o mapa de calor
  const max = Math.max(1, Math.max.apply(null, matrizBruta.map(function (linha) { return Math.max.apply(null, linha); })));
  const matrix = matrizBruta.map(function (linha) {
    return linha.map(function (v) {
      if (v === 0) return 0;
      const nivel = Math.ceil((v / max) * 4);
      return Math.min(4, Math.max(1, nivel));
    });
  });
  const matrixValores = matrizBruta;

  return {
    rooms: rooms.map(function (k) { return SALA_LABEL[k]; }),
    days: dias,
    matrix: matrix,
    matrixValores: matrixValores
  };
}

// ===================== RANKING =====================

function computeRanking_(salas) {
  const chaves = Object.keys(salas);

  const salasPorHoras = chaves
    .map(function (k) {
      return {
        chave: k,
        label: salas[k].label,
        icon: salas[k].icon,
        cor: salas[k].cor,
        horas: salas[k].horas,
        horasFormatado: salas[k].horasFormatado,
        reservas: salas[k].reservas,
        usuariosUnicos: salas[k].solicitantes.length
      };
    })
    .sort(function (a, b) { return b.horas - a.horas; });

  const maxHoras = salasPorHoras.length > 0 ? salasPorHoras[0].horas : 1;
  salasPorHoras.forEach(function (s) {
    s.barraPct = maxHoras > 0 ? Math.round((s.horas / maxHoras) * 100) : 0;
  });

  // Ranking global de solicitantes (soma entre todas as salas)
  const globalMap = {};
  chaves.forEach(function (k) {
    if (salas[k].semNomeInformado) return; // não computar "Não informado" no ranking global
    salas[k].solicitantes.forEach(function (s) {
      if (s.nome === 'Não informado') return;
      if (!globalMap[s.nome]) globalMap[s.nome] = { qtd: 0, salas: {} };
      globalMap[s.nome].qtd += s.qtd;
      globalMap[s.nome].salas[salas[k].label] = (globalMap[s.nome].salas[salas[k].label] || 0) + s.qtd;
    });
  });

  const solicitantesGlobais = Object.keys(globalMap)
    .map(function (nome) {
      const salasStr = Object.keys(globalMap[nome].salas)
        .map(function (l) { return l + ' (' + globalMap[nome].salas[l] + ')'; })
        .join(' + ');
      return { nome: nome, qtd: globalMap[nome].qtd, salasStr: salasStr };
    })
    .sort(function (a, b) { return b.qtd - a.qtd; })
    .slice(0, 8);

  const maxQtd = solicitantesGlobais.length > 0 ? solicitantesGlobais[0].qtd : 1;
  solicitantesGlobais.forEach(function (s) {
    s.barraPct = maxQtd > 0 ? Math.round((s.qtd / maxQtd) * 100) : 0;
  });

  return { salasPorHoras: salasPorHoras, solicitantesGlobais: solicitantesGlobais };
}

// ===================== INSIGHTS =====================

function computeInsights_(salas) {
  const insights = [];
  const chaves = Object.keys(salas);

  // 1) Sala com maior ocupação proporcional
  const maisOcupada = chaves.slice().sort(function (a, b) { return salas[b].ocupacaoPct - salas[a].ocupacaoPct; })[0];
  if (salas[maisOcupada].reservas > 0) {
    insights.push({
      tipo: 'ok',
      icone: 'ti-trending-up',
      titulo: salas[maisOcupada].label + ' com maior taxa de ocupação',
      texto: 'Com ' + salas[maisOcupada].ocupacaoPct + '% de ocupação, ' + salas[maisOcupada].label +
        ' é o espaço mais utilizado proporcionalmente. A demanda está próxima da capacidade — considere abrir mais horários ou criar lista de espera.'
    });
  }

  // 2) Salas com problema de dados (solicitante não informado)
  chaves.forEach(function (k) {
    if (salas[k].reservas > 0 && salas[k].pctSemNome >= 80) {
      insights.push({
        tipo: 'alerta',
        icone: 'ti-alert-triangle',
        titulo: salas[k].label + ' sem dados de solicitantes',
        texto: salas[k].pctSemNome + '% das ' + salas[k].reservas + ' reservas de ' + salas[k].label +
          ' estão sem o nome do solicitante. Verifique se o campo do formulário de agendamento está obrigatório.'
      });
    }
  });

  // 3) Concentração em um único usuário
  chaves.forEach(function (k) {
    if (salas[k].solicitantes.length > 0 && salas[k].solicitantes[0].nome !== 'Não informado' && salas[k].solicitantes[0].pct >= 50) {
      insights.push({
        tipo: 'concentracao',
        icone: 'ti-users',
        titulo: salas[k].label + ' concentrado em 1 pessoa',
        texto: salas[k].solicitantes[0].nome + ' é responsável por ' + salas[k].solicitantes[0].pct + '% das reservas de ' +
          salas[k].label + '. Vale divulgar o espaço para outros professores para reduzir a dependência.'
      });
    }
  });

  // 4) Sala com maior capacidade ociosa (menor ocupação, mas com uso relevante)
  const menosOcupada = chaves.slice().filter(function (k) { return salas[k].reservas > 0; })
    .sort(function (a, b) { return salas[a].ocupacaoPct - salas[b].ocupacaoPct; })[0];
  if (menosOcupada) {
    insights.push({
      tipo: 'oportunidade',
      icone: 'ti-clock',
      titulo: salas[menosOcupada].label + ' com capacidade ociosa',
      texto: 'Com ' + salas[menosOcupada].ocupacaoPct + '% de ocupação média e ' + salas[menosOcupada].horasFormatado +
        ' reservadas no período, ' + salas[menosOcupada].label + ' tem espaço para crescer.'
    });
  }

  // 5) Dia de pico combinando todas as salas
  const totalPorDia = [0, 0, 0, 0, 0, 0, 0];
  chaves.forEach(function (k) { salas[k].porDiaSemana.forEach(function (v, i) { totalPorDia[i] += v; }); });
  const dias = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  let diaPico = 0;
  totalPorDia.forEach(function (v, i) { if (v > totalPorDia[diaPico]) diaPico = i; });
  if (totalPorDia[diaPico] > 0) {
    insights.push({
      tipo: 'ok',
      icone: 'ti-calendar-check',
      titulo: 'Pico de uso na ' + dias[diaPico],
      texto: 'Combinando todas as salas, ' + dias[diaPico] + ' concentra o maior volume de reservas (' + totalPorDia[diaPico] + ').'
    });
  }

  return insights;
}

// ===================== FUNÇÕES DE DIAGNÓSTICO =====================
// Execute manualmente pelo editor do Apps Script para depurar sem o web app.

function testeConfig() {
  Object.keys(CALENDARIOS).forEach(function (chave) {
    const cal = CalendarApp.getCalendarById(CALENDARIOS[chave]);
    Logger.log(chave + ' → ' + (cal ? 'OK (' + cal.getName() + ')' : 'ERRO: agenda não encontrada ou sem acesso'));
  });
}

function testeOcupacao() {
  const data = getOcupacaoData('mes');
  Logger.log(JSON.stringify(data, null, 2));
}
