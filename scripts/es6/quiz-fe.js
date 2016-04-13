// Description:
//   Utility commands surrounding Hubot uptime.
'use strict';

// read json
const conf = require('../../private/conf.json');
const messages = require('../../message/message-ja.json');
// import modules
const util = require('util');
const GS = require('google-spreadsheet');
const creds = require(conf.creds)
const sheet = new GS(conf.sheet);
// brain keys
const KEY_SCORES = 'scores';
const KEY_QUIZ = 'quiz';

let quizList = {};

module.exports = (robot) => {

  // when a request is received.
  robot.respond(/request$|req$/i, (res) => {
    sendQuiz(robot, res);
  });

  // when bot is invited room.
  //TODO not work this method.
  robot.enter((res) => {
    res.send('debug: entered room');
    sendQuiz(robot, res);
  });
  
  // when a answer is received.
  robot.respond(/answer\s*(.*)$|ans\s*(.*)$/i, (res) => {
    receivedAnswer(robot, res);
  });

  // when request to show help.
  robot.respond(/help$/i, (res) => {
    //TODO create help message.
    res.send(messages.help);
  });

  // when request to reload questions sheet.
  robot.respond(/reload$/i, (res) => {
    sheetParse(sheet, creds)
      .then(
        (quizData) => {
          quizList = quizData
          res.send(messages.success_reload);
        },
        () => process.exit(0)
      );
  });
  
  // debug command
  robot.respond(/debug req (.*)$/i, (res) => {
    let quiz = quizList.find((obj) => { 
      return obj.id == res.match[1];
    });
  
    robot.brain.set("quiz", quiz);
  
    res.send(util.format(messages.quiz, quiz.term,
                                        quiz.question,
                                        quiz.options[0], 
                                        quiz.options[1], 
                                        quiz.options[2], 
                                        quiz.options[3]));
  });
};

/**
 * To get quiz and send it.
 * @param robot
 * @param res
 */
const sendQuiz = (robot, res) => {

  // to get quiz.
  var quiz = res.random(quizList);
  if(!quiz) return;
  
  robot.brain.set("quiz", quiz);

  res.send(util.format(messages.quiz, quiz.term,
                                      quiz.question,
                                      quiz.options[0], 
                                      quiz.options[1], 
                                      quiz.options[2], 
                                      quiz.options[3]));
};

/**
 * To decision correct or incorrect.
 * Also, scoring by the decision.
 * @param robot
 * @param res
 */
const receivedAnswer = (robot, res) => {

  var answerOption = res.match[1] || res.match[2];
  let userId = res.message.user.id;
  let userName = res.message.user.name;
    
  // to get score of user.
  let scores = robot.brain.get(KEY_SCORES);
  if (!scores) {
    scores = [];
    robot.brain.set(KEY_SCORES, scores);
  }

  let scoreObj = scores.find((obj) => {
    return obj.userId == userId;
  });
  
  // to create new one, when not exist score object.
  if (!scoreObj) {
    scoreObj = {"userId": userId, "score": 0};
    scores.push(scoreObj);
  }

  // to get present quiz.
  let quiz = robot.brain.get(KEY_QUIZ);
  if (!quiz) {
    res.send(util.format(messages.error_not_request_quiz, robot.name, robot.name));
    return;
  }

  if (answerOption == quiz.correct){
    // if correct.
    scoreObj.score++;
    res.send(util.format(messages.correct, userName) + '\n' + 
             util.format(messages.score, scoreObj.score));
  } else {
    // if incorrect.
    if (scoreObj.score > 0) scoreObj.score--; 
    res.send(util.format(messages.incorrect, userName, quiz.correct, quiz.comment) + '\n\n' + 
             util.format(messages.score, scoreObj.score));
  }
  
  // clear quiz.
  robot.brain.remove(KEY_QUIZ);
};

/**
 * To get data for quiz from GoogleSpreadSheet.
 * @param sheet identifier for sheet.
 * @param creds object for credential.
 */
const sheetParse = (sheet, creds) => {
  return new Promise((resolve, reject) => {
    let sheetData = [];

    sheet.useServiceAccountAuth(creds, (err) => {
      if (err) {
        console.log(err);
        reject(err);
        return;
      }
      sheet.getInfo((err, sheetInfo) => {
        if (err) {
          console.log(err);
          reject(err);
          return
        }

        const sheet1 = sheetInfo.worksheets[0];
        sheet1.getRows((err, rows) => {
          if (err) {
            console.log(err);
            reject(err);
            return;
          }
          sheetData = rows.map((row) => {
            return {
                id: row.id,
                question: row.question,
                options: [
                row.optiona,
                row.optionb,
                row.optionc,
                row.optiond
              ],
              correct: row.answeroption,
              comment: row.comment,
              term: row.term
            };
          });
          resolve(sheetData);
        });
      });
    });
  });
};


// to execute when start bot.
sheetParse(sheet, creds)
  .then(
    (quizData) => quizList = quizData,
    () => process.exit(0)
  );
