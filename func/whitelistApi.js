const axios = require('axios');

// Defina direto o endpoint da sua API Laravel aqui:
const API_URL = 'https://bottechwpp.com/api/whitelist-links';

// Função para buscar links permitidos de um grupo
async function fetchWhitelist(groupId) {
  try {
    const response = await axios.get(API_URL);
    if (!response.data || !Array.isArray(response.data)) return [];

    const links = response.data.filter(item => item.group_id === groupId);
    return links.map(item => item.link);
  } catch (error) {
    console.error('[WHITELIST API] Erro ao buscar whitelist:', error.message);
    return [];
  }
}

module.exports = { fetchWhitelist };