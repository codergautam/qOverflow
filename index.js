let msg = "World, Programmed To Learn And Not To Feeeel (Melismatic Singing) \n-Louie Zong (https://youtu.be/Yw6u6YkTgQ4)"
console.log("Hello " + msg)

const express = require('express')
const app = express()
const port = 3000

require('dotenv').config()
const Api = require('./api')
const passwordUtils = require('./utils/password')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
 const api = new Api(process.env.key)

var session = require('express-session')

app.use(cookieParser())
app.use(bodyParser.urlencoded())
app.use(bodyParser.json())

app.use('/', express.static(__dirname + '/public'))
app.set('view engine', 'ejs')

app.use(session({
  secret: 'digifduifug9di9vifgm',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }
}))

app.get('/', (req, res) => {
  console.log(req.session)
  res.render('index', {
    loggedIn: req.session.loggedIn ?? false,
    user: req.session.user
  })
});

app.get('/auth/login', (req, res) => {
  res.render('login', {
  })
});
app.get('/auth/signup', (req, res) => {
  res.render('signup', {
  })
});

app.post("/auth/signup", (req,res) => {
  // get form daata
  const { username, password, email } = req.body
  if(!username || !password || !email) {
    console.log("Missing username or password or email")
    return 
  }

  // Make sure username is alphanumeric (dashes and underscores allowed)
  var regex = /^[a-zA-Z0-9-_]+$/;
  if(username.search(regex) == -1) {
    return res.render('signup', {
      error: {msg: "Username must be alphanumeric (dashes and underscores allowed)"}
    })
  }

  console.log("Creating user: " + username, password)
  // create user
  api.createUser(username, email, password).then(data => {
    if(data.success) {
      req.session.loggedIn = true
      req.session.user = {
        username: data.user.username,
        user_id: data.user.user_id,
        email: data.user.email,
        points: data.user.points
      }
      res.redirect('/')
    } else {
      var err = data.error;
      if(err == "an item with that \"email\" already exists") err = "Email taken!"
      else if(err == "an item with that \"username\" already exists") err = "Username taken!";

      res.render('signup', {
        error: {msg: err}
      })
    }
  });

})

app.listen(port, () => console.log(`Example app listening on port ${port}!`))


