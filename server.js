const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage for responses
let responses = [];

// Email configuration — set these environment variables before running:
//   EMAIL_USER=youremail@gmail.com
//   EMAIL_PASS=your-app-password
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || process.env.EMAIL_USER;

async function sendNotification(response) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log('Email not configured — skipping notification.');
        console.log('New response:', response);
        return;
    }

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: NOTIFY_EMAIL,
        subject: `New Message from ${response.name} (Grade ${response.gradeLevel})`,
        text: [
            `Name: ${response.name}`,
            `Grade Level: ${response.gradeLevel}`,
            `Message: ${response.message}`,
            `Time: ${response.timestamp}`
        ].join('\n')
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Notification email sent.');
    } catch (err) {
        console.error('Failed to send email:', err.message);
    }
}

// Get all responses
app.get('/api/responses', (req, res) => {
    res.json(responses.slice(-50).reverse());
});

// Post a new response
app.post('/api/responses', async (req, res) => {
    const { name, gradeLevel, message } = req.body;

    if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Name is required.' });
    }
    if (!gradeLevel || gradeLevel.trim() === '') {
        return res.status(400).json({ error: 'Grade level is required.' });
    }
    if (!message || message.trim() === '') {
        return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    const newResponse = {
        name: name.trim(),
        gradeLevel: gradeLevel.trim(),
        message: message.trim(),
        timestamp: new Date()
    };

    responses.push(newResponse);

    if (responses.length > 100) {
        responses = responses.slice(-100);
    }

    // Send email notification (don't block the response)
    sendNotification(newResponse);

    res.status(201).json(newResponse);
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
