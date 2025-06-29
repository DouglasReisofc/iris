const { Client, LocalAuth } = require('whatsapp-web.js');
const os = require('os');
const fs = require('fs');
const chalk = require('chalk');
const path = require('path');
const config = require('./dono/config.json');
const { sendPairingDetails, sendCustomMessage } = require('./func/init/api');
const { execSync } = require('child_process');

let chromePath = '/usr/bin/brave-browser'; // ✅ Caminho atualizado para Brave no Linux

if (os.platform() === 'win32') {
    chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'; // ✅ Brave no Windows
} else if (os.platform() === 'linux') {
    if (fs.existsSync('/usr/bin/brave-browser')) {
        chromePath = '/usr/bin/brave-browser';
    } else if (fs.existsSync('/usr/bin/chromium-browser')) {
        chromePath = '/usr/bin/chromium-browser';
    }
}

const sessionPath = path.join(__dirname, '.wwebjs_auth');
const sessionExists = fs.existsSync(sessionPath);
console.log(sessionExists ? '🔄 Sessão encontrada, tentando restaurar...' : '⚡ Nenhuma sessão encontrada, iniciando novo pareamento.');

let restoreTimeout;

const clientId = config.nomeBot || 'default-bot';

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: clientId
    }),
    puppeteer: {
        executablePath: chromePath,
        headless: false,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-zygote",
            "--disable-session-crashed-bubble",
            "--disable-infobars",
            "--disable-features=site-per-process",
            "--disable-blink-features=AutomationControlled",
            `--proxy-bypass-list=<-loopback>`
        ],
        ignoreHTTPSErrors: true,
        defaultViewport: null
    }
});

async function solicitarPairingCode() {
    try {
        const numeroBot = config.numeroBot;
        if (!numeroBot) {
            console.error('❌ Número do bot não está definido no config.json');
            return;
        }

        console.log(`🔹 Solicitando código de pareamento...`);
        const pairingCode = await client.requestPairingCode(numeroBot);
        console.log(chalk.bold.green(`✅ Código de Pareamento gerado com sucesso.`));

        if (config.numeroDono) {
            await sendPairingDetails(pairingCode);
        }
    } catch (error) {
        console.error('❌ Erro ao gerar o código de pareamento:', error);
    }
}

async function restartClient() {
    console.log('🔄 Reiniciando cliente...');
    try {
        if (client.pupPage) {
            await client.destroy().catch(err => console.error('Erro ao destruir cliente:', err));
        }
    } catch (error) {
        console.error('Erro ao tentar destruir cliente:', error);
    }
    try {
        client.initialize().then(() => {
            console.log('✅ Cliente reiniciado com sucesso.');
            solicitarPairingCode();
        }).catch(err => console.error('Erro ao reiniciar cliente:', err));
    } catch (error) {
        console.error('Erro ao inicializar o cliente:', error);
    }
}

process.on('uncaughtException', (err) => {
    console.error('⚠️ Erro inesperado detectado:', err);
    console.log('🔄 Tentando reiniciar o cliente após erro inesperado...');
    restartClient();
});

client.on('ready', async () => {
    console.log(chalk.green(`🚀 Bot '${config.nomeBot || 'Bot'}' iniciado com sucesso e pronto para uso!`));
    clearTimeout(restoreTimeout);
    if (config.numeroDono) {
        await client.sendMessage(config.numeroDono + '@c.us', `✅ O bot '${config.nomeBot || 'Bot'}' está ativo e pronto para uso!`).catch(err => console.error('Erro ao enviar mensagem ao dono:', err));
    }
});

client.on('auth_failure', async () => {
    console.error('❌ Falha na autenticação! Reiniciando cliente...');
    await sendCustomMessage(config.numeroDono, "⚠️ Falha na autenticação. O bot será reiniciado.").catch(err => console.error('Erro ao enviar mensagem ao dono:', err));
    await restartClient();
});

client.on('disconnected', async (reason) => {
    console.error(`🔌 Conexão perdida (${reason}). Reiniciando cliente...`);
    await sendCustomMessage(config.numeroDono, `⚠️ O bot foi desconectado (${reason}). Reiniciando...`).catch(err => console.error('Erro ao enviar mensagem ao dono:', err));
    await restartClient();
});

client.on('change_state', async (state) => {
    console.log(`🔄 Estado atualizado: ${state}`);
    if (['CONFLICT', 'UNPAIRED', 'UNLAUNCHED', 'BANNED'].includes(state)) {
        console.warn('⚠️ Sessão pode estar inválida. Reiniciando...');
        await sendCustomMessage(config.numeroDono, "⚠️ A sessão foi detectada como inválida. O bot será reiniciado.").catch(err => console.error('Erro ao enviar mensagem ao dono:', err));
        await restartClient();
    }
});

restoreTimeout = setTimeout(() => {
    console.warn('⚠️ Sessão demorando para restaurar. Reiniciando...');
    sendCustomMessage(config.numeroDono, "⚠️ A sessão está demorando para restaurar. O bot será reiniciado.").catch(err => console.error('Erro ao enviar mensagem ao dono:', err));
    restartClient();
}, 200000);

client.initialize().then(() => {
    if (!sessionExists) {
        solicitarPairingCode();
    }
}).catch(error => console.error('Erro ao inicializar o cliente:', error));

module.exports = client;