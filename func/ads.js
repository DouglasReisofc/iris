// src/controllers/adProcessor.js
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');
const moment = require('moment-timezone');
const cron = require('node-cron');

const client = require('../client.js');
const config = require('../dono/config.json');
const numerobot = config.numeroBot;

// Fuso de Manaus
const TIMEZONE = "America/Sao_Paulo";
let isProcessing = false;
const adsMap = new Map(); // Cache em memória: chave = `${id}-${group_identifier}`

// 1) Parse de intervalos: "HH:MM", "HH:MM:SS", "1h 30m", "1m" etc.
function parseInterval(intervalStr) {
  // Formato "HH:MM[:SS]"
  if (/^\d{1,2}:\d{1,2}(:\d{1,2})?$/.test(intervalStr)) {
    const parts = intervalStr.split(':').map(v => parseInt(v, 10));
    let dur = moment.duration(parts[0], 'hours');
    dur.add(parts[1], 'minutes');
    if (parts[2]) dur.add(parts[2], 'seconds');
    return dur;
  }
  // Formato com unidades (hdms)
  const regex = /(\d+)\s*([hdms])/gi;
  let total = moment.duration(0);
  let match;
  while ((match = regex.exec(intervalStr)) !== null) {
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (unit === 'h') total.add(value, 'hours');
    if (unit === 'd') total.add(value, 'days');
    if (unit === 'm') total.add(value, 'minutes');
    if (unit === 's') total.add(value, 'seconds');
  }
  if (total.asMilliseconds() === 0) throw new Error('Intervalo inválido: ' + intervalStr);
  return total;
}

// 2) Carrega ads da API
async function fetchAdsFromAPI() {
  try {
    const ts = moment().tz(TIMEZONE).format();
    console.log(`[${ts}] 🔄 Fetch ads from API...`);
    const { data } = await axios.get(`https://bottechwpp.com/ads/bot/${numerobot}`);
    const ads = Array.isArray(data.ads) ? data.ads : [];
    adsMap.clear();
    ads.forEach(ad => adsMap.set(
      `${ad.id}-${ad.group_identifier}`,
      { ...ad, last_sent_at: ad.last_sent_at || null }
    ));
    console.log(`[${ts}] ✅ ${adsMap.size} ads loaded.`);
  } catch (e) {
    console.error(`[${moment().tz(TIMEZONE).format()}] ❌ Fetch error:`, e.message);
  }
}

// 3) Verifica elegibilidade
function canSendAd(ad) {
  const now = moment().tz(TIMEZONE);
  const last = ad.last_sent_at ? moment.tz(ad.last_sent_at, TIMEZONE) : null;
  let dur;
  try {
    dur = parseInterval(ad.interval);
  } catch {
    return { eligible: false, remainingTime: null };
  }
  if (!last) return { eligible: true, remainingTime: null };
  const diff = now.diff(last);
  if (diff >= dur.asMilliseconds()) return { eligible: true, remainingTime: null };
  return { eligible: false, remainingTime: moment.duration(dur.asMilliseconds() - diff) };
}

// 4) Envia e atualiza last_sent_at via PUT (sem body)
async function sendAndUpdate(ad) {
  const ts = moment().tz(TIMEZONE).format();
  const dest = ad.group_identifier;
  let media;
  if (ad.media_url) {
    try { media = await MessageMedia.fromUrl(ad.media_url, { timeout: 10000 }); }
    catch { console.warn(`[${ts}] ⚠️ Failed media download for ad ${ad.id}`); }
  }
  try {
    if (media) await client.sendMessage(dest, media, { caption: ad.message });
    else await client.sendMessage(dest, ad.message);
    console.log(`[${ts}] 📤 Ad ${ad.id} sent to ${dest}`);

    // Atualiza no backend
    await axios.put(`https://bottechwpp.com/ads/${ad.id}/update-last-sent`);

    // Atualiza cache
    const iso = moment().tz(TIMEZONE).toISOString();
    ad.last_sent_at = iso;
    adsMap.set(`${ad.id}-${ad.group_identifier}`, ad);
    console.log(`[${ts}] ✅ last_sent_at updated for ${ad.id}`);
  } catch (e) {
    console.error(`[${ts}] ❌ Send/update error for ${ad.id}:`, e.message);
  }
}

// 5) Processa um ad por grupo
async function startAdProcessing() {
  if (isProcessing) return;
  isProcessing = true;
  try {
    await fetchAdsFromAPI();
    const groups = new Map();
    // agrupa
    for (let ad of adsMap.values()) {
      const key = ad.group_identifier;
      groups.set(key, (groups.get(key) || []).concat(ad));
    }
    for (let ads of groups.values()) {
      // ordena por last_sent_at asc
      ads.sort((a,b) => {
        const aT = a.last_sent_at ? moment.tz(a.last_sent_at,TIMEZONE) : moment(0);
        const bT = b.last_sent_at ? moment.tz(b.last_sent_at,TIMEZONE) : moment(0);
        return aT.diff(bT);
      });
      // envia o primeiro elegível
      for (let ad of ads) {
        const { eligible } = canSendAd(ad);
        if (eligible) { await sendAndUpdate(ad); }
      }
    }
  } catch (e) {
    console.error(`[${moment().tz(TIMEZONE).format()}] ❌ Process error:`, e.message);
  } finally {
    isProcessing = false;
  }
}

// 6) Exportar iniciarAds
function iniciarAds() {
  client.on('ready', () => {
    console.log('🔔 WhatsApp ready — polling every minute');
    startAdProcessing();
    cron.schedule('*/1 * * * *', startAdProcessing);
  });
}

module.exports = { iniciarAds };
