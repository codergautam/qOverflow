const fetch = require('node-fetch');
const passwordUtils = require('./utils/password');

class Api {
  constructor(key) {
    this.baseUrl = 'https://qOverflow.api.hscc.bdpa.org/v1';
    this.key = key
    console.log(this.key)
  }
   async sendRequest(endpoint, method, data) {
    try {
    var req = await fetch(this.baseUrl+endpoint, {
      method: method,
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'bearer '+this.key
      }
    })
    var text= await req.text()
   
    return JSON.parse(text)
  } catch (error) {
    // TODO: handle error
    console.log(error)
  }
  }

  async findUsernameFromEmail(userEmail) {
    let data = await this.sendRequest("/users", 'GET');
    let users = data.users;
    let selectedUsername;
    for(let i = 0; i < users.length; i++) {
        if(users[i].email == userEmail) {
            console.log("Confirmed Same Email");
            console.log(users[i]);
            selectedUsername = users[i].username;
        }
    }
    return selectedUsername;
  }

  async deleteUser(username) {
    return this.sendRequest("/users/" + username, 'DELETE');
  }

  async loginUser(username, password, salt) {

    const saltBuffer = await passwordUtils.convertHexToBuffer(salt);

    const { keyString  } = await passwordUtils.deriveKeyFromPassword(password, saltBuffer);

    // console.log(saltBuffer + "  |  " + keyString);

    return this.sendRequest('/users/' + username + '/auth', 'POST', {
        key: keyString
    });
  }

  async createUser(username, email, password) {
    // POST to /users with username, email, login key and salt

    // First generate a salt and login key
    const { keyString, saltString } = await passwordUtils.deriveKeyFromPassword(password);

    // Then send the request
    return this.sendRequest('/users', 'POST', {
      username: username,
      email: email,
      key: keyString,
      salt: saltString
    });
  }

  async createQuestion(username, title, text) {
    return this.sendRequest('/questions', 'POST', {
      creator: username,
      title: title,
      text: text
    })
  }

  async getUser(username) {
    return this.sendRequest('/users/'+username, 'GET');
  }

  async getQuestions(sort, regex, match, after) {
    //Sort param: ---------
    //u responds with the first element (most upvotes)
    //uvc responds with the first element (most upvotes, views and comments)
    //uvac responds with the first element (most upvotes, views, answers and comments)
    //No sort responds with most recent first

    //RegexMatch param: ---------
    //Create regexMatch query objects, that kind correspond with api response

    //Match param: ---------
    //Create query objects, see API Documentation for an exampel
    
    //After param: ---------
    //Just get whatever questions are after the question_id put in
    console.log(match)
    var params =  {
      sort: sort,
      regexMatch: regex ? JSON.stringify(regex) : undefined ,
      match: match ? JSON.stringify(match): undefined,
      after: after
    };
  
    
    var urlEncodedParams = new URLSearchParams();
    for (var key in params) {
     if(params[key]) urlEncodedParams.append(key, params[key]);
    }
    console.log(urlEncodedParams.toString())


    // console.log('/questions/search?'+urlEncodedParams.toString().replaceAll("%25","%"));
    // return await this.sendRequest('/questions/search?'+urlEncodedParams.toString().replaceAll("%25","%"), 'GET');
    
    return await this.sendRequest('/questions/search?'+urlEncodedParams, 'GET');
  }
   
  
  async getUserQuestions(username) {
    let userQuestions = await this.sendRequest('/users/' + username + '/questions', 'GET')
    return userQuestions
  }

  async getUserAnswers(username) {
    let userAnswers = await this.sendRequest('/users/' + username + '/answers', 'GET')
    return userAnswers
  }

  getQuestion(questionId) {
    return this.sendRequest('/questions/' + questionId, 'GET');
  }

  hasUserVoted(questionId, username) {
    if(username) {
    return new Promise((resolve, reject) => {
    this.sendRequest('/questions/' + questionId + '/vote/' + username, 'GET').then(data => {
      console.log(data)
      if(data.success) {
        if(data.error) resolve({voted: false, error: data.error})
        else resolve({voted: true, vote: data.vote})
      }
      else resolve({voted: false});
    }).catch(err => {
      reject(err)
    });
  });
} else {
  return new Promise((resolve, reject) => {
    resolve(false)
  });
}

  }

  getQuestion(questionId) {
    return this.sendRequest('/questions/' + questionId, 'GET');
  }

  hasUserVotedAnswer(questionId, answerId, username) {
    if( username) {

      return new Promise((resolve, reject) => {
        this.sendRequest('/questions/' + questionId + '/answers/' + answerId + '/vote/' + username, 'GET').then(data => {
          if(data.success) {
            if(data.error) resolve({success:true, voted: false, error: data.error})
            else resolve({success: true, voted: true, vote: data.vote})
          }
          else resolve({voted: false});
        }).catch(err => {
          reject(err)
        });
      });
    } else {
      return new Promise((resolve, reject) => {
        resolve(false)
      });
    }
  }

  hasUserVoted(questionId, username) {
    if(username) {
    return new Promise((resolve, reject) => {
    this.sendRequest('/questions/' + questionId + '/vote/' + username, 'GET').then(data => {
      console.log(data)
      if(data.success) {
        if(data.error) resolve({voted: false, error: data.error})
        else resolve({voted: true, vote: data.vote})
      }
      else resolve({voted: false});
    }).catch(err => {
      reject(err)
    });
  });
} else {
  return new Promise((resolve, reject) => {
    resolve(false)
  });
}
  }

  async voteQuestion(questionId, username, target, action) {
    console.log(questionId, username, target, action)
    var req = this.sendRequest('/questions/' + questionId + '/vote/' + username, 'PATCH', {
      operation: action,
      target
    });
    return req;
  }

  async voteAnswer(questionId, answerId, username, target, action) {
    console.log(questionId, answerId, username, target, action)
    console.log(action)
    var req = this.sendRequest('/questions/' + questionId + '/answers/' + answerId + '/vote/' + username, 'PATCH', {
      operation: action,
      target
    });
    return req;
  }

  async updateUser(username, salt, key, email, points) {
    return this.sendRequest('/users/' + username, 'PATCH', {
      salt: salt,
      key: key,
      email: email,
      points: points
    });
  }

  async resetPassword(username, password) {
    const { keyString, saltString } = await passwordUtils.deriveKeyFromPassword(password);
    return this.updateUser(username, saltString, keyString, undefined, undefined);
  }
    
  async increaseViews(questionId) {
    try {
    var send = await this.sendRequest('/questions/' + questionId , 'PATCH', {
      views: "increment"
    });
    if(send.success) return true;
    else return false;
  } catch (error) {
    console.log(error)
    return false;
  }
}


  getAnswers(questionId, count=Infinity) {
  if(count > 0)  return this.sendRequest('/questions/' + questionId + '/answers', 'GET');
  else return new Promise((resolve, reject) => {
    // if count is 0, return an empty array
    resolve([]);
  });
  }

  makeid(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
    return result;
  }
}

module.exports = Api;