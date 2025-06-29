// func/bet.js
const moment = require('moment-timezone');
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const client = require('../client.js');
const { MessageMedia } = require('whatsapp-web.js');

// Fuso horário de São Paulo
const TIMEZONE = 'America/Sao_Paulo';

// Caminhos para o banco de dados de horários e imagens
const DB_PATH       = path.join(__dirname, '../db/bet');
const HORARIOS_PATH = path.join(DB_PATH, 'horarios.json');
const IMAGENS_PATH  = path.join(DB_PATH, 'imagens.json');
const IMAGENS_DIR   = path.join(DB_PATH, 'imagens');

// URL de fallback para imagem
const REMOTE_DEFAULT = 'https://raw.githubusercontent.com/DouglasReisofc/imagensplataformas/refs/heads/main/global.jpeg';

// Pausa entre envios (ms)
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retorna o horário atual em "HH:mm"
function obterHorarioAtual() {
  return moment().tz(TIMEZONE).format('HH:mm');
}

// Gera horários aleatórios baseados na hora base
function gerarHorariosAleatorios(horaBase, minI = 0, maxI = 59) {
  const rand = (lo, hi) =>
    String(Math.floor(Math.random() * (hi - lo + 1)) + lo).padStart(2, '0');

  const plataformas = [
    "🐯 FORTUNE TIGER", "🐉 DRAGON LUCK", "🐰 FORTUNE RABBIT", "🐭 FORTUNE MOUSE",
    "🐘 GANESHA GOLD", "👙 BIKINI", "🥊 MUAY THAI", "🎪 CIRCUS", "🐂 FORTUNE OX",
    "💰 DOUBLE FORTUNE", "🐉🐅 DRAGON TIGER LUCK", "🧞 GENIE'S WISHES(GENIO)",
    "🌳🌲 JUNGLE DELIGHT", "🐷 PIGGY GOLD", "👑 MIDAS FORTUNE", "🌞🌛 SUN & MOON",
    "🦹‍♂️ WILD BANDITO", "🔥🕊️ PHOENIX RISES", "🛒 SUPERMARKET SPREE",
    "🚢👨‍✈️ CAPTAIN BOUNTY", "🎃 MISTER HOLLOWEEN", "🍀💰 LEPRECHAUN RICHES"
  ];

  return plataformas.map(name => ({
    name,
    times: Array.from({ length: 7 }, () =>
      `${horaBase}:${rand(minI, maxI)} - ${horaBase}:${rand(minI, maxI)}`
    )
  }));
}

// Monta a mensagem de horários pagantes
function buscarHorarios(horarioAtual) {
  const horaBase = horarioAtual.split(':')[0];
  const sections = gerarHorariosAleatorios(horaBase);

  let msg = `🍀 *SUGESTÃO DE HORÁRIOS PAGANTES DAS ${horaBase}* 💰\n\n`;
  for (const sec of sections) {
    msg += `*${sec.name}*\n`;
    for (const t of sec.times) {
      msg += `  └ ${t}\n`;
    }
    msg += `\n`;
  }
  msg += `Dica: alterne entre giros normais e turbo; se vier um Grande Ganho, PARE e aguarde a próxima brecha!\n`;
  msg += `🔞 NÃO INDICADO PARA MENORES 🔞  •  Jogue com responsabilidade.\n\n`;
  msg += `By Aurora Bot Oficial`;
  return msg;
}

// Converte intervalos "1h" ou "30m" em ms
function converterIntervaloParaMs(intervalo) {
  const m = intervalo.match(/^(\d+)([hm])$/i);
  if (!m) return null;
  const val = Number(m[1]);
  return m[2].toLowerCase() === 'h' ? val * 3600_000 : val * 60_000;
}

