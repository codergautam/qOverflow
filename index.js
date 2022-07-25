let msg = "World, Programmed To Learn And Not To Feeeel (Melismatic Singing) \n-Louie Zong (https://youtu.be/Yw6u6YkTgQ4)"
console.log("Hello " + msg)
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
  var sort = req.query.sort ?? "recent";
  console.log(sort)
  var possible = ["recent", "best", "interesting", "hottest"];
  if(!possible.includes(sort)) sort = "recent";
  res.render('index', {
    loggedIn: req.session.loggedIn ?? false,
    user: req.session.user,
    sort
  })
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
        const questionData = await api.getUserQuestions(user.username)
        const answerData = await api.getUserAnswers(user.username)
        let questionFeed = (questionData.success) ? questionData.questions : null
        let answerFeed = (answerData.success) ? answerData.answers : null
        questionFeed.forEach((question) => {
          let timeElapsed = msToTime(Date.now() - question.createdAt)
          question.timeElapsed = timeElapsed
        })
        answerFeed.forEach((answer) => {
          let timeElapsed = msToTime(Date.now() - answer.createdAt)
          answer.timeElapsed = timeElapsed
        })
        user.img = gravatarGen(user.email)
        req.session.user = user
        console.log(answerFeed)
        var needed = {
          time: Date.now(),
          data: {
            pfp: gravatarGen(user.email),
            level: _level,
          }
        }
        basicDataCache[req.query.user] = needed;

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

app.get('/questionEditor', async (req, res) => {
  let username = req.session.username
  console.log("User: " + username)
  res.render('questionEditor', {username: username})
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
    user.nextLevelPoints = levelMinimums[user.nextLevel - 1]
    console.log("Username: " + username)
    let mailData = await api.sendRequest('/mail/' + username, 'GET')
    mailData.messages.forEach((message) => {
      message.timeElapsed = msToTime(Date.now() - message.createdAt)
    })
    console.log(mailData)
    res.render('mail', {
      loggedIn: req.session.loggedIn,
      user: user,
      messageFeed: mailData.messages,
      messageCount: mailData.messages.length
    })
  }
})


app.get("/messageEditor", async (req, res) => {
  let username = req.session.user.username
  console.log(username)
  username = (username) ? username : req.session.user.username
  res.render('messageEditor', {
    username: username
  })
})
app.get('/getAnswers', async (req, res) => {
  var id = req.query.question;
  api.getAnswers(id).then(data => {
    if(data.success) {
      data.answers = data.answers.sort ((a, b) => {
        return (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes)
      });
      res.send({answers: data.answers, success: true})
    } else {
      res.send({success: false})
    }
  }).catch(err => {
    console.log(err)
    res.send({success: false});
    });
});
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

