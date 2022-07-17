// let myQueryObject = {
//   "creator": "elizabethWarren"
// }

// let myQuery = encodeURIComponent(JSON.stringify(myQueryObject))

// console.log(myQuery)
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
 var gravatar = require('gravatar');

 function gravatarGen(email) {
  return gravatar.url(email, {s: '200', r: 'x'}, true);
 }

var session = require('express-session')
const sqlite = require("better-sqlite3");

const SqliteStore = require("better-sqlite3-session-store")(session)
const db = new sqlite("sessions.db");

app.use(cookieParser())
app.use(bodyParser.urlencoded())
app.use(bodyParser.json())

app.use('/', express.static(__dirname + '/public'))
app.set('view engine', 'ejs')

app.use(session({
  secret: process.env.secret,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false },
  store: app.use(
    session({
      store: new SqliteStore({
        client: db, 
        expired: {
          clear: true,
          intervalMs: 900000 //ms = 15min
        }
      }),
      secret: "keyboard cat",
      resave: false,
    })
  )
}))

app.get('/', (req, res) => { //Homepage
  console.log(req.session)
  res.render('index', {
    loggedIn: req.session.loggedIn ?? false,
    user: req.session.user
  })
});

app.get('/dashboard', async (req, res) => {
    console.log(req.session)
    if(req.session.user) {
        let userPoints = parseInt(req.session.user.points)
        let _level
        console.log(userPoints)
        let levelMinimums = [15, 50, 125, 1000, 3000, 10000]
        for(let i = 0; i < levelMinimums.length; i++) {
          if((userPoints >= levelMinimums[i]) && (userPoints < levelMinimums[i+1])) {
            console.log("Less than " + levelMinimums[i])
            _level = i + 2;
            break;
          } else if(i == 0) {
            if(userPoints < levelMinimums[0]) {
              console.log("Less than " + levelMinimums[0])
              _level = i + 1;
              break;
            }
          } else if(i == levelMinimums.length - 1) {
            if(userPoints > levelMinimums[i]) {
              console.log("Less than " + levelMinimums[i])
              _level = levelMinimums.length + 1;
              break;
            }
          }
        }
        let allAbilities = ['Create new answers', 'Upvote questions and answers', 'Comment under all questions and answers', 'Downvote questions and answers', 'View the upvotes/downvotes of any question or answer', 'Participate in Protection votes', 'Close and Reopen Quesitons']
        let _abilities = allAbilities.splice(0, _level)
        let user = req.session.user
        user.points = userPoints
        user.level = _level
        user.abilities = _abilities
        req.session.user = user
        console.log(`You are Level ${_level}`)
        console.log(`You can: ` + _abilities)
        let myQueryObject = {
          "creator": user.username
        }
        let userQuestions = await api.getQuestions(null, null, myQueryObject, null);
        console.log(userQuestions);
        res.render('dashboard', {
            loggedIn: req.session.loggedIn,
            user: req.session.user,
        })
    } else {
        res.redirect('/auth/login')
    }
})


app.get('/auth/login', (req, res) => {
  if(req.session.loggedIn) return res.redirect('/')

  res.render('login', {})
});
app.get('/auth/signup', (req, res) => {
  if(req.session.loggedIn) return res.redirect('/')

  res.render('signup', {})
});

app.post("/auth/signup", (req,res) => {
  // get form daata
  const { username, password, email } = req.body
  if(!username || !password || !email) {
    console.log("Missing username or password or email")
    console.log(`Username: ${username}, Password: ${password}, Email: ${email}`)
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
        points: data.user.points,
        img: gravatarGen(data.user.email)
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

app.post("/auth/login", async (req,res) => {
  // get form data
  const { username, password } = req.body
  if(!username || !password) {
    console.log("Missing username or password")
    return
  }

  var user = await api.getUser(username);
  if(user.success) {
    // login user
    var salt = user.user.salt;
    api.loginUser(username, password, salt).then(data => {

        if(data.success) {
            req.session.loggedIn = true
            req.session.user = {
                username: user.user.username,
                user_id: user.user.user_id,
                email: user.user.email,
                points: user.user.points,
                img: gravatarGen(user.user.email)
            }
            res.redirect('/')
        } else {
            res.render('login', {
                error: {msg: "Incorrect password"}
            })
        }
    
    })
} else {
  res.render('login', {
    error: {msg: "Invalid username"}
  })
}

});
app.get("/buffet", (req, res) => {
  
  api.getQuestions(undefined, undefined, undefined, req.query.after ?? undefined).then(data => {
    res.send(JSON.stringify(data))
  });
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
