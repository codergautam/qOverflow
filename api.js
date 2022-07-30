const fetch = require("node-fetch");
const passwordUtils = require("./utils/password");
const process = require("process");
const delay = (time) => new Promise((res) => setTimeout(res, time));

class Api {
  constructor(key) {
    this.baseUrl = "https://qOverflow.api.hscc.bdpa.org/v1";
    this.key = key;
    console.log(this.key);
    this.requestsThisSecond = 0;
    this.lockAfter = 7;
    this.requestsInQueue = 0;
    this.questionCache = {};
    setInterval(() => {
      this.requestsThisSecond = 0;
    }, 1200);
  }
  async sendRequest(endpoint, method, data, count = 0) {
    this.requestsInQueue++;
    await delay(200 * (this.requestsInQueue - 1));

    console.log(
      "Send request: " + endpoint,
      method,
      "Queue wait:" + 200 * (this.requestsInQueue - 1)
    );
    this.requestsThisSecond++;
    if (this.requestsThisSecond <= this.lockAfter) {
      try {
        var req = await fetch(this.baseUrl + endpoint, {
          method: method,
          body: JSON.stringify(data),
          headers: {
            "Content-Type": "application/json",
            Authorization: "bearer " + this.key,
          },
        });
      } catch (e) {
        console.log(e);
        this.requestsInQueue--;
        if (count <= 2)
          return await this.sendRequest(endpoint, method, data, count + 1);
        else
          return {
            success: false,
            failed: true,
            error: "Failed to send request",
          };
      }
      if (req.ok) {
        this.requestsInQueue--;
        try {
          var text = await req.text();
        } catch (e) {
          console.log(e, count);
          return { success: false, failed: true };
        }

        try {
          return Math.random() > 0 ? JSON.parse(text) :{ success: false, failed: true };
        } catch (e) {
         if(count <= 3) return await this.sendRequest(endpoint, method, data, count + 1);
          else return { success: false, failed: true };
        }
      } else {
        var status = req.status;
        console.log(status);
        if ((status != 404) || (status != 403)) {
          this.requestsInQueue--;
          return { success: false, failed: true };
        } else if (status == 404) {
          // 5 retries
          this.requestsInQueue--;
          try {
            var r = await req.text();
            r = JSON.parse(r);
            return r;
          } catch (e) {
            console.log(e);
          if (count <= 5)
            return await this.sendRequest(endpoint, method, data, count + 1);
          else return { success: false, failed: true };
          }
        } else if (status == 403) {
          this.requestsInQueue--;
          console.log("403");
          try {
            var r = await req.text();
            r = JSON.parse(r);
            console.log(r);
            return r;
          } catch (e) {
            console.log(e);
           return { success: false, failed: true };
          }
        }

      }
      } else {
      
          console.log("WOAH WOHA SLOW DOWN MY FIRNED");
          setTimeout(async () => {
            this.requestsInQueue--;
            return await this.sendRequest(endpoint, method, data, count + 1);
          }, 5000);
          // process.exit(1)

          // throw new Error("Too many requests")
      }
  }

  async updateAnswer(questionId, answerId, text, upvotes, downvotes, accepted) {
    questionId = encodeURIComponent(questionId);
    answerId = encodeURIComponent(answerId);
    return this.sendRequest(
      "/questions/" + questionId + "/answers/" + answerId,
      "PATCH",
      {
        text: text,
        upvotes: upvotes,
        downvotes: downvotes,
        accepted: accepted,
      }
    );
  }

  async findUsernameFromEmail(userEmail) {
    let data = await this.sendRequest("/users", "GET");
    let users = data.users;
    let selectedUsername;
    for (let i = 0; i < users.length; i++) {
      if (users[i].email == userEmail) {
        console.log("Confirmed Same Email");
        console.log(users[i]);
        selectedUsername = users[i].username;
      }
    }
    return selectedUsername;
  }

  async getAllAnswers(questionId) {
    questionId = encodeURIComponent(questionId);
    var answers = [];
    var lastAnswer = null;
    var success = true;
    while (true) {
      var data = await this.sendRequest(
        "/questions/" +
          questionId +
          "/answers" +
          (lastAnswer ? "?after=" + lastAnswer : ""),
        "GET"
      );
      if (data.success) {
        if (data.answers.length == 0) {
          break;
        }
        answers = answers.concat(data.answers);
        lastAnswer = data.answers[data.answers.length - 1].answer_id;
        if (data.answers.length < 100) break;
      } else {
        success = false;
        break;
      }
    }
    return { success: success, answers: answers };
  }

