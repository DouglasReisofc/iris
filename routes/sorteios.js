const express = require('express');
const router = express.Router();
const { carregarSorteios, criarSorteio } = require('../func/sorteio.js');
const client = require('../client');
const { Poll } = require('whatsapp-web.js');

// Listar todos os sorteios existentes
router.get('/listar', (req, res) => {
  const { idGrupo } = req.query;
  const sorteios = carregarSorteios();

  if (idGrupo) {
    const filtrados = sorteios.filter(s => s.idGrupo === idGrupo);
    return res.json(filtrados);
  }
  res.json(sorteios);
});

// Criar um novo sorteio via site COM ENQUETE IGUAL AO COMANDO
router.post('/criar', async (req, res) => {
  const { idGrupo, titulo, duracao, ganhadores, limite } = req.body;

  try {
    console.log(`🔸 Criando sorteio via site para o grupo: ${idGrupo}`);

    const chat = await client.getChatById(idGrupo);
    let mentions = [];
    if (chat && chat.participants) {
      mentions = chat.participants
        .filter(p => p.id && p.id.user)
        .slice(0, 500)
        .map(p => `${p.id.user}@c.us`);
    }

    const options = ['Participar ❤️', 'Não Participar 😬'];

    const pollMsg = await client.sendMessage(
      idGrupo,
      new Poll(titulo, options),
      { mentions }
    );

    const idEnquete = pollMsg.id?._serialized || (pollMsg.id && pollMsg.id.id) || pollMsg.id;

    if (!idEnquete) {
      throw new Error('Não foi possível capturar o ID da enquete.');
    }

    const novo = criarSorteio(
      idGrupo,
      titulo,
      Number(duracao),
      Number(ganhadores),
      Number(limite),
      idEnquete
    );

    console.log(`✅ Sorteio criado no grupo ${idGrupo} | Enquete ID: ${idEnquete}`);

    try {
      const poll = await client.getMessageById(idEnquete);
      if (poll) {
        client.emit('vote_update', {
          parentMessage: poll,
          voter: null,
          selectedOptions: []
        });
        console.log(`✅ vote_update emitido para a enquete: ${idEnquete}`);
      } else {
        console.log('⚠️ Não foi possível encontrar a enquete pelo ID após a criação.');
      }
    } catch (emitErr) {
      console.log('⚠️ Erro ao emitir vote_update:', emitErr.message);
    }

    res.json({ sucesso: true, sorteio: novo });
  } catch (e) {
    console.log('❌ Erro ao criar sorteio/enquete:', e.message);
    res.status(500).json({ erro: 'Erro ao criar sorteio/enquete', detalhe: e.message });
  }
});

module.exports = router;