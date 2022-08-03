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
var ongoingVotes = {};

 const api = new Api(process.env.key)
 var gravatar = require('gravatar');

 function gravatarGen(email) {
  return gravatar.url(email, {s: '200', r: 'x'}, true);
 }

var session = require('express-session')
const sqlite = require("better-sqlite3");
const { randomUUID } = require('crypto')
const e = require('express')

const SqliteStore = require("better-sqlite3-session-store")(session)
const db = new sqlite("sessions.db");

app.use(cookieParser())
app.use(bodyParser.urlencoded())
app.use(bodyParser.json())

app.use('/', express.static(__dirname + '/public'))
app.set('view engine', 'ejs')

function replaceCharacters (str) {
  let newQ = str
  // newQ = newQ.replace(/(\sa\s)|(a\s)/gmi, " ").replace(/(\san\s)|(an\s)/gmi, " ").replace(/(\sis\s)|(is\s)/gmi, " ").replace(/(\sthe\s)|(the\s)/gmi, " ")
  newQ = newQ.replace(/(\sa\s)|(a\s)/gmi, ' ').replace(/(\san\s)|(an\s)/gmi, ' ').replace(/(\sis\s)/gmi, ' ').replace(/(\sthe\s)/gmi, ' ').replace(/(\sas\s)/gmi, " ")
  // newQ = newQ.replace(/(\sas\s)|(as\s)/gmi, " ").replace(/(\sdo\s)|(do\s)/gmi, " ").replace(/(\sthat\s)|(that\s)/gmi, " ").replace(/(\syou\s)|(you\s)/gmi, " ")
  newQ = newQ.replace(/(\!)|(\?)|(\.)|(\;)|(\:)|(\")|(\')/gmi, '').trim()
  return newQ
}


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

app.get('/', async (req, res) => { //Homepage
  // console.log(req.session)
  var sort = req.query.sort ?? "recent";
  // console.log(sort)
  var possible = ["recent", "best", "interesting", "hottest"];
  if(!possible.includes(sort)) sort = "recent";
  try {
   var basicData = await getBasicData(req.session.user?.username);
  } catch(e) {
    console.log(e)
    var basicData = {};
  }
  res.render('index', {
    loggedIn: req.session.loggedIn ?? false,
    user: req.session.user,
    sort,
    basicData,
    success: req.query.success,
  })
});



replaceCharacters = (str) => {
  let newQ = str
  // newQ = newQ.replace(/(\sa\s)|(a\s)/gmi, " ").replace(/(\san\s)|(an\s)/gmi, " ").replace(/(\sis\s)|(is\s)/gmi, " ").replace(/(\sthe\s)|(the\s)/gmi, " ")
  // newQ = newQ.replace(/(\sa\s)|(a\s)/gmi, ' ').replace(/(\san\s)|(an\s)/gmi, ' ').replace(/(\sis\s)/gmi, ' ').replace(/(\sthe\s)/gmi, ' ').replace(/(\sas\s)/gmi, " ")
  // newQ = newQ.replace(/(\sas\s)|(as\s)/gmi, " ").replace(/(\sdo\s)|(do\s)/gmi, " ").replace(/(\sthat\s)|(that\s)/gmi, " ").replace(/(\syou\s)|(you\s)/gmi, " ")
  newQ = newQ.replace(/(\!)|(\?)|(\.)|(\;)|(\:)|(\")|(\')/gmi, '').trim()
  return newQ
}

formatQuery = (query) => {
  let qLength = query.length
  let q = query
  q.forEach((data, i) => {
    if((data != '') && (data != ' ')) {
      if(((i != 0) && (i != qLength - 1))) {
        console.log("adding space")
         q[i] = ` ${data} `
      }
      // if(qLength == 1) {
      //   if(q[0].length > 3) {
      //     q[0] = `${q[0]}`
      //   } else {
      //     q[0] = `${q[0]}`
      //   }
      // }
    }
  })
  return q
}

var modifyPoints = async (amount, username) => {
  let operation = Math.sign(amount) == -1 ? "decrement" : "increment";
  amount = Math.abs(amount);
  console.log("giving " + amount + " points to " + username)
  return await api.sendRequest("/users/" + username + "/points", "PATCH", {
    operation: operation,
    amount: amount
  })
}





var levelCalculation = (userPoints) => {
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
///------------------------------------- Questions Stuff --------------------------------
app.get('/search', async (req, res) => {
  let { searchQuery, sort, loggedIn } = req.query
  sort = ((sort == undefined) || (sort == null)) ? "title" : sort
  loggedIn = ((loggedIn == undefined) || (loggedIn == null)) ? req.session.loggedIn : loggedIn
  console.log(searchQuery)
  let matchQuery = ((sort == "Author") || (sort == "Creation")) ? {} : null
  let regexQuery = ((sort == "Title") || (sort == "Text") || (sort == "Author")) ? {} : null
  if(sort == "Creation") {
    console.log(searchQuery)
    let day = 1000 * 60 * 60 * 24
    matchQuery = {
      "createdAt": {
        "$gte":(new Date(searchQuery + " 00:00:00")).getTime() - day/2,
        "$lte": (new Date(searchQuery + " 24:00:00")).getTime() + day/2
      }
    }
  } else if(sort == "Author") {
    matchQuery = {
      "creator": searchQuery
    }
    regexQuery = {
      "creator": `(${searchQuery})`
    }
  }
  if(sort == "Title") {
    let newQ = replaceCharacters(searchQuery).trim()
    console.log(newQ)
    let q = newQ.split(" ")
    q = formatQuery(q)
    console.log(q)
    regexQuery = {
      "title": `(${q.join(")|(")})`
    }
    console.log(regexQuery.title)
  } else if(sort == "Text") {
    let newQ = replaceCharacters(searchQuery).trim()
    console.log(newQ)
    let q = newQ.split(" ")
    q = formatQuery(q)
    console.log(q)
    regexQuery = {
      "text": `(${q.join(")|(")})`
    }
    console.log(regexQuery.title)
  }
  console.log(matchQuery)
  req.session.currentMatch = matchQuery
  req.session.currentRegex = regexQuery
  let data = await api.getQuestions(null, regexQuery, matchQuery, null)
  let questions = (data.success) ? data.questions : null
  console.log(questions)
  if(questions) {
    questions.forEach((q) => {
      q.timeElapsed = msToTime(Date.now() - q.createdAt)
    })
    res.render('searchResult', {
      loggedIn: req.session.loggedIn,
      searchQuery: searchQuery,
      sort: sort,
      searchFeed: questions,
      user: req.session.user,
      error: data.success ? undefined : true,
      formatError: sort == "Creation" && data.error && data.error.includes("value type")
    })
  } else {
    res.render('searchResult', {
      loggedIn: req.session.loggedIn,
      searchQuery: searchQuery,
      sort: sort,
      searchFeed: [],
      user: req.session.user,
      error: true,
      formatError: sort == "Creation" && data.error && data.error.includes("value type")
    })
  }
})

app.get('/searchResults/:after', async (req, res) => {
  const after = req.params.after
  console.log("After: " + after)
  console.log(after == false)
  const matchQuery  = req.session.currentMatch
  const regexQuery  = req.session.currentRegex
  if(after == 0) {
    console.log("recieved null")
    let data = await api.getQuestions(null, regexQuery, matchQuery, null)
    data = data.questions
    data.forEach((q) => {
      q.timeElapsed = msToTime(Date.now() - q.createdAt)
    })
    res.send(JSON.stringify(data))
  } else {
    let data = await api.getQuestions(null, regexQuery, matchQuery, after)
    data = data.questions
    data.forEach((q) => {
      q.timeElapsed = msToTime(Date.now() - q.createdAt)
    })
    res.send(JSON.stringify(data))
  }
})

app.get('/mailResults/:after', async (req, res) => {
  if(!req.session.loggedIn) {
    res.send(JSON.stringify({
      success: false,
      error: "You are not logged in"
    }))
  }
  const after = req.params.after
  const username = req.session.user.username
  console.log("After: " + after)
  if(after == 0) {
    console.log("recieved null")
    let data = await api.getUserMail(username)
    data = data?.messages
    if(data) {
    data.forEach((q) => {
      q.timeElapsed = msToTime(Date.now() - q.createdAt)
    })
  
    res.send(JSON.stringify(data))
  } else {
    res.send({success:false, failed: true})
  }
  } else {
    let data = await api.getUserMail(username, after)
    data = data.messages
    data.forEach((q) => {
      q.timeElapsed = msToTime(Date.now() - q.createdAt)
    })
    res.send(JSON.stringify(data))
  }
})

app.get('/userAnswerResults/:after', async (req, res) => {
  if(!req.session.loggedIn) {
    res.send(JSON.stringify({
      success: false,
      error: "You are not logged in"
    }))
    return;
  }
  const after = req.params.after
  const username = req.session.user.username
  if(after == 0) {
    let data = await api.getUserAnswers(username)
    data = data.answers
    console.log(data)
    data.forEach((q) => {
      q.timeElapsed = msToTime(Date.now() - q.createdAt)
    })
    res.send(JSON.stringify(data))
  } else {
    let data = await api.getUserAnswers(username, after)
    data = data.answers
    console.log(data)
    data.forEach((q) => {
      q.timeElapsed = msToTime(Date.now() - q.createdAt)
    })
    res.send(JSON.stringify(data))
  }
})

app.get('/userQuestionResults/:after', async (req, res) => {
  if(!req.session.loggedIn) {
    res.send(JSON.stringify({
      success: false,
      error: "You are not logged in"
    }))
    return;
  }
  const after = req.params.after
  const username = req.session.user.username
  if(after == 0) {
    console.log("Questions:")
    let data = await api.getUserQuestions(username)
    data = data.questions
    console.log(data)
    data.forEach((q) => {
      q.timeElapsed = msToTime(Date.now() - q.createdAt)
    })
    res.send(JSON.stringify(data))
  } else {
    console.log("Questions:")
    let data = await api.getUserQuestions(username, after)
    data = data.questions
    console.log(data)
    data.forEach((q) => {
      q.timeElapsed = msToTime(Date.now() - q.createdAt)
    })
    res.send(JSON.stringify(data))
  }
})

app.get('/userMail/:mail_id', async (req, res) => {
  if(!req.session.loggedIn) {
    res.redirect('/login')
    return
  }
  let username = req.session.user.username
  let mailId = req.params.mail_id
  let data = await api.getUserMail(username)
  let messages = data.messages
  let correctMsg
  messages.forEach((data) => {
    // console.log("Mail Id:" + mailId)
    // console.log("Data Id:" + data.mail_id)
    // console.log(mailId == data.mail_id)
    if(data.mail_id == mailId) {
      console.log(data)
      correctMsg = data
    }
  })
  console.log("Correct Message:")
  console.log(correctMsg)
  res.send(JSON.stringify(correctMsg))
})

app.post('/search', async (req, res) => {
  let { searchQuery, sort, loggedIn } = req.body
  sort = ((sort == undefined) || (sort == null)) ? "Title" : sort
  loggedIn = ((loggedIn == undefined) || (loggedIn == null)) ? req.session.loggedIn : loggedIn
  console.log(searchQuery)
  let matchQuery = ((sort == "Author") || (sort == "Creation")) ? {} : null
  let regexQuery = ((sort == "Title") || (sort == "Text") || (sort == "Author")) ? {} : null
  if(sort == "Creation") {
    console.log(searchQuery)
    let day = 1000 * 60 * 60 * 24
    matchQuery = {
      "createdAt": {
        "$gte":(new Date(searchQuery + " 00:00:00")).getTime() - day/2,
        "$lte": (new Date(searchQuery + " 24:00:00")).getTime() + day/2
      }
    }
  } else if(sort == "Author") {
    matchQuery = {
      "creator": searchQuery
    }
    regexQuery = {
      "creator": `(${searchQuery})`
    }
  }
  if(sort == "Title") {
    let newQ = replaceCharacters(searchQuery).trim()
    console.log(newQ)
    let q = newQ.split(" ")
    q = formatQuery(q)
    console.log(q)
    regexQuery = {
      "title":  `(${q.join(")|(")})`
    }
    console.log(regexQuery.title)
  } else if(sort == "Text") {
    let newQ = replaceCharacters(searchQuery).trim()
    console.log(newQ)
    let q = newQ.split(" ")
    q = formatQuery(q)
    console.log(q)
    regexQuery = {
      "text": `(${q.join(")|(")})`
    }
    console.log(regexQuery.title)
  }
  req.session.currentMatch = matchQuery
  req.session.currentRegex = regexQuery
  let data = await api.getQuestions(null, regexQuery, matchQuery, null)
  let questions = (data.success) ? data.questions : null
  // console.log(questions)
  if(questions) {
    questions.forEach((q) => {
      q.timeElapsed = msToTime(Date.now() - q.createdAt)
    })
    
    res.render('searchResult', {
      loggedIn: req.session.loggedIn,
      searchQuery: searchQuery,
      sort: sort,
      searchFeed: questions, 
      user: req.session.user,
      error: data.success ? undefined : true

    })
  } else {
    res.render('searchResult', {
      loggedIn: req.session.loggedIn,
      searchQuery: searchQuery,
      sort: sort,
      searchFeed: [],
      user: req.session.user,
      error: true
    })
  }
})

app.get('/test', async (req, res) => {
  console.log("Testing")
  if(!req.session.loggedIn) {
    res.redirect('/login')
    return
  }
  let username = req.session.user.username
  console.log("Username: " + username)
  if(username) {
    let data = await modifyPoints(100000000000, username)
    if(data.success) {
      res.redirect("/")
    }
  }
})
app.get('/remove', async (req, res) => {
  console.log("Testing")
  if(!req.session.loggedIn) {
    res.redirect('/login')
    return
  }
  let username = req.session.user.username
  console.log("Username: " + username)
  if(username) {
    let data = await modifyPoints(-(100000000000-1), username)
    if(data.success) {
      res.redirect("/")
    }
  }
})

app.get('/dashboard', async (req, res) => {
  console.log(req.session.user)
  if(!req.session.loggedIn) return res.redirect('/')
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
        // console.log(`You are Level ${_level}`)
        // console.log(`You can: ` + _abilities.join(', '))
        let myQueryObject = {
          "creator": user.username
        }
        const questionData = await api.getUserQuestions(user.username)
        const answerData = await api.getUserAnswers(user.username)
      if(questionData.success && answerData.success) {
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
      res.render('error', {
        loggedIn: req.session.loggedIn,
        user: req.session.user,
        error: true

      })
    }
  } else {
      req.session.loggedIn = false
      res.redirect('/auth/login')
  }
})

app.post('/email', (req, res) => {
  const { username } = req.body
  res.render('changeEmail', {username: username, user: req.session.user})
})

app.post('/password', (req, res) => {
  const { username } = req.body
  res.render('changePassword', {username: username, user: req.session.user})
})

app.post('/emailChange', async (req, res) => {
  console.log("Changing email")
  const { username, newEmail } = req.body
  let data = await api.changeEmailOf(username.trim(), newEmail.trim()).then((data) => {
    return data
  })
  console.log(data)
  if(data.success) {
    res.redirect("/dashboard")
  } else {
    res.render('changeEmail', {
      user: req.session.user,
      username: username, 
      error: {msg: data.error}
    })
  }
})

app.get('/logout', async (req, res) => {
  req.session.user = {}
  req.session.loggedIn = false
  res.redirect('/')
})

app.get('/questionEditor', async (req, res) => {
  if(!(req.session.loggedIn && req.session.user)) return res.redirect('/')
  let username = req.session.username
  console.log("User: " + username)
  res.render('questionEditor', {username: username, user: req.session.user})
})
var answerOwnerCache = {};

app.post('/acceptAnswer',  (req, res) => {
  var { questionId, answerId } = req.body
  api.updateAnswer(questionId, answerId, undefined, undefined, undefined, true).then(async (data) => {
    if(!answerOwnerCache[answerId]) answerOwnerCache[answerId] = await api.getAnswerOwner(questionId, answerId);
    var owner = answerOwnerCache[answerId];
    res.send(data);
    await modifyPoints(15, owner);

  }).catch((err) => {
    console.log(err)
    res.send({success: false})
  })

});

var allUsersCache = {time: 0, data: {}};

function autocomplete(input, array) {
  var reg = new RegExp(input.split('').join('\\w*').replace(/\W/, ""), 'i');
  return array.filter(function(a) {
    if (a.u.match(reg)) {
      return a;
    }
  });
}


app.get("/api/autocomplete", async (req, res) => {
  var current = req.query.current;
  if(!current) return res.send({success: true, data: []});
  if(Date.now() - allUsersCache.time > 1000 * 60 * 10) {
   var allUsers = await api.getAllUsers()
    if(allUsers.success) {
      allUsersCache.time = Date.now();
      allUsersCache.data = allUsers.users.map((user) => {
        return {
          u: user.username,
          img: gravatarGen(user.email)
        }
      })
    } else {
      return res.send({success: false, data: []});
    }
  }

  var users = autocomplete(current, allUsersCache.data).slice(0,5);
  res.send({success: true, data: users});

  
})

app.post('/questions',  async (req, res) => {
  if(!(req.session.loggedIn && req.session.user)) return res.redirect('/')
  let { title, text } = req.body 
  username = req.session.user.username
  if(username != " ") {
    console.log(`User ${username}, making Question [Title: ${title}, Text ${text.slice(0, 16)}]`)
    let data = await api.createQuestion(username, title, text)
    let dataStatus = data.success
    if (dataStatus) { 
      res.redirect('/?success=Your question has been created!')
    } else {
      res.redirect('/questionEditor')
    }
 await modifyPoints(1, username)

  } else {
     req.session.loggedIn = false
     res.redirect('/')
  }
  // res.redirect('/')
})


app.post('/passwordChange', async (req, res) => {
  const { username, newPassword } = req.body
  console.log("Username: " + username)
  if(newPassword.length <= 10) {
    res.render('changePassword', {
      error: {msg: "Password must be more than 10 Characters"},
      username: username,
      user: req.session.user
    })
  } else {
    const { keyString, saltString } = await passwordUtils.deriveKeyFromPassword(newPassword);
    let data = await api.changePasswordOf(username.trim(), keyString, saltString).then((data) => {
      if(data.success) {
        console.log("Password Changed!")
        return data
      }
    })
    if(data) {
      res.redirect("/dashboard") 
    } 
  }

})
app.post('/deleteAccount', async (req, res) => {
  const { username } = req.body
  let data = await api.deleteUser(username.trim()).then((data) => {
    if(data.success) {
      return data
    } else {
      return data
    }
  })
  req.session.user = {}
  req.session.loggedIn = false
  if (data.success)  res.redirect('/') 
  else res.redirect('/dashboard')
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

  if(password.length < 10 ) {
    return res.render('signup', {
      error: {msg: "Password must be at least 10 characters long"}
    })
  }

  console.log("Creating user: " + username, password)
  // create user
  api.createUser(username, email, password).then(data => {
    if(data.success) {
      req.session.loggedIn = true
      if(req.body.remember) {
        req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 7 * 30;
        req.session.cookie.expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7 * 30);
     } else {
        req.session.cookie.maxAge = 1000 * 60 * 15;
        req.session.cookie.expires = new Date(Date.now() + 1000 * 60 * 15);
     }
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
      console.log(err)
      if(err == "an item with that \"email\" already exists") err = "An account with that email already exists!"
      else if(err == "an item with that \"username\" already exists") err = "An account with that username already exists!";

      res.render('signup', {
        error: {msg: err}
      })
    }
  });

})

app.get('/answer/:id', async (req, res) => {
  // var answerId = req.params.id;
  // var createdAt = req.query.at;
  // var accepted = req.query.accepted;
  // api.getQuestionId(answerId, createdAt, accepted).then(data => {
  //   console.log(data)
  //   if(data.success) {
  //     res.redirect(`/question/${data.questionId}`)
  //   } else {
  //     res.render('error', {
  //       error: "Answer not found"
  //     })
  //   }
  // });

  res.render('error', {
    'error': "No longer supported"
  });

});

app.get('/mail', async (req, res) => {
  if(req.session.loggedIn) {
    username = req.session.user.username
    user = req.session.user
    userPoints = user.points
    user.level = levelCalculation(userPoints)
    user.nextLevel = user.level + 1
    user.nextLevelPoints = levelMinimums[user.nextLevel - 1]
    console.log("Username: " + username)
    let mailData = await api.getUserMail(username)
    if(!mailData.success) return res.render('error', {error: "Your mail couldn't be retrieved, please try refreshing."})
    mailData.messages.forEach((message) => {
      message.timeElapsed = msToTime(Date.now() - message.createdAt)
    })

    console.log(mailData)
    res.render('mail', {
      loggedIn: req.session.loggedIn,
      user: user,
      messageFeed: mailData.messages,
      messageCount: mailData.messages.length,
      success: req.query.success,
    })
  } else res.redirect('/')
})


app.get("/messageEditor", async (req, res) => {
  if(!(req.session.loggedIn && req.session.user)) return res.redirect('/')


  let username = req.session.user.username
  console.log(username)
  username = (username) ? username : req.session.user.username
  res.render('messageEditor', {
    username: username, 
    error: req.query.error,
    user: req.session.user
  })
})
app.get('/getAnswers', async (req, res) => {
  var id = req.query.question;
  api.getAllAnswers(id).then(data => {
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
  if(!req.session.loggedIn) {
    res.redirect('/login')
    return
  }
  let { username, receiver, subject, text } = req.body 
  username = (username) ? username : req.session.user.username
  console.log(`Reciever: ${receiver}, Sender: ${username}`)
  console.log(username)
  let data = await api.sendMessage(username, receiver, subject, text)
  if(text.length > 512) {
    res.redirect(`/messageEditor?error=Message too long, max 512 characters`)
  } else {
  console.log(data)
  console.log(data.success)
  if(data.success) {
    res.redirect('/mail?success=Mail sent!')
  } else {
    res.redirect('/messageEditor?error='+(data.error.startsWith("user \"") ? "The user '"+receiver+"' wasn't found" : "Something went wrong, please try again"))
  }
}
})

app.post('/api/answer', async (req, res) => {
  if(!req.session.loggedIn) return res.send({success: false})
  let { question, text } = req.body
  let username = req.session.user?.username
  console.log(`Question: ${question}, Answer: ${text}`);
  api.addAnswer(question, username, text).then(async data => {
    console.log(data)
    if(data.success) {
      res.send({success: true, answer: data.answer})
      io.emit('newAnswer', question);
      await modifyPoints(2, username);

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
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate"); // HTTP 1.1.
  res.setHeader("Pragma", "no-cache"); // HTTP 1.0.
  res.setHeader("Expires", "0"); // Proxies.
  
  var user = await api.getUser(username);
  // console.log(user)
  if(user.success && user) {
    // login user
    var salt = user.user.salt;
    api.loginUser(username, password, salt).then(data => {
        if(data.success) {
            req.session.loggedIn = true
            console.log(req.body, "RMEMFDMG")
           if(req.body.remember) {
              req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 7 * 30;
              req.session.cookie.expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7 * 30);
           } else {
              req.session.cookie.maxAge = 1000 * 60 * 15;
              req.session.cookie.expires = new Date(Date.now() + 1000 * 60 * 15);
           }
            req.session.user = {
                username: user.user.username,
                user_id: user.user.user_id,
                email: user.user.email,
                points: user.user.points,
                img: gravatarGen(user.user.email)
            }
            res.redirect('/')
        } else {
          if(data.failed) {
            res.render('login', {
              error: {msg: user.failed ? "Something went wrong, please try again later.": "Invalid username"}
            })
          } else {
            
            res.render('login', {
                error: {msg: "Incorrect password"},
                badPassword: true
            })
        }
      }
    
    })
} else {
  res.render('login', {
    error: {msg: user.failed ? "Something went wrong, please try again later.": "Invalid username"}
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
  var user = req.session.user?.username;
  var answer = req.query.answer;
  var question = req.query.question;
  api.hasUserVotedAnswer(question, answer, user).then(data => {
    res.send(JSON.stringify(data))
  });
})

app.post("/api/removeStatusVote/:id", (req, res) => {
  var id = req.params.id;
  var user = req.session.user?.username;
  if(ongoingVotes[id]) {
   var indx =  ongoingVotes[id].votes.findIndex(vote => vote == user)
   if(indx != -1) {
     ongoingVotes[id].votes.splice(indx, 1)
     if(ongoingVotes[id].votes.length == 0) {
       ongoingVotes[id].after = undefined;

     }
     res.send({success: true})

   } else {
      console.log("Could not find vote to remove")
      res.send({success: false})
   }
  }
});

app.post("/api/statusVote/:status/:id", (req, res) => {``
  var user = req.session.user?.username;
  if(!user) res.send({success: false})
  var status = req.params.status;
  var id = req.params.id;
  if((status == "closed" || status=="open") && req.session.user?.level < 7) return res.send({success: false});
  else if(req.session.user?.level < 6) return res.send({success: false})
  api.getQuestion(id).then(data => {
    if(data.success) {
      var question = data.question;
      if(ongoingVotes[id]) {
        if(ongoingVotes[id].before != question.status) {
          ongoingVotes[id] = {
            before: question.status,
            votes: []
          }
          res.send({success: false})
          return;
        }
        if(!ongoingVotes[id].after) {
          ongoingVotes[id].after = status;
        }
        if(ongoingVotes[id].votes.length >= 1 && (ongoingVotes[id].after != status)) {
          res.send({success: false})
          return;
        } else if(ongoingVotes[id].after == status) {
          if(ongoingVotes[id].votes.indexOf(user) != -1) {
            res.send({success: false})
            return;
          }
          ongoingVotes[id].votes.push(user)
          if(ongoingVotes[id].votes.length >= 3) {
            api.changeQuestionStatus(id, ongoingVotes[id].after).then(data => {
              if(data.success) {
                res.send({success: true})
                ongoingVotes[id].votes = [];
                ongoingVotes[id].after = undefined;
                ongoingVotes[id].before = status;
                return;
              } else {
                res.send({success: false})
                //remove last vote
                ongoingVotes[id].votes.pop()
                return;
              }
            })
          } else  res.send({success: true})

          return;
        }
      }  else {
        ongoingVotes[id] = {
          before: question.status,
          votes: []
        }
        var validStatuses = [];
        if(question.status == "open") validStatuses = ["protected", "closed"];
        if(question.status == "protected") validStatuses = ["closed"];
        if(question.status == "closed") validStatuses = ["open"];
        if(validStatuses.indexOf(status) == -1) {
          res.send({success: false})
          return;
        }
        // check if user has already voted
        if(ongoingVotes[id].votes.indexOf(user) != -1) {
          res.send({success: false})
          return;
        }
        ongoingVotes[id].after = status;
        console.log(status)
        ongoingVotes[id].votes.push(user);
        console.log(ongoingVotes[id])
        res.send({success: true})
      }
    } else {
      res.send({success: false})
    }
  });
});

app.get("/question/:id", (req, res) => {
  var id= req.params.id;
  if(!id) {
    res.render('error', {
      error: "This question does not exist"
    });
    return
  }
  console.time("getQuestion")
  api.getQuestion(id).then(data => {
  console.timeEnd("getQuestion")
  console.time("getAnswers")

    if(!data.success) {
      res.render('error', {
        error: data.failed ? "Failed to get question, please try again later." : "This question doesn't exist."
      });
      return;
    }
  

  
      
      data.question.views ++;
    api.hasUserVoted(id, req.session.user?.username).then(data3 => {
      io.emit("increaseView", id)
      // console.timeEnd("getQuestion")
      getBasicData(req.session.user?.username).then(basicData => {
        console.log(ongoingVotes[id])
    res.render('question', {
      question: data.question,
      user: req.session.user,
      loggedIn: req.session.loggedIn,
      username: req.session.user?.username,
      voted: data3,
      basicData,
      ongoingVotes: ongoingVotes[id] ?? {
        before: data.question.status,
        votes: []
      }
    })
    api.increaseViews(id).then(data4 => {
  });
  }).catch(err => {
    console.timeEnd("getQuestion")
    console.log(err)
    res.render('question', {
      question: data.question,
      user: req.session.user,
      loggedIn: req.session.loggedIn,
      username: req.session.user?.username,
      voted: {voted: false}
    })
  });
  });
});

  });
var basicDataCache = {};
function getBasicData(username) {
  return new Promise((resolve, reject) => {

  if(basicDataCache.hasOwnProperty(username) && Date.now() - basicDataCache[username].time < 5000) {
    resolve({success:true, ...basicDataCache[username].data})

  } else {
    api.getUser(username).then(data => {
      if(data.success) {
      var userPoints = data.user.points;
      let _level = levelCalculation(userPoints);
      // console.log("Level: " + _level)
      var needed = {
        time: Date.now(),
        data: {
          pfp: gravatarGen(data.user.email),
          level: _level,
          points: userPoints,
        }
      }
      basicDataCache[username] = needed;
      resolve({success:true, ...needed.data})
    } else {
      console.log(data.error)
      resolve(JSON.stringify({success: false}))
    }
    });
  }
});
}
app.get("/getBasicData", (req, res) => {
  if(req.query.user && typeof req.query.user == "string") {

    getBasicData(req.query.user).then(data => {

      if(data.success && req.session.loggedIn && req.session.user && req.session.user.username == req.query.user) {
        req.session.user.points = data.points;
        req.session.user.img = data.pfp;
        req.session.user.level = data.level;
      }
      res.send(data)
    });
  } else res.send(JSON.stringify({success: false}))
})

app.get("/questionComments", (req, res) => {
  var question = req.query.question;
  var after = req.query.after;
  api.getQuestionComments(question, after).then(data => {
    res.send(JSON.stringify(data))
  }).catch(err => {
    console.log(err)
    res.send(JSON.stringify({success: false}))
  });
});

app.post("/answerComments", (req, res) => {
  var answer = req.body.answer;
  var question = req.body.question;
  var after = req.body.after;
  console.log(req.body)
  api.getAnswerComments(question, answer, after).then(data => {
    res.send(JSON.stringify(data))
  }).catch(err => {
    console.log(err)
    res.send(JSON.stringify({success: false}))
  });
});

app.post("/addCommentQuestion", (req, res) => {
  if(!req.session.loggedIn) {
    res.send(JSON.stringify({success: false}))

    return
  }
  var question = req.body.question;
  var comment = req.body.text;
  var user = req.session.user.username;
  // console.log(question, comment, user)
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

app.get("/hasUserVotedComment", (req, res) => {
  var comment = req.query.comment;
  var user = req.session.user?.username;
  var question = req.query.question;
  var answer = req.query.answer;
  // console.log(comment, user, question, answer)
  api.hasUserVotedComment(question,comment,user,answer).then(data => {
    res.send(JSON.stringify(data))
  }).catch(err => {
    console.log(err)
    res.send(JSON.stringify({success: false}))
  });
});


app.post("/addCommentAnswer", (req, res) => {
  if(!req.session.loggedIn) {
    return res.send(JSON.stringify({success: false}))
  }
  var answer = req.body.answer;
  var comment = req.body.text;
  var user = req.session.user.username;
  var question = req.body.question;
  // console.log(answer, comment, user, question)
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
        if(password.length <= 10) {
          res.render('reset', {
            username: username,
            error: {msg: "Password must be at least 10 characters long"}
          })
          return;
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

var questionOwnerCache = {};

app.post("/api/question/:id/:type", (req,res) => {
  var id = req.params.id;
  var type = req.params.type;
  var action = req.body.action;
  // console.log(action, type, id)
  if(!id || !type || !action || (type != "upvote" && type != "downvote") || (action != "increment" && action != "decrement")) {
    res.send("Invalid question id or type")
    return
  }
  type += "s";
  api.voteQuestion(id, req.session.user?.username, type, action).then(async data => {
   
    res.send(JSON.stringify(data))
    if(!data.success) return;
    var dir = action == "increment" ? 1 : -1;
    if(!questionOwnerCache[id]) questionOwnerCache[id] = await api.getQuestionOwner(id);
    var owner = questionOwnerCache[id];
    await modifyPoints(dir*(type=="downvotes"?-1:5), owner);
    if(type == "downvotes") {
      await modifyPoints(dir*-1, req.session.user?.username);
    }
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
  // console.log(action, type, id)
  if(!id || !type || !action || (type != "upvote" && type != "downvote") || (action != "increment" && action != "decrement")) {
    res.send("Invalid answer id or type")
    return
  }
  type += "s";
  api.voteAnswer( question , id, req.session.user?.username, type, action).then(async data => {
   
    res.send(JSON.stringify(data))
    if(!data.success) return;
    var dir = action == "increment" ? 1 : -1;
    if(!answerOwnerCache[id]) answerOwnerCache[id] = await api.getAnswerOwner(question, id);
    var owner = answerOwnerCache[id];
    await modifyPoints(dir*(type=="downvotes"?-5:10), owner);
    if(type == "downvotes") {
      await modifyPoints(dir*-1, req.session.user?.username);
    }
    dir *= type == "upvotes" ? 1 : -1;
    if(data.success) {
      io.emit("voteA", [question, id, dir])
    }
  });
});

app.post("/api/comment/:id/:type", (req,res) => {
  var id = req.params.id;
  var type = req.params.type;
  var action = req.body.action;
  var  question = req.body.question;
  var answer = req.body.answer;
  var user = req.session.user?.username;
  if(!user) {
    res.send({success: false, msg: "You must be logged in to comment"})
    return
  }
  // console.log("vote comment", action, type, id, question, answer);
  if(!id || !type || !action || (type != "upvote" && type != "downvote") || (action != "increment" && action != "decrement") || !question) {
    res.send("Invalid answer id or type")
    return
  }
  type += "s";
  api.voteComment( user, id, type, action, question, answer).then(data => {
    res.send(JSON.stringify(data))
    if(!data.success) return;
    var dir = action == "increment" ? 1 : -1;
    dir *= type == "upvotes" ? 1 : -1;
    if(data.success) {
      io.emit("voteC", [question, id, dir, answer])
    }
  });
});

var liveCache = {
  votes: {},
  views: {},
  answerCount: {},
};

var answerVoteCache = {};
var questionCommentCache = {};

var answerCommentCache = {};

io.on('connection', (socket) => {
  console.log('a user connected');
  var lastRecieved = 0;


  socket.on('questionCommentVoteCount', async (questionId, commentId) => {
    if(questionCommentCache[questionId] && questionCommentCache[questionId][commentId] && Date.now() - questionCommentCache[questionId][commentId].time < 15000) {
      socket.emit('questionCommentVoteCount', [questionId, commentId, questionCommentCache[questionId][commentId].votes, questionCommentCache[questionId][commentId].time]);
      return;
    } else {
    var comments = await api.getAllQuestionComments(questionId);
    if(comments.success) {
      if(!questionCommentCache[questionId]) questionCommentCache[questionId] = {};
    var comment = comments.comments.find(c => c.comment_id == commentId);
    if(comment) {
      questionCommentCache[questionId][commentId] = {
        votes: comment.upvotes - comment.downvotes,
        time: Date.now()
      };
      socket.emit("questionCommentVoteCount", [questionId, commentId, comment.upvotes - comment.downvotes, Date.now()]);


      comments.comments.forEach(c => {
        questionCommentCache[questionId][c.comment_id] = {
          votes: c.upvotes - c.downvotes,
          time: Date.now()
        }
        });
    }
  }
}
  })

  socket.on('answerCommentVoteCount', async (questionId, answerId, commentId) => {
    if(answerCommentCache[questionId] && answerCommentCache[questionId][answerId] && answerCommentCache[questionId][answerId][commentId] && Date.now() - answerCommentCache[questionId][answerId][commentId].time < 15000) {
      socket.emit('answerCommentVoteCount', [questionId, answerId , commentId, answerCommentCache[questionId][answerId][commentId].votes, answerCommentCache[questionId][answerId][commentId].time]);
      return;
    } else {
    var comments = await api.getAllAnswerComments(questionId, answerId);
    if(comments.success) {
      if(!answerCommentCache[questionId]) answerCommentCache[questionId] = {};
      if(!answerCommentCache[questionId][answerId]) answerCommentCache[questionId][answerId] = {};
    var comment = comments.comments.find(c => c.comment_id == commentId);
    if(comment) {
      answerCommentCache[questionId][answerId][commentId] = {
        votes: comment.upvotes - comment.downvotes,
        time: Date.now()
      };
      socket.emit("answerCommentVoteCount", [questionId, answerId , commentId, comment.upvotes - comment.downvotes, Date.now()]);


      comments.comments.forEach(c => {
        answerCommentCache[questionId][answerId][c.comment_id] = {
          votes: c.upvotes - c.downvotes,
          time: Date.now()
        }
        });
    }
  }
}
  });

  socket.on('answerVoteCount', (a) => {
    
    var answer = a[0];
    var question = a[1];
    if(answerVoteCache[question] && answerVoteCache[question][answer] && Date.now() - answerVoteCache[question][answer].time < 10000) {
      socket.emit("answerVoteCount", [answer, question, answerVoteCache[question][answer].votes, answerVoteCache[question][answer].time]);

    } else {
    api.getAnswer(question, answer).then(data => {
      if(data.answer_id) {
        if(!answerVoteCache[question])  answerVoteCache[question] = {};
        var count = data.upvotes + data.downvotes;
        answerVoteCache[question][answer] = {votes: count, time: Date.now()};

          socket.emit("answerVoteCount", [question, answer, count, Date.now()]);
        console.log("answerVoteCount", question, answer, count)
      }
    });
  }
  })
  socket.on("getVotes", (qId) => {
    // if(Date.now() - lastRecieved < 100)  return
     lastRecieved = Date.now();
    if(liveCache.votes[qId] && Date.now() - liveCache.votes[qId].time < 10000) {
      socket.emit("questionVotes", liveCache.votes[qId].data, qId, liveCache.votes[qId].time);
    } else {
      console.log(liveCache.views[qId])
      if(liveCache.votes[qId]) {
        liveCache.votes[qId].time = Date.now();
        liveCache.views[qId].time = Date.now();
        liveCache.answerCount[qId].time = Date.now();
        }
    api.getQuestion(qId).then(data => {
      if(data.success) {
        liveCache.votes[qId] = {
          time: Date.now(),
          data: {upvotes: data.question.upvotes, downvotes: data.question.downvotes}
        }
        liveCache.views[qId] = {
          time: Date.now(),
          data: data.question.views
        }
        liveCache.answerCount[qId] = {
          time: Date.now(),
          data: data.question.answers
        }
        socket.emit("questionVotes", liveCache.votes[qId].data, qId, liveCache.votes[qId].time);
      }

    });
  }
  })
  socket.on("getViews", (qId) => {

    // if(Date.now() - lastRecieved < 100)  return
    console.log("getViews", qId)


    if(liveCache.views[qId] && Date.now() - liveCache.views[qId].time < 1000 * 5) {
      socket.emit("questionViews", liveCache.views[qId].data, qId, liveCache.views[qId].time);

    } else {
      console.log(liveCache.views[qId])
      if(liveCache.votes[qId]) {
        liveCache.votes[qId].time = Date.now();
        liveCache.views[qId].time = Date.now();
        liveCache.answerCount[qId].time = Date.now();
        }
    api.getQuestion(qId).then(data => {
      if(data && data.success) {
        liveCache.votes[qId] = {
          time: Date.now(),
          data: {upvotes: data.question.upvotes, downvotes: data.question.downvotes}
        }
        liveCache.views[qId] = {
          time: Date.now(),
          data: data.question.views
        }
        liveCache.answerCount[qId] = {
          time: Date.now(),
          data: data.question.answers
        }
        socket.emit("questionViews", liveCache.views[qId].data,qId, liveCache.views[qId].time);

      }
    });
  }
  })
  socket.on("getAnswerCount", (qId) => {
    if(Date.now() - lastRecieved < 100)  return


     lastRecieved = Date.now();
    if(liveCache.answerCount[qId] && Date.now() - liveCache.answerCount[qId].time < 1000 * 5) {
      socket.emit("answerCount", liveCache.answerCount[qId].data,qId, liveCache.answerCount[qId].time);
    } else {
      console.log(liveCache.views[qId])
      if(liveCache.votes[qId]) {
      liveCache.votes[qId].time = Date.now();
      liveCache.views[qId].time = Date.now();
      liveCache.answerCount[qId].time = Date.now();
      }
    api.getQuestion(qId).then(data => {
      if(data.success) {
        liveCache.votes[qId] = {
          time: Date.now(),
          data: {upvotes: data.question.upvotes, downvotes: data.question.downvotes}
        }
        liveCache.views[qId] = {
          time: Date.now(),
          data: data.question.views
        }
        liveCache.answerCount[qId] = {
          time: Date.now(),
          data: data.question.answers
        }
        socket.emit("answerCount", liveCache.answerCount[qId].data,qId, liveCache.answerCount[qId].time);
      }
    });
  }
  })
  socket.on('disconnect', () => {
    // console.log('user disconnected');
  });
});


server.listen(port, () => console.log(`Example app listening on port ${port}!`))

