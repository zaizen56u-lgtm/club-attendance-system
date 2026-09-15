const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

// Middleware
const dataPath = path.join(__dirname, '../../data/equipment.json');
const imagesDir = path.join(__dirname, '../../data/images');

// Initialize data file and images dir if they don't exist
if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, JSON.stringify([]));
}
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
}

// Serve images
app.use('/api/images', express.static(imagesDir));

// Increase JSON limit for base64 images
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// Helper to read/write data
const readData = () => {
    try {
        return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } catch (e) {
        return [];
    }
};

const writeData = (data) => {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
};

// API: Get all items
app.get('/api/items', (req, res) => {
    res.json(readData());
});

// API: Register new item
app.post('/api/items', (req, res) => {
    const { name, quantity, threshold, category, imageBase64 } = req.body;
    if (!name || quantity === undefined) {
        return res.status(400).json({ error: 'Name and quantity are required' });
    }

    let imageUrl = '';
    if (imageBase64) {
        try {
            const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
            const filename = `item_${Date.now()}.jpg`;
            fs.writeFileSync(path.join(imagesDir, filename), base64Data, 'base64');
            imageUrl = `/api/images/${filename}`;
        } catch (e) {
            console.error('Error saving image:', e);
        }
    }

    const items = readData();
    const newItem = {
        id: Date.now().toString(),
        name,
        barcode: Date.now().toString(), // Auto-generate barcode
        imageUrl,
        quantity: parseInt(quantity, 10),
        threshold: parseInt(threshold, 10) || 0,
        category: category || '未分類',
        createdAt: new Date().toISOString()
    };
    
    items.push(newItem);
    writeData(items);
    res.status(201).json(newItem);
});

// API: Consume/Take out by ID
app.post('/api/items/:id/consume', (req, res) => {
    const { amount, user } = req.body;
    const consumeAmount = parseInt(amount, 10) || 1;
    
    const items = readData();
    const itemIndex = items.findIndex(i => i.id === req.params.id);
    
    if (itemIndex === -1) {
        return res.status(404).json({ error: 'Item not found' });
    }

    const item = items[itemIndex];
    if (item.quantity < consumeAmount) {
        return res.status(400).json({ error: 'Not enough stock' });
    }

    item.quantity -= consumeAmount;
    writeData(items);
    
    res.json({ success: true, item });
});

// API: Restock item
app.post('/api/items/:id/restock', (req, res) => {
    const { amount } = req.body;
    const restockAmount = parseInt(amount, 10) || 1;
    const items = readData();
    const item = items.find(i => i.id === req.params.id);

    if (!item) return res.status(404).json({ error: 'Item not found' });

    item.quantity += restockAmount;
    writeData(items);

    res.json({ success: true, item });
});

// API: Consume item by barcode (Single)
app.post('/api/consume/barcode', (req, res) => {
    const { barcode, amount } = req.body;
    if (!barcode) return res.status(400).json({ error: 'Barcode is required' });

    const consumeAmount = parseInt(amount, 10) || 1;
    const items = readData();
    const item = items.find(i => i.barcode === barcode);

    if (!item) return res.status(404).json({ error: 'Item not found with that barcode' });
    if (item.quantity < consumeAmount) return res.status(400).json({ error: 'Insufficient quantity' });

    item.quantity -= consumeAmount;
    writeData(items);

    res.json({ success: true, item });
});

// API: Bulk consume items (Cart)
app.post('/api/consume/bulk', (req, res) => {
    const { items: consumeItems } = req.body;
    if (!consumeItems || !Array.isArray(consumeItems)) {
        return res.status(400).json({ error: 'Invalid payload' });
    }

    const items = readData();
    let errorMsg = null;

    for (const reqItem of consumeItems) {
        const item = items.find(i => i.id === reqItem.id);
        if (!item) {
            errorMsg = `Item not found (ID: ${reqItem.id})`;
            break;
        }
        if (item.quantity < reqItem.amount) {
            errorMsg = `在庫不足: ${item.name} (残り ${item.quantity}個)`;
            break;
        }
    }

    if (errorMsg) {
        return res.status(400).json({ error: errorMsg });
    }

    for (const reqItem of consumeItems) {
        const item = items.find(i => i.id === reqItem.id);
        item.quantity -= reqItem.amount;
    }

    writeData(items);
    res.json({ success: true });
});

// API: Delete item
app.delete('/api/items/:id', (req, res) => {
    const items = readData();
    const index = items.findIndex(i => i.id === req.params.id);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Item not found' });
    }
    
    const deleted = items.splice(index, 1);
    writeData(items);
    
    res.json({ success: true, item: deleted[0] });
});

// Start server
app.listen(PORT, () => {
    console.log(`[Equipment System] Server is running on http://localhost:${PORT}`);
});
