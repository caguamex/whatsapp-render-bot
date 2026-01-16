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
            headless: chromium.headless
        }
    });

    let isReady = false;

    client.on('qr', (qr) => {
        console.log('QR Code:');
        qrcode.generate(qr, {small: true});
    });

    client.on('ready', () => {
        console.log('WhatsApp ready!');
        isReady = true;
    });

    client.on('authenticated', () => {
        console.log('Authenticated!');
    });

    client.initialize();

    app.get('/', (req, res) => {
        res.json({ status: 'running', ready: isReady });
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
    });
})();
