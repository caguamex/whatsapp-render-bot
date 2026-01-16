const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
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
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server on port ${PORT}`);
});
