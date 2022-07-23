const TurndownService = require('turndown');

let levelMinimums = [15, 50, 125, 1000, 3000, 10000]


const express = require('express')
const http = require('http')
const app = express()
const port = 3000
const server = http.createServer(app)

require('dotenv').config()
const Api = require('./api')
const passwordUtils = require('./utils/password')
const msToTime = require('./msToTime')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')

const { Server } = require("socket.io");

const io = new Server(server, {
  cors: { origin: "*" },
});

var forgotTokens = {};


 const api = new Api(process.env.key)
 var gravatar = require('gravatar');

 function gravatarGen(email) {
  return gravatar.url(email, {s: '200', r: 'x'}, true);
 }

var session = require('express-session')
const sqlite = require("better-sqlite3");
const { randomUUID } = require('crypto')

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

///------------------------------------- Questions Stuff --------------------------------
app.get("/question/:id", (req, res) => {
  var id= req.params.id;
  if(!id) {
    res.send("Invalid question id")
    return
  }
  api.getQuestion(id).then(data => {
    if(!data.success) {
      res.send("Invalid question id")
      return;
    }
    api.getAnswers(id, data.answers).then(data2 => {
    if(!data2.success) {
      res.send("Something wen't wrong.. Please try again")
      return;
    }

    api.hasUserVoted(id, req.session.user?.username).then(data3 => {
    res.render('question', {
      question: data.question,
      user: req.session.user,
      loggedIn: req.session.loggedIn,
      answers: data2.answers,
      voted: data3
    })
  }).catch(err => {
    console.log(err)
    res.render('question', {
      question: data.question,
      user: req.session.user,
      loggedIn: req.session.loggedIn,
      answers: data2.answers,
      voted: {voted: false}
    })
  });
  });

  });
});
var basicDataCache = {};
app.get("/getBasicData", (req, res) => {
  if(req.query.user && typeof req.query.user == "string") {
    if(basicDataCache.hasOwnProperty(req.query.user) && Date.now() - basicDataCache[req.query.user].time < 1000 * 60 * 5) {
      res.send({success:true, ...basicDataCache[req.query.user].data})

    } else {
      api.getUser(req.query.user).then(data => {
        if(data.success) {
        var userPoints = data.user.points;
        console.log(data)
        let _level;
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
        console.log("Level: " + _level)
        var needed = {
          time: Date.now(),
          data: {
            pfp: gravatarGen(data.user.email),
            level: _level,
          }
        }
        basicDataCache[req.query.user] = needed;
        res.send({success:true, ...needed.data})
      } else {
        res.send(JSON.stringify({success: false}))
      }
      });
    }
  } else res.send(JSON.stringify({success: false}))
})

app.get("/forgot", (req, res) => {
  if(req.session.loggedIn) req.redirect('/')
  res.render('forgot', {
  });
})

app.post("/forgot", (req, res) => {
  var username = req.body.username;
  var email = req.body.email;
  if(!username || !email) {
    res.render('forgot', {
      error: {msg: "Please fill in all fields"}
    })
    return
  };
  api.getUser(username).then(data => {
    if(data.success) {
      if(data.user.email == email) {
        var token = randomUUID();
        forgotTokens[token] = {
          username: username,
          time: Date.now()
        };
        res.send("<b>One more step</b><br>We haven't sent you an email, But if we had, we wouldv'e send the below link <br> Please click the link below to reset your password.<br>Please be quick, as the link expires in 5 minutes<br/><br><a href='/reset/" + token + "'>Click here to reset your password</a>");
      } else {
        res.render('forgot', {
          error: {msg: "Email doesn't match"}
        })
        return
      }
    } else {
      res.render('forgot', {
        error: {msg: "Invalid username or email"}
      })
      return
    }
  }).catch(err => {
    console.log(err)
    res.render('forgot', {
      error: {msg: "Something went wrong.. Please try again"}
    })
  });

});

app.get("/reset/:token", (req, res) => {
  if(req.params.token) {
    if(forgotTokens.hasOwnProperty(req.params.token)) {
      if(Date.now() - forgotTokens[req.params.token].time < 1000 * 60 * 5) {
        res.render('reset', {
          username: forgotTokens[req.params.token].username
        })
      } else {
        res.render('forgot', {
          error: {msg: "Link expired, please try again"}
        });
      }
    } else {
      res.render('forgot', {
        error: {msg: "Invalid link, please try again"}
      });
    }
  } else {
    res.render('forgot', {
      error: {msg: "Bad link, please try again"}
    });
  }
})

app.post("/reset/:token", (req, res) => {
  if(req.params.token) {
    if(forgotTokens.hasOwnProperty(req.params.token)) {
      if(Date.now() - forgotTokens[req.params.token].time < 1000 * 60 * 5) {
        var username = forgotTokens[req.params.token].username;
        var password = req.body.password;
        if(!password) {
          res.render('reset', {
            username: username,
            error: {msg: "Please fill in all fields"}
          })
          return
        }
        api.resetPassword(username, password).then(data => {
          if(data.success) {
            res.render('login', {
              username: username,
              success: {msg: "Password reset successfully"}
            })
          } else {
            res.render('reset', {
              username: username,
              error: {msg: "Something went wrong.. Please try again"}
            })
          }
        }).catch(err => {
          console.log(err)
          res.render('reset', {
            username: username,
            error: {msg: "Something went wrong.. Please try again"}
          })
        }
        );
      } else {
        res.render('forgot', {
          error: {msg: "Link expired, please try again"}
        });
      }
    } else {
      res.render('forgot', {
        error: {msg: "Invalid link, please try again"}
      });
    }
  } else {
    res.render('forgot', {
      error: {msg: "Bad link, please try again"}
    });
  }
})


app.post("/api/question/:id/:type", (req,res) => {
  var id = req.params.id;
  var type = req.params.type;
  var action = req.body.action;
  console.log(action, type, id)
  if(!id || !type || !action || (type != "upvote" && type != "downvote") || (action != "increment" && action != "decrement")) {
    res.send("Invalid question id or type")
    return
  }
  type += "s";
  api.voteQuestion(id, req.session.user?.username, type, action).then(data => {
    res.send(JSON.stringify(data))
    var dir = action == "increment" ? 1 : -1;
    dir *= type == "upvotes" ? 1 : -1;
    if(data.success) {
      io.emit("voteQ", [id, dir])
    }
  });


})

io.on('connection', (socket) => {
  console.log('a user connected');
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

///------------------------------------- Questions Stuff --------------------------------

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

server.listen(port, () => console.log(`Example app listening on port ${port}!`))

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

