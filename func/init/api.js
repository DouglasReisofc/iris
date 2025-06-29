const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const config = require(path.resolve(__dirname, '../../dono/config.json'));

async function sendPairingDetails(pairingCode) {
  const message = `
🔑 Seu código de pareamento é:

        ${pairingCode}

🤖 Informações do Bot:
- Nome: ${config.nomeBot}
- Número do Bot: ${config.numeroBot}
- Prefixo: ${config.prefixo}
- Site da API: ${config.siteapi}
`;

  try {
    // Envio via E-mail (SMTP)
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // SSL
      auth: {
        user: 'contactgestorvip@gmail.com',
        pass: 'aoqmdezazknbbpgf'
      }
    });

    const mailOptions = {
      from: '"Bot AssinaZap" <contactgestorvip@gmail.com>',
      to: 'apps100gh@gmail.com',
      subject: '🔑 Código de Pareamento do Bot',
      text: message
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(chalk.green(`✅ E-mail enviado com sucesso! ID: ${info.messageId}`));

  } catch (error) {
    console.error(
      chalk.red('❌ Erro ao enviar o e-mail:'),
      error.message
    );
  }
}

async function sendCustomMessage(_, message) {
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: 'contactgestorvip@gmail.com',
        pass: 'aoqmdezazknbbpgf'
      }
    });

    const mailOptions = {
      from: '"Bot AssinaZap" <contactgestorvip@gmail.com>',
      to: 'apps100gh@gmail.com',
      subject: '📩 Mensagem personalizada do bot',
      text: message
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(chalk.green(`✅ Mensagem enviada com sucesso por e-mail! ID: ${info.messageId}`));

  } catch (error) {
    console.error(
      chalk.red('❌ Erro ao enviar a mensagem por e-mail:'),
      error.message
    );
  }
}

module.exports = { sendPairingDetails, sendCustomMessage };
