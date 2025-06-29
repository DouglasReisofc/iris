const client = require('../client.js');
const { MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');
const yts = require('yt-search');

// Constantes globais
const BASE_URL = 'https://botadmin.shop/api/download';
const API_KEY = 'equipevipadm';

// Função nova para o comando !play / !ytmp3
const processPlayCommand = async (termoBusca, chatId) => {
    try {
        const chat = await client.getChatById(chatId);
        await chat.sendStateTyping();

        const searchResponse = await axios.get(`${BASE_URL}/ytsearch`, {
            params: {
                apikey: API_KEY,
                nome: termoBusca
            }
        });

        const resultados = searchResponse.data?.resultados;
        if (!resultados || resultados.length === 0) {
            await client.sendMessage(chatId, '❌ Nenhum resultado encontrado para sua pesquisa.');
            return;
        }

        const video = resultados[0];
        const videoUrl = video.url;
        const titulo = video.title;
        const autor = video.author?.name || 'Desconhecido';
        const views = video.views?.toLocaleString() || 'N/A';
        const duracao = video.timestamp || 'Desconhecida';
        const thumbUrl = video.thumbnail || video.image;

        const legenda = `🎵 *Título:* ${titulo}
👤 *Autor:* ${autor}
👀 *Visualizações:* ${views}
⏱ *Duração:* ${duracao}
🔗 ${videoUrl}`;

        if (thumbUrl) {
            const thumb = await MessageMedia.fromUrl(thumbUrl);
            await client.sendMessage(chatId, thumb, { caption: legenda });
        } else {
            await client.sendMessage(chatId, legenda);
        }

        const downloadResponse = await axios.get(`${BASE_URL}/globalvideo`, {
            params: {
                url: videoUrl,
                apikey: API_KEY
            }
        });

        const dados = downloadResponse.data?.dados;
        if (!dados || !dados.video_url) {
            await client.sendMessage(chatId, '❌ Falha ao baixar o vídeo.');
            return;
        }

        const media = await MessageMedia.fromUrl(dados.video_url, {
            filename: `${titulo}.mp4`,
            mimeType: 'video/mp4',
            unsafeMime: true,
        });

        await client.sendMessage(chatId, media);

    } catch (error) {
        console.error('Erro no comando play:', error);
        await client.sendMessage(chatId, '❌ Ocorreu um erro ao processar o comando. Tente novamente.');
    }
};

// As demais funções mantidas conforme solicitado
// (TikTok, Kwai, Facebook, Instagram, YouTube)

const processTikTokMedia = async (link, chatId) => {
    try {
        const chat = await client.getChatById(chatId);
        chat.sendStateTyping();

        const response = await axios.get(`${BASE_URL}/tiktok`, {
            params: { url: link, apikey: API_KEY }
        });

        if (response.data && response.data.code === 0) {
            const mediaData = response.data.data;
            const caption = `🎬 *Título*: ${mediaData.title || 'Sem título'}
👤 *Autor*: ${mediaData.author.nickname || 'Desconhecido'} (@${mediaData.author.unique_id || 'N/A'})
👀 *Visualizações*: ${mediaData.play_count || 'N/A'}
❤️ *Curtidas*: ${mediaData.digg_count || 'N/A'}
💬 *Comentários*: ${mediaData.comment_count || 'N/A'}
🔗 *Compartilhamentos*: ${mediaData.share_count || 'N/A'}
🎵 *Música*: ${mediaData.music_info.title || 'Sem título'} por ${mediaData.music_info.author || 'Desconhecido'}`;

            if (mediaData.images?.length > 0) {
                for (const imageUrl of mediaData.images) {
                    const media = await MessageMedia.fromUrl(imageUrl, {
                        filename: `TikTokImage_${Date.now()}.jpeg`,
                        mimeType: 'image/jpeg',
                    });
                    await client.sendMessage(chatId, media);
                }
                await client.sendMessage(chatId, caption);
            } else if (mediaData.play) {
                let mediaUrl = mediaData.play;
                if (!mediaUrl.endsWith('.mp4')) mediaUrl += '.mp4';

                const media = await MessageMedia.fromUrl(mediaUrl, {
                    filename: `${mediaData.title || 'TikTok'}.mp4`,
                    mimeType: 'video/mp4',
                    unsafeMime: true,
                });

                await client.sendMessage(chatId, media);
            } else {
                await client.sendMessage(chatId, 'Nenhuma mídia disponível no link fornecido.');
            }
        } else {
            throw new Error('Erro ao obter dados da API do TikTok.');
        }
    } catch (error) {
        await client.sendMessage(chatId, '❌ Ocorreu um erro ao processar o link. Tente novamente mais tarde.');
    }
};

const processKwaiMedia = async (link, chatId) => {
    await processGenericGlobalMedia(link, chatId, 'Kwai');
};

const processFacebookMedia = async (link, chatId) => {
    await processGenericGlobalMedia(link, chatId, 'Facebook');
};

const processInstagramMedia = async (link, chatId) => {
    await processGenericGlobalMedia(link, chatId, 'Instagram');
};

const processGenericGlobalMedia = async (link, chatId, origem = 'Mídia') => {
    try {
        const chat = await client.getChatById(chatId);
        chat.sendStateTyping();

        const response = await axios.get(`${BASE_URL}/globalvideo`, {
            params: { url: link, apikey: API_KEY }
        });

        if (response.data?.status === true) {
            const mediaData = response.data.dados;
            const videoUrl = mediaData.video_url;
            const titulo = mediaData.titulo || 'Sem título';
            const uploader = mediaData.uploader || 'Desconhecido';
            const viewCount = mediaData.view_count || 'N/A';
            const likeCount = mediaData.like_count || 'N/A';
            const duration = mediaData.duration || 'Desconhecido';
            const descricao = mediaData.descricao || 'Sem descrição';

            const caption = `🎬 *Título*: ${titulo}
👤 *Autor*: ${uploader}
👀 *Visualizações*: ${viewCount}
❤️ *Curtidas*: ${likeCount}
⏱ *Duração*: ${duration}
💬 *Descrição*: ${descricao}`;

            if (mediaData.thumbnail) {
                const thumbnailMedia = await MessageMedia.fromUrl(mediaData.thumbnail);
                await client.sendMessage(chatId, thumbnailMedia, { caption });
            }

            const videoMedia = await MessageMedia.fromUrl(videoUrl, {
                filename: `${titulo}.mp4`,
                mimeType: 'video/mp4',
                unsafeMime: true,
            });

            await client.sendMessage(chatId, videoMedia);
        } else {
            await client.sendMessage(chatId, `❌ Não foi possível processar o link do ${origem}.`);
        }
    } catch (error) {
        await client.sendMessage(chatId, `❌ Erro ao processar o link do ${origem}.`);
    }
};

const downloadVideoFromYouTube = async (videoUrl, chatId) => {
    try {
        const chat = await client.getChatById(chatId);
        chat.sendStateTyping();

        const response = await axios.get(`${BASE_URL}/globalvideo`, {
            params: { url: videoUrl, apikey: API_KEY }
        });

        if (response.data?.status === true) {
            const videoData = response.data.dados;
            const videoUrl = videoData.video_url;
            const titulo = videoData.titulo || 'Vídeo do YouTube';
            const thumbnail = videoData.thumbnail || '';
            const views = videoData.view_count || 'N/A';
            const likes = videoData.like_count || 'N/A';
            const uploader = videoData.uploader || 'Desconhecido';
            const descricao = videoData.descricao || 'Sem descrição';

            const info = `🎬 *Título*: ${titulo}
👀 *Visualizações*: ${views}
👍 *Curtidas*: ${likes}
👤 *Uploader*: ${uploader}
💬 *Descrição*: ${descricao}`;

            if (thumbnail) {
                const media = await MessageMedia.fromUrl(thumbnail);
                await client.sendMessage(chatId, media, { caption: info });
            }

            const media = await MessageMedia.fromUrl(videoUrl, {
                filename: `${titulo}.mp4`,
                mimeType: 'video/mp4',
                unsafeMime: true,
            });

            await client.sendMessage(chatId, media);
        } else {
            await client.sendMessage(chatId, '❌ Não foi possível obter o vídeo da API.');
        }
    } catch (error) {
        await client.sendMessage(chatId, '❌ Ocorreu um erro ao baixar o vídeo. Tente novamente.');
    }
};

module.exports = {
    processPlayCommand,
    processTikTokMedia,
    processKwaiMedia,
    processFacebookMedia,
    processInstagramMedia,
    downloadVideoFromYouTube,
};
