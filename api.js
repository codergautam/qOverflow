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
    console.log(text)
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
    var params =  {
      sort: sort,
      regexMatch: regex ? encodeURIComponent(JSON.stringify(regex)) : undefined ,
      match: match ? encodeURIComponent(JSON.stringify(match)): undefined,
      after: after
    };
  
    
    var urlEncodedParams = new URLSearchParams();
    for (var key in params) {
     if(params[key]) urlEncodedParams.append(key, params[key]);
    }


    // console.log('/questions/search?'+urlEncodedParams.toString().replaceAll("%25","%"));
    return await this.sendRequest('/questions/search?'+urlEncodedParams.toString().replaceAll("%25","%"), 'GET');
    
  }

  async getUserQuestionsAnswers(username) {
    let userQuestions = await this.sendRequest('/users/' + username + '/questions', 'GET')
    let userAnswers = await this.sendRequest('/users/' + username + '/answers', 'GET')
    return [ userQuestions, userAnswers ]
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