  async deleteUser(username) {
    username = encodeURIComponent(username);
    return this.sendRequest("/users/" + username, "DELETE");
  }

  async loginUser(username, password, salt) {
    username = encodeURIComponent(username);
    const saltBuffer = await passwordUtils.convertHexToBuffer(salt);

    const { keyString } = await passwordUtils.deriveKeyFromPassword(
      password,
      saltBuffer
    );

    // console.log(saltBuffer + "  |  " + keyString);

    return this.sendRequest("/users/" + username + "/auth", "POST", {
      key: keyString,
    });
  }

  async createUser(username, email, password) {
    // POST to /users with username, email, login key and salt

    // First generate a salt and login key
    const { keyString, saltString } = await passwordUtils.deriveKeyFromPassword(
      password
    );

    // Then send the request
    return this.sendRequest("/users", "POST", {
      username: username,
      email: email,
      key: keyString,
      salt: saltString,
    });
  }

  async createQuestion(username, title, text) {
    return this.sendRequest("/questions", "POST", {
      creator: username,
      title: title,
      text: text,
    });
  }

  async getUser(username) {
    username = encodeURIComponent(username);
    return this.sendRequest("/users/" + username, "GET");
  }

  async updateQuestion(id, status, title, text, views, upvotes, downvotes) {
    id = encodeURIComponent(id);
    return this.sendRequest("/questions/" + id, "PATCH", {
      status: status,
      title: title,
      text: text,
      views: views,
      upvotes: upvotes,
      downvotes: downvotes,
    });
  }

  async changeQuestionStatus(id, status) {
    return this.updateQuestion(
      id,
      status,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );
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
    var params = {
      sort: sort,
      regexMatch: regex ? JSON.stringify(regex) : undefined,
      match: match ? JSON.stringify(match) : undefined,
      after: after,
    };

    var urlEncodedParams = new URLSearchParams();
    for (var key in params) {
      if (params[key]) urlEncodedParams.append(key, params[key]);
    }

    // console.log('/questions/search?'+urlEncodedParams.toString().replaceAll("%25","%"));
    // return await this.sendRequest('/questions/search?'+urlEncodedParams.toString().replaceAll("%25","%"), 'GET');

    return await this.sendRequest(
      "/questions/search?" + urlEncodedParams,
      "GET"
    );
  }
   
  async getUserMail(username, after = null) {
    let condition = (after) ? `?after=${after}` : ''
    return await this.sendRequest('/mail/' + username + condition, 'GET')
  }

  async modifyPoints(username, amount) {
    username = encodeURIComponent(username);
    let operation = Math.sign(amount) > 0 ? "increment" : "decrement";
    return await this.sendRequest("/users/" + username + "/points", "PATCH", {
      operation: operation,
      amount: amount,
    });
  }

  async deleteUser(username) {
    username = encodeURIComponent(username);
    return await this.sendRequest("/users/" + username, "DELETE");
  }

  async changePasswordOf(username, keyString, saltString) {
    username = encodeURIComponent(username);
    return await this.sendRequest("/users/" + username, "PATCH", {
      key: keyString,
      salt: saltString,
    });
  }

  async changeEmailOf(username) {
    username = encodeURIComponent(username);
    return await this.sendRequest("/users/" + username, "PATCH", {
      email: newEmail,
    });
  }

  async sendMessage(sender, receiver, subject, text) {
    return await this.sendRequest("/mail", "POST", {
      sender: sender,
      receiver: receiver,
      subject: subject,
      text: text,
    });
  }
  async getUserQuestions(username, after = null) {
    username = encodeURIComponent(username);
    let condition = after ? `?after=${encodeURIComponent(after)}` : "";
    let userQuestions = await this.sendRequest(
      "/users/" + username + "/questions" + condition,
      "GET"
    );
    return userQuestions;
  }

  async getUserAnswers(username, after = null) {
    username = encodeURIComponent(username);
    let condition = after ? `?after=${encodeURIComponent(after)}` : "";

    let userAnswers = await this.sendRequest(
      "/users/" + username + "/answers" + condition,
      "GET"
    );
    return userAnswers;
  }

