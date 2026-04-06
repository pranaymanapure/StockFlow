require('dotenv').config();

const express = require('express');
const auth = require('./middleware/auth');
const app = express();

app.use(express.json());
app.use('/api', auth, require('./routes/alerts'));

app.listen(process.env.PORT, () => console.log('StockFlow running on port', process.env.PORT));
