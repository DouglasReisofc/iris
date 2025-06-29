const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');

const statusPath = path.join(__dirname, '..', 'db', 'voz_status.json');
const audiosPath = path.join(__dirname, '..', 'audios');

// Comando !voz 1 ou !voz 0 para ativar/desativar
module.exports = async (client, message) => {
  const args = message.body.trim().split(' ');
  if (args.length < 2) {
    return client.sendMessage(message.from, 'Use *!voz 1* para ativar ou *!voz 0* para desativar');
  }

  const ativo = args[1] === '1';
  fs.writeFileSync(statusPath, JSON.stringify({ ativo }));

  const msg = ativo
    ? '✅ Respostas por voz *ativadas*.'
    : '❌ Respostas por voz *desativadas*.';

  await client.sendMessage(message.from, msg);
};

// Função chamada no index.js para responder com áudio
module.exports.verificarEExecutarResposta = async (client, message) => {
  const status = fs.existsSync(statusPath)
    ? JSON.parse(fs.readFileSync(statusPath))
    : { ativo: true };

  if (!status.ativo) return;

  const frases = {
    'bot corno': ['corna1.ogg', 'corna2.ogg'],
    'bom dia bot': [ 'cantada.ogg' , 'cantada1.ogg', 'cantada2.ogg' , 'cantada3.ogg' , 'cantada4.ogg' , 'cantada5.ogg' , 'cantada6.ogg'],
    'vai dormir': ['dorme1.ogg']
  };

  const texto = message.body.toLowerCase().trim();
  const audios = frases[texto];
  if (!audios || audios.length === 0) return;

  const escolhido = audios[Math.floor(Math.random() * audios.length)];
  const caminho = path.join(audiosPath, escolhido);
  if (!fs.existsSync(caminho)) {
    console.log(`[VOZ] Arquivo não encontrado: ${escolhido}`);
    return;
  }

  const media = await MessageMedia.fromFilePath(caminho);
  await client.sendMessage(message.from, media, { sendAudioAsVoice: true });
  console.log(`[VOZ] Enviado: ${escolhido}`);
};