  getQuestion(questionId) {
    questionId = encodeURIComponent(questionId);
    if (
      this.questionCache[questionId] &&
      Date.now() - this.questionCache[questionId].time < 5000
    ) {
      return new Promise((resolve, reject) => {
        console.log("Caching");
        resolve({
          success: true,
          question: this.questionCache[questionId].question,
        });
      });
    } else {
      return new Promise((resolve, reject) => {
        this.sendRequest("/questions/" + questionId, "GET")
          .then((data) => {
            if (data.success) {
              this.questionCache[questionId] = {
                time: Date.now(),
                question: data.question,
              };
              resolve(data);
            } else {
              resolve(data);
            }
          })
          .catch((err) => {
            resolve({ success: false, failed: true });
          });
      });
    }
  }

  hasUserVoted(questionId, username) {
    questionId = encodeURIComponent(questionId);
    username = encodeURIComponent(username);
    if (username) {
      return new Promise((resolve, reject) => {
        this.sendRequest(
          "/questions/" + questionId + "/vote/" + username,
          "GET"
        )
          .then((data) => {
            if (data.success) {
              if (data.error) resolve({ voted: false, error: data.error });
              else resolve({ voted: true, vote: data.vote });
            } else resolve({ voted: false });
          })
          .catch((err) => {
            reject(err);
          });
      });
    } else {
      return new Promise((resolve, reject) => {
        resolve(false);
      });
    }
  }

