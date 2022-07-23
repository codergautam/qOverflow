// const { response } = require("express");

// let array = [1,2,3,4,5,6,7,8,9,10,11,12,13];

// function paginate(arr, chunkSize) {
//   const res = [];
//   for (let i = 0; i < arr.length; i += chunkSize) {
//       const chunk = arr.slice(i, i + chunkSize);
//       res.push(chunk);
//   }
//   return res;
// }


// let myQueryObject = {
//   "creator": "elizabethWarren"
// }

// let myQuery = encodeURIComponent(JSON.stringify(myQueryObject))

// console.log(myQuery)
let msg = "World, Programmed To Learn And Not To Feeeel (Melismatic Singing) \n-Louie Zong (https://youtu.be/Yw6u6YkTgQ4)"
console.log("Hello " + msg)

;const TurndownService = require('turndown');


const express = require('express')
const app = express()
const port = 3000

require('dotenv').config()
const Api = require('./api')
const passwordUtils = require('./utils/password')
const msToTime = require('./msToTime')
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
    if(Object.keys(req.session.user).length != 0) {
        let data = await api.getUser(req.session.user.username).then(
          (data) => {
            if(data && data.success) {
              return data
            } else {
              return false
            }
          }
        )
        if(data.success) {
          let user = data.user
          let userPoints = parseInt(user.points)
          let _level = levelCalculation(userPoints)
          let allAbilities = ['Create new answers', 'Upvote questions and answers', 'Comment under all questions and answers', 'Downvote questions and answers', 'View the upvotes/downvotes of any question or answer', 'Participate in Protection votes', 'Close and Reopen Quesitons']
          let _abilities = allAbilities.splice(0, _level)
          user.points = userPoints
          user.level = _level
          let nextLevel = _level + 1
          let levelMinimums = [15, 50, 125, 1000, 3000, 10000]
          let nextLevelPoints = levelMinimums[_level - 1]
          user.abilities = _abilities
          console.log(`You are Level ${_level}`)
          console.log(`You can: ` + _abilities.join(', '))
          let myQueryObject = {
            "creator": user.username
          }
          const [ questionData, answerData ] = await api.getUserQuestionsAnswers(user.username)
          let questionFeed = (questionData.success) ? questionData.questions : null
          let answerFeed = (answerData.success) ? answerData.answers : null
          console.log(answerFeed)
          questionFeed.forEach((question) => {
            let timeElapsed = msToTime(Date.now() - question.createdAt)
            question.timeElapsed = timeElapsed
          })
          user.img = gravatarGen(user.email)
          req.session.user = user
          console.log(user)
          console.log(questionFeed.length)
          res.render('dashboard', {
              loggedIn: req.session.loggedIn,
              questionFeed: questionFeed,
              answerFeed: answerFeed,
              user: req.session.user,
              nextLevel: nextLevel,
              nextLevelPoints: nextLevelPoints
          })
        } else {
          req.session.loggedIn = false
          res.redirect('/auth/login')
        }
    } else {
        req.session.loggedIn = false
        res.redirect('/auth/login')
    }
})

app.post('/email', (req, res) => {
  const { username } = req.body
  res.render('changeEmail', {username: username})
})

app.post('/password', (req, res) => {
  const { username } = req.body
  res.render('changePassword', {username: username})
})

app.post('/emailChange', async (req, res) => {
  const { username, newEmail } = req.body
  let data = await api.sendRequest("/users/" + username, "PATCH", {
    email: newEmail
  }).then((data) => {
    if(data.success) {
      return data
    }
  })
  if(data.success) res.redirect("/dashboard")
})

app.get('/logout', async (req, res) => {
  req.session.user = {}
  req.session.loggedIn = false
  res.redirect('/')
})

app.post('/questionEditor', async (req, res) => {
  const { username } = req.body
  console.log("User: " + username)
  res.render('question', {username: username})
})

app.post('/questions',  async (req, res) => {
  let {username, title, text } = req.body 
  username = (username != " ") ? username : req.session.user.username
  if(username != " ") {
    console.log(`User ${username}, making Question [Title: ${title}, Text ${text.slice(0, 16)}]`)
    let data = await api.createQuestion(username, title, text).then((data) => {
      if(data.success) {
        return data
      }
    })
    let pointsData = await modifyPoints(15, username).then((data) => {
      if(data.success) {
        return data
      }
    })
    let pointStatus = pointsData.success
    let dataStatus = data.success
    console.log(pointStatus)
    if (dataStatus && pointStatus) { 
      res.redirect('/')
    } else {
      res.redirect('/questionEditor', {username: username})
    }
  } else {
     req.session.loggedIn = false
     res.redirect('/')
  }
  // res.redirect('/')
})

app.post('/passwordChange', async (req, res) => {
  const { username, newPassword } = req.body
  const { keyString, saltString } = await passwordUtils.deriveKeyFromPassword(newPassword);
  let data = await api.sendRequest("/users/" + username, "PATCH", {
    key: keyString,
    salt: saltString
  }).then((data) => {
    if(data.success) {
      console.log("Password Changed!")
      return data
    }
  })
  if(data.success) res.redirect("/dashboard")

})
app.post('/deleteAccount', async (req, res) => {
  const { username } = req.body
  let data = await api.sendRequest("/users/" + username, 'DELETE').then((data) => {
    if(data.success) {
      return data
    } else {
      return data
    }
  })
  req.session.user = {}
  req.session.loggedIn = false
  (data.success) ? res.redirect('/') : res.redirect('/dashboard')
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

app.get('/mail', async (req, res) => {
  if(req.session.loggedIn) {
    username = req.session.user.username
    user = req.session.user
    userPoints = user.points
    user.level = levelCalculation(userPoints)
    user.nextLevel = user.level + 1
    let levelMinimums = [15, 50, 125, 1000, 3000, 10000]
    user.nextLevelPoints = levelMinimums[user.nextLevel - 1]
    console.log("Username: " + username)
    let mailData = await api.sendRequest('/mail/' + username, 'GET')
    console.log(mailData)
    res.render('mail', {
      loggedIn: req.session.loggedIn,
      user: user,
      messageFeed: mailData.messages,
      messageCount: mailData.messages.length
    })
  }
})


app.post("/messageEditor", async (req, res) => {
  let { username } = req.body 
  console.log(username)
  username = (username) ? username : req.session.user.username
  res.render('messageEditor', {
    username: username
  })
})

app.post("/messages", async (req, res) => {
  let { username, receiver, subject, text } = req.body 
  username = (username) ? username : req.session.user.username
  console.log(`Reciever: ${receiver}, Sender: ${username}`)
  console.log(username)
  let data = await api.sendRequest("/mail", 'POST', {
    sender: username,
    receiver: receiver,
    subject: subject,
    text: text
  })
  console.log(data)
  console.log(data.success)
  if(data.success) {
    res.redirect('/mail')
  } else {
    res.redirect('/messageEditor', {
      username: username
    })
  }
})

app.post("/auth/login", async (req,res) => {
  // get form data
  const { username, password } = req.body
  if(!username || !password) {
    console.log("Missing username or password")
    return
  }

  var user = await api.getUser(username);
  console.log(user)
  if(user.success && user) {
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
  api.getQuestions().then(data => {
    res.send(JSON.stringify(data))
  });
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`))

modifyPoints = async (amount, username) => {
  let operation = (Math.sign(amount) > 0) ? "increment" : "decrement"
  return await api.sendRequest("/users/" + username + "/points", "PATCH", {
    operation: operation,
    amount: amount
  })
}

levelCalculation = (userPoints) => {
  let _level
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

  return _level
}