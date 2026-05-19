require('dotenv').config();

const express = require('express');
const connectDB = require('./config/database');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());


app.get('/', (req, res) => {
  res.send('Hello World!');
});

connectDB().then(() => {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
});