// app.js or server.js (main entry point)
const express = require('express');
const app = express();
const walletRoutes = require('./api/wallets');

app.use(express.json());

app.use('/api', walletRoutes);

const port = 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});