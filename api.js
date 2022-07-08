const fetch = require('node-fetch');
const passwordUtils = require('./utils/password');

class Api {
  constructor(key) {
    this.baseUrl = 'https://drive.api.hscc.bdpa.org/v1'
    this.key = key
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

  async loginUser(username, password, userData) {

    const saltBuffer = await passwordUtils.convertHexToBuffer(userData.salt);

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

  async createFile(username, name, textContent, tags = [" "]) {
    return this.sendRequest('/filesystem/' + username, 'POST', {
      type: 'file',
      name: name, 
      text: textContent,
      tags: tags,
      lock: {
        user: username,
        client: this.makeid(12),
        createdAt: Date.now()
      }
    })
  }

  async getUserFiles(username) {
    return this.sendRequest('/filesystem/' + username + '/search', 'GET');
  }8

  async getUser(username) {
    return this.sendRequest('/users/'+username, 'GET');
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