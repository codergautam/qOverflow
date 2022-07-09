let msg = "World, Programmed To Learn And Not To Feeeel (Melismatic Singing) \n-Louie Zong (https://youtu.be/Yw6u6YkTgQ4)"
console.log("Hello " + msg)

const express = require('express')
const app = express()
const port = 3000

require('dotenv').config
const Api = require('./api')
const passwordUtils = require('./utils/password')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
// const api = Api(process.env.key)

app.use(cookieParser())
app.use(bodyParser.urlencoded())
app.use(bodyParser.json())

app.use('/', express.static(__dirname + '/public'))
app.set('view engine', 'ejs')

app.get('/', (req, res) => {
  res.render('index', {
  })
});

app.get('/navbar', (req, res) => {
  res.render('navbar', {
  })
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`))


