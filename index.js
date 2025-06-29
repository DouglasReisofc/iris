const express = require('express');
const client = require('./client');
const config = require('./dono/config.json');

const app = express();
app.use(express.json());
app.use('/sorteios', require('./routes/sorteios'));

// Verifica se um usuário é administrador diretamente no grupo
async function isAdmin(chatId, userId) {
  const chat = await client.getChatById(chatId);
  if (!chat.isGroup) return false;
  const participant = chat.participants.find(p => p.id._serialized === userId);
  return participant ? participant.isAdmin : false;
}

client.on('message', async msg => {
  if (!msg.from.endsWith('@g.us')) return; // apenas grupos
  const userId = msg.author || msg.from;
  const admin = await isAdmin(msg.from, userId);
  console.log(`Mensagem de ${userId} em ${msg.from} - Admin: ${admin}`);
});

const PORT = Number(config.portaexpres) || 7000;
app.listen(PORT, () => console.log(`Servidor express iniciado na porta ${PORT}`));