  hasUserVotedComment(questionId, commentId, username, answerId = undefined) {
    questionId = encodeURIComponent(questionId);
    commentId = encodeURIComponent(commentId);
    username = encodeURIComponent(username);
    if (answerId == "undefined") {
      answerId = undefined;
    }
    if (answerId) answerId = encodeURIComponent(answerId);

    if (!username) {
      return new Promise((resolve, reject) => {
        resolve(false);
      });
    }

    if (answerId)
      var endpoint =
        "/questions/" +
        questionId +
        "/answers/" +
        answerId +
        "/comments/" +
        commentId +
        "/vote/" +
        username;
    else
      var endpoint =
        "/questions/" +
        questionId +
        "/comments/" +
        commentId +
        "/vote/" +
        username;

    return new Promise((resolve, reject) => {
      this.sendRequest(endpoint, "GET")
        .then((data) => {
          if (data.success) {
            if (data.error) resolve({ voted: false, error: data.error });
            else resolve({ voted: true, vote: data.vote });
          } else resolve({ voted: false });
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  getQuestionComments(questionId, after) {
    questionId = encodeURIComponent(questionId);
    if (after) after = encodeURIComponent(after);
    return this.sendRequest(
      "/questions/" +
        questionId +
        "/comments" +
        (after ? "?after=" + after : ""),
      "GET"
    );
  }

  getAnswerComments(questionId, answerId, after) {
    questionId = encodeURIComponent(questionId);
    answerId = encodeURIComponent(answerId);
    if (after) after = encodeURIComponent(after);
    return this.sendRequest(
      "/questions/" +
        questionId +
        "/answers/" +
        answerId +
        "/comments" +
        (after ? "?after=" + after : ""),
      "GET"
    );
  }

  addCommentQuestion(questionId, username, text) {
    questionId = encodeURIComponent(questionId);
    return this.sendRequest("/questions/" + questionId + "/comments", "POST", {
      creator: username,
      text: text,
    });
  }

  addCommentAnswer(questionId, answerId, username, text) {
    questionId = encodeURIComponent(questionId);
    answerId = encodeURIComponent(answerId);
    return this.sendRequest(
      "/questions/" + questionId + "/answers/" + answerId + "/comments",
      "POST",
      {
        creator: username,
        text: text,
      }
    );
  }

  hasUserVotedAnswer(questionId, answerId, username) {
    questionId = encodeURIComponent(questionId);
    answerId = encodeURIComponent(answerId);

    if (username) {
      return new Promise((resolve, reject) => {
        this.sendRequest(
          "/questions/" +
            questionId +
            "/answers/" +
            answerId +
            "/vote/" +
            username,
          "GET"
        )
          .then((data) => {
            if (data.success) {
              if (data.error)
                resolve({ success: true, voted: false, error: data.error });
              else resolve({ success: true, voted: true, vote: data.vote });
            } else resolve({ voted: false });
          })
          .catch((err) => {
            reject(err);
          });
      });
    } else {
      return new Promise((resolve, reject) => {
        resolve(false);
      });
    }
  }

  hasUserVoted(questionId, username) {
    questionId = encodeURIComponent(questionId);
    if (username) {
      return new Promise((resolve, reject) => {
        this.sendRequest(
          "/questions/" + questionId + "/vote/" + username,
          "GET"
        )
          .then((data) => {
            console.log("AAAH", data);
            if (data.success) {
              if (data.error) resolve({ voted: false, error: data.error });
              else resolve({ voted: true, vote: data.vote });
            } else resolve({ voted: false });
          })
          .catch((err) => {
            reject(err);
          });
      });
    } else {
      return new Promise((resolve, reject) => {
        resolve(false);
      });
    }
  }

  async voteQuestion(questionId, username, target, action) {
    questionId = encodeURIComponent(questionId);
    username = encodeURIComponent(username);
    var req = this.sendRequest(
      "/questions/" + questionId + "/vote/" + username,
      "PATCH",
      {
        operation: action,
        target,
      }
    );
    return req;
  }

  async voteAnswer(questionId, answerId, username, target, action) {
    questionId = encodeURIComponent(questionId);
    answerId = encodeURIComponent(answerId);
    username = encodeURIComponent(username);
    var req = this.sendRequest(
      "/questions/" + questionId + "/answers/" + answerId + "/vote/" + username,
      "PATCH",
      {
        operation: action,
        target,
      }
    );
    return req;
  }

  async voteComment(
    user,
    commentId,
    target,
    action,
    questionId,
    answerId = undefined
  ) {
    questionId = encodeURIComponent(questionId);
    commentId = encodeURIComponent(commentId);
    user = encodeURIComponent(user);
    if (answerId) answerId = encodeURIComponent(answerId);
    if (answerId)
      var endpoint =
        "/questions/" +
        questionId +
        "/answers/" +
        answerId +
        "/comments/" +
        commentId +
        "/vote/" +
        user;
    else
      var endpoint =
        "/questions/" + questionId + "/comments/" + commentId + "/vote/" + user;
    var req = this.sendRequest(endpoint, "PATCH", {
      operation: action,
      target,
    });
    return req;
  }

  async updateUser(username, salt, key, email, points) {
    username = encodeURIComponent(username);
    return this.sendRequest("/users/" + username, "PATCH", {
      salt: salt,
      key: key,
      email: email,
      points: points,
    });
  }

  async resetPassword(username, password) {
    username = encodeURIComponent(username);
    const { keyString, saltString } = await passwordUtils.deriveKeyFromPassword(
      password
    );
    return this.updateUser(
      username,
      saltString,
      keyString,
      undefined,
      undefined
    );
  }

  async getQuestionOwner(questionId) {
    var q = await this.getQuestion(questionId);

    return q.question.creator;
  }

  async getAnswer(questionId, answerId) {
    var answer = undefined;
    var lastSaw = undefined;
    while (answer == undefined) {
      var j = await this.getAnswers(questionId, undefined, lastSaw);
      if (j.success) {
        answer = j.answers.find((a) => a.answer_id == answerId);
        lastSaw = j.answers[j.answers.length - 1].answer_id;
      } else {
        console.log(j);
        break;
      }
    }
    return answer;
  }

  async getAnswerOwner(questionId, answerId) {
    var a = await this.getAnswer(questionId, answerId);
    return a.creator;
  }

  async increaseViews(questionId) {
    questionId = encodeURIComponent(questionId);
    try {
      var send = await this.sendRequest("/questions/" + questionId, "PATCH", {
        views: "increment",
      });
      if (send.success) return true;
      else return false;
    } catch (error) {
      return false;
    }
  }

  getAnswers(questionId, count = Infinity, after = undefined) {
    questionId = encodeURIComponent(questionId);
    if (after) after = encodeURIComponent(after);
    if (count > 0)
      return this.sendRequest(
        "/questions/" +
          questionId +
          "/answers" +
          (after ? "?after=" + after : ""),
        "GET"
      );
    else
      return new Promise((resolve, reject) => {
        // if count is 0, return an empty array
        resolve([]);
      });
  }

  addAnswer(questionId, username, text) {
    questionId = encodeURIComponent(questionId);
    return this.sendRequest("/questions/" + questionId + "/answers", "POST", {
      creator: username,
      text: text,
    });
  }

  makeid(length) {
    var result = "";
    var characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }
}

module.exports = Api;
