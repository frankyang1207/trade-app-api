const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const user_router = require('./routes/users');
const product_router = require('./routes/products')
const app = express();
const cors = require('cors');
const port = process.env.PORT || 9000;

app.use(cors());
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
dotenv.config();

app.use(user_router);
app.use(product_router);




app.listen(port, () => console.log(`listening on port: ${port}`));


