const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const user_router = require('./routes/users');
const product_router = require('./routes/products')
const s3_router = require('./routes/s3Uploader')
const stripe = require('./routes/stripe')
const app = express();
const cors = require('cors');

dotenv.config();

app.use('/webhook', express.raw({ type: 'application/json' }));

app.use(cors());
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

app.get('/', (req, res) => {
  res.send('Backend is live ✅');
});
app.use(user_router);
app.use(product_router);
app.use(s3_router);
app.use(stripe)


module.exports = app;