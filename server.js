const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const bodyParser = require('body-parser');
const chromium = require('@sparticuz/chromium');

const app = express();
app.use(bodyParser.json());

(async () => {
    const executablePath = await chromium.executablePath();
    
    const client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            executablePath,
            args: chromium.args,
            headless: chromium.headless,
            protocolTimeout: 180000
        }
    });

    let isReady = false;
    let currentQR = '';

    client.on('qr', (qr) => {
        currentQR = qr;
        console.log('QR GENERADO - Visit /qr to see it');
        qrcode.generate(qr, {small: true}); // small: true = más pequeño
    });

    client.on('ready', () => {
        console.log('WhatsApp ready!');
        isReady = true;
    });

    client.on('authenticated', () => {
        console.log('Authenticated!');
    });

    client.initialize().catch(err => {
        console.error('Init error:', err);
        process.exit(1);
    });

    app.get('/', (req, res) => {
        res.json({ status: 'running', ready: isReady });
    });

    app.get('/qr', (req, res) => {
        if (currentQR) {
            res.send(`<html><body><h1>Scan this QR with WhatsApp:</h1><pre>${currentQR}</pre></body></html>`);
        } else {
            res.send('<html><body><h1>No QR available - already authenticated or generating...</h1></body></html>');
        }
    });

    app.get('/health', (req, res) => {
        res.json({ status: isReady ? 'ready' : 'connecting' });
    });

    app.post('/send', async (req, res) => {
        const { contact, message } = req.body;
        
        if (!isReady) {
            return res.status(503).json({ error: 'Not ready' });
        }
        
        try {
            const phoneNumber = contact.replace(/[^0-9]/g, '');
            if (phoneNumber.length >= 10) {
                const numberId = `${phoneNumber}@c.us`;
                await client.sendMessage(numberId, message);
                return res.json({ success: true, contact: phoneNumber });
            }
            
            const chats = await client.getChats();
            const chat = chats.find(c => 
                c.name && c.name.toLowerCase().includes(contact.toLowerCase())
            );
            
            if (chat) {
                await client.sendMessage(chat.id._serialized, message);
                return res.json({ success: true, contact: chat.name });
            }
            
            res.status(404).json({ error: 'Contact not found' });
        } catch (error) {
            console.error('Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server on port ${PORT}`);
        console.log(`Visit https://whatsapp-render-bot-dme5.onrender.com/qr to see QR code`);
    });
})();
