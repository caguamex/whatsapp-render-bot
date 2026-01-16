const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
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
    let qrImage = null;

    client.on('qr', async (qr) => {
        console.log('QR Generated! Visit /qr to see image');
        qrcodeTerminal.generate(qr, {small: true});
        
        // Generar imagen QR
        try {
            qrImage = await QRCode.toDataURL(qr);
        } catch (err) {
            console.error('QR image error:', err);
        }
    });

    client.on('ready', () => {
        console.log('WhatsApp ready!');
        isReady = true;
        qrImage = null;
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
        if (qrImage) {
            res.send(`
                <html>
                <head><title>WhatsApp QR Code</title></head>
                <body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;flex-direction:column;">
                    <h1>Scan with WhatsApp</h1>
                    <img src="${qrImage}" style="width:400px;height:400px;"/>
                </body>
                </html>
            `);
        } else if (isReady) {
            res.send('<html><body><h1>Already authenticated! Bot is ready.</h1></body></html>');
        } else {
            res.send('<html><body><h1>Generating QR code... Refresh in 5 seconds</h1></body></html>');
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
        console.log(`Visit /qr for QR image`);
    });
})();
