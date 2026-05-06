const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Basic API endpoint
app.get('/api/status', (req, res) => {
    res.json({ status: 'Equipment Management System is running' });
});

// Start server
app.listen(PORT, () => {
    console.log(`[Equipment System] Server is running on http://localhost:${PORT}`);
});
