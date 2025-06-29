const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ID da voz brasileira personalizada (exemplo: Camila, Antonio, etc.)
const VOICE_ID = '2zRM7PkgwBPiau2jvVXc'; // substitua se usar outra voz

// Suas novas 7 chaves de API
const apiKeys = [
  'sk_c6b576abc9fe4608cbf5e7cb3439b2207a9e2218f427e6ae',
  'sk_94a43501da4600f5018e1f09a9e0dde490a6cd012f84174c',
  'sk_5de4d5903f69371ba398c4098e0c5acf53334f99e152121d',
  'sk_05862a637725f39937e8cc462266fd20687584721be847df',
  'sk_36839c1f9bbd293b47b69a0310d19fed5387905b2299a950',
  'sk_263965016125d927300d009ce32cda2e5be8f535d2fe3d3f',
  'sk_f78333b6602f8bc5fdc91ed75976b282013cf209a116e0b1'
];

async function gerarAudio(texto, nomeArquivo) {
  const outputPath = path.join(__dirname, '..', 'audios', nomeArquivo);

  for (const key of apiKeys) {
    try {
      console.log(`[TTS] Tentando com chave: ${key.slice(0, 15)}...`);

      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
        {
          text: texto,
          model_id: "eleven_multilingual_v1",
          voice_settings: {
            stability: 0.4,
            similarity_boost: 0.75
          }
        },
        {
          responseType: 'stream',
          headers: {
            'xi-api-key': key,
            'Content-Type': 'application/json'
          }
        }
      );

      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log(`[TTS] Áudio gerado com sucesso usando ${key.slice(0, 15)}...`);
          resolve(outputPath);
        });
        writer.on('error', reject);
      });

    } catch (err) {
      console.warn(`[TTS] Falha com chave ${key.slice(0, 15)}: ${err.response?.status || err.message}`);
      // continua tentando com a próxima chave
    }
  }

  console.error('❌ Todas as chaves falharam ao tentar gerar o áudio.');
  return null;
}

module.exports = { gerarAudio };