// Verifica assinatura ativa via API
async function grupoEstaEmDia(groupId) {
  try {
    const API_KEY = 'teste123supersegura';
    const res = await axios.get(`https://bottechwpp.com/api/groups?apikey=${API_KEY}`);
    if (res.status !== 200 || !Array.isArray(res.data)) return false;

    const info = res.data.find(g => g.group_id === groupId);
    if (!info?.will_expire) return false;

    const exp = moment.tz(info.will_expire, TIMEZONE)
      .set({ hour: 21, minute: 0, second: 0 });
    return moment().tz(TIMEZONE).isBefore(exp);
  } catch {
    return false;
  }
}

// Função que faz a checagem e envia as mensagens
async function verificarHorariosEEnviarMensagens() {
  console.log(
    `[betEnviosLocal] [${new Date().toISOString()}] Checando:`,
    fs.existsSync(HORARIOS_PATH) ? '✔ horarios.json' : '❌ horarios.json',
    fs.existsSync(IMAGENS_PATH)  ? '✔ imagens.json'  : '❌ imagens.json'
  );

  if (!fs.existsSync(HORARIOS_PATH) || !fs.existsSync(IMAGENS_PATH)) {
    console.warn('[betEnviosLocal] Configuração ausente — abortando.');
    return;
  }

  let horariosJson, imagensJson;
  try {
    horariosJson = JSON.parse(fs.readFileSync(HORARIOS_PATH, 'utf-8'));
    imagensJson  = JSON.parse(fs.readFileSync(IMAGENS_PATH, 'utf-8'));
  } catch (e) {
    console.error('[betEnviosLocal] Erro ao ler JSON:', e.message);
    return;
  }

  const nowTs = moment().tz(TIMEZONE).valueOf();

  for (const [groupId, cfg] of Object.entries(horariosJson)) {
    if (!cfg.ativado || !cfg.intervalo) continue;

    const intervaloMs = converterIntervaloParaMs(cfg.intervalo);
    if (!intervaloMs) continue;

    const lastTs = cfg.ultimaNotificacao
      ? moment(cfg.ultimaNotificacao).tz(TIMEZONE).valueOf()
      : 0;
    if (nowTs - lastTs < intervaloMs) continue;

    if (!(await grupoEstaEmDia(groupId))) {
      console.log(`[SKIP] Grupo ${groupId} assinatura vencida.`);
      continue;
    }

    const horarioAtual = obterHorarioAtual();
    const texto = buscarHorarios(horarioAtual);

    // Seleção de mídia
    let media = null;
    for (const fn of [imagensJson[groupId]?.imagem, imagensJson.default?.imagem].filter(Boolean)) {
      const p = path.join(IMAGENS_DIR, fn);
      if (fs.existsSync(p)) {
        try {
          media = MessageMedia.fromFilePath(p);
          break;
        } catch {
          console.warn('[betEnviosLocal] Erro lendo imagem:', fn);
        }
      }
    }
    if (!media) {
      try {
        media = await MessageMedia.fromUrl(REMOTE_DEFAULT);
      } catch {
        console.error('[betEnviosLocal] Fallback remoto falhou');
      }
    }

    // Envio
    try {
      if (media) {
        await client.sendMessage(groupId, media, { caption: texto });
      } else {
        await client.sendMessage(groupId, texto);
      }
      console.log(`[betEnviosLocal] Enviado em ${horarioAtual} para ${groupId}`);
      cfg.ultimaNotificacao = moment().tz(TIMEZONE).toISOString();
      fs.writeFileSync(HORARIOS_PATH, JSON.stringify(horariosJson, null, 2), 'utf-8');
    } catch (err) {
      console.error(`[betEnviosLocal] Falha no envio p/ ${groupId}:`, err.message);
    }

    await sleep(2000);
  }
}

// --- Loop interno de verificações ---
function iniciarLoop() {
  console.log('🔔 [betEnviosLocal] Loop de horários iniciado.');
  // chamada imediata
  verificarHorariosEEnviarMensagens();
  // chamadas periódicas a cada minuto
  setInterval(() => {
    verificarHorariosEEnviarMensagens();
  }, 60 * 1000);
}

// Inicia o loop assim que o arquivo for carregado
iniciarLoop();

module.exports = {
  obterHorarioAtual,
  buscarHorarios,
  verificarHorariosEEnviarMensagens
};
