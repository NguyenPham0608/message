const express = require('express');
const cors = require('cors');
const Filter = require('bad-words');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const filter = new Filter();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage for messages
let messages = [
    { name: 'System', text: 'Welcome to the Positivity Wall! Stay happy.', timestamp: new Date() }
];

// Endpoint to get messages
app.get('/api/messages', (req, res) => {
    res.json(messages.slice(-50).reverse()); // Return last 50 messages, newest first
});

// Endpoint to post a message
app.post('/api/messages', (req, res) => {
    const { name, text } = req.body;

    if (!text || text.trim() === '') {
        return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    if (filter.isProfane(text)) {
        return res.status(400).json({ error: 'Please keep the content positive and appropriate.' });
    }

    const newMessage = {
        name: name || 'Anonymous',
        text: text.trim(),
        timestamp: new Date()
    };

    messages.push(newMessage);
    
    // Keep memory usage low by limiting stored messages
    if (messages.length > 100) {
        messages = messages.slice(-100);
    }

    res.status(201).json(newMessage);
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