app.post('/api/answer', (req, res) => {
  if(!req.session.loggedIn) return res.send({success: false})
  let { question, text } = req.body
  let username = req.session.user.username
  console.log(`Question: ${question}, Answer: ${text}`);
  api.addAnswer(question, username, text).then(data => {
    console.log(data)
    if(data.success) {
      res.send({success: true, answer: data.answer})
    } else {
      res.send({success: false})
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
  var sort;
  if(req.query.sort) {
    sort = req.query.sort == "recent" ? undefined : req.query.sort == "best" ? "u" : req.query.sort == "interesting" ? "uvc" : req.query.sort == "hottest" ? "uvac" : undefined
  }
  api.getQuestions(sort, undefined, req.query.sort ? req.query.sort == "interesting" ? {"answers": {"$lte": 0}} : undefined : undefined, req.query.after ?? undefined).then(data => {
    res.send(JSON.stringify(data))
  });
});

app.get("/hasUserVotedAnswer", (req, res) => {
  var user = req.session.user.username;
  var answer = req.query.answer;
  var question = req.query.question;
  api.hasUserVotedAnswer(question, answer, user).then(data => {
    res.send(JSON.stringify(data))
  });
})

app.get("/question/:id", (req, res) => {
  var id= req.params.id;
  if(!id) {
    res.send("Invalid question id")
    return
  }
  console.time("getQuestion")
  api.getQuestion(id).then(data => {
  console.timeEnd("getQuestion")
  console.time("getAnswers")

    if(!data.success) {
      res.send("Invalid question id")
      return;
    }


      console.time("increaseViews")

    api.increaseViews(id).then(data4 => {
      console.timeEnd("increaseViews")
      console.time("checkVote")
      
      console.log(data4)
      data.question.views ++;
    api.hasUserVoted(id, req.session.user?.username).then(data3 => {
      console.timeEnd("checkVote")
      // console.timeEnd("getQuestion")
    res.render('question', {
      question: data.question,
      user: req.session.user,
      loggedIn: req.session.loggedIn,
      username: req.session.user.username,
      voted: data3
    })
  }).catch(err => {
    console.timeEnd("getQuestion")
    console.log(err)
    res.render('question', {
      question: data.question,
      user: req.session.user,
      loggedIn: req.session.loggedIn,
      username: req.session.user.username,
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
            points: userPoints,
          }
        }
        basicDataCache[req.query.user] = needed;
        res.send({success:true, ...needed.data})
      } else {
        console.log(data.error)
        res.send(JSON.stringify({success: false}))
      }
      });
    }
  } else res.send(JSON.stringify({success: false}))
})

app.get("/questionComments", (req, res) => {
  var question = req.query.question;
  api.getQuestionComments(question).then(data => {
    res.send(JSON.stringify(data))
  }).catch(err => {
    console.log(err)
    res.send(JSON.stringify({success: false}))
  });
});

app.post("/answerComments", (req, res) => {
  var answer = req.body.answer;
  var question = req.body.question;
  console.log(req.body)
  api.getAnswerComments(question, answer).then(data => {
    res.send(JSON.stringify(data))
  }).catch(err => {
    console.log(err)
    res.send(JSON.stringify({success: false}))
  });
});

app.post("/addCommentQuestion", (req, res) => {
  var question = req.body.question;
  var comment = req.body.text;
  var user = req.session.user.username;
  console.log(question, comment, user)
  if(!user || !question || !comment) {
    res.send(JSON.stringify({success: false}))
    return
  }
  
  if(comment.length > 150) {
    res.send(JSON.stringify({success: false}))
    return
  }
  api.addCommentQuestion(question, user, comment).then(data => {
    res.send(JSON.stringify(data))
  }).catch(err => {
    console.log(err)
    res.send(JSON.stringify({success: false}))
  });
});

app.post("/addCommentAnswer", (req, res) => {
  var answer = req.body.answer;
  var comment = req.body.text;
  var user = req.session.user.username;
  var question = req.body.question;
  console.log(answer, comment, user, question)
  if(!user || !answer || !comment || !question) {
    res.send(JSON.stringify({success: false}))
    return
  }
  if(comment.length > 150) {
    res.send(JSON.stringify({success: false}))
    return
  }
  api.addCommentAnswer(question, answer, user, comment).then(data => {
    res.send(JSON.stringify(data))
  }).catch(err => {
    console.log(err)
    res.send(JSON.stringify({success: false}))
  });
});


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

app.post("/api/answer/:id/:type", (req,res) => {
  var id = req.params.id;
  var type = req.params.type;
  var action = req.body.action;
  var  question = req.body.question;
  console.log(action, type, id)
  if(!id || !type || !action || (type != "upvote" && type != "downvote") || (action != "increment" && action != "decrement")) {
    res.send("Invalid answer id or type")
    return
  }
  type += "s";
  api.voteAnswer( question , id, req.session.user?.username, type, action).then(data => {
    res.send(JSON.stringify(data))
    var dir = action == "increment" ? 1 : -1;
    dir *= type == "upvotes" ? 1 : -1;
    if(data.success) {
      io.emit("voteA", [question, id, dir])
    }
  });
});

io.on('connection', (socket) => {
  console.log('a user connected');
  socket.on('disconnect', () => {
    console.log('user disconnected');
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