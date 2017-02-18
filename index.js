var SlackBot = require('slackbots');
require('dotenv').config();
var handleSymptoms = require('./handleSymptoms.js');
var handlePains = require('./handlePains.js');


var TOKEN = process.env.TOKEN;
var BOTNAME = process.env.BOTNAME;
var infoLoaded = false;

console.log("Token: " + TOKEN);
console.log("Bot Name: " + BOTNAME);

// create a bot 
var bot = new SlackBot({
    token: TOKEN, // Add a bot https://my.slack.com/services/new/bot and put the token  
    name: BOTNAME
});

var info;
var questionTexts;
var symptoms;

bot.on('infoLoaded', function(loadedInfo) {
    console.log("Yay! All info loaded!");
    info = loadedInfo;
    infoLoaded = true;
    questionTexts = info['qns'];
    symptoms = info["sympts"];
    bot.emit('start');
});

var getQuestions = require('./loadInfo.js')(bot, ["./questions.txt", "./symptoms.txt"], ["qns", "sympts"]);
var conditionsMet = 0;

var currentUsers = {}; // Upon starting, no currently active users

// GLOBAL ENCODING OF CONTROL FLOW AND LOGIC (MOORE FSM)
//var transitionMatrix = [[0, 1, 2], [1, 2, 3], [2, 3, 4], [3, 0, 4]];
var transitionMatrix = [[3, 1], [3, 2], [3], [3, 1, 4], [4, 5]];

var ERROR_MESSAGE = "Sorry, that is not a valid answer. Please enter one of the numbers in the prompt.";
var PLACEHOLDER = "Alright, noted!";
var params = {
    icon_emoji: ':cat:'
};

var LIST_SYMPTOMS_STATE = 0;
var DESCRIBE_SYMPTOMS_STATE = 1;
var DESCRIBE_PAINS_STATE = 2;
var OTHER_CONCERNS_STATE = 3;
var PRIMARY_CONCERN_STATE = 4;

var users;

bot.on('start', function() {
    conditionsMet ++;
    //if (!qnsLoaded || !symptsLoaded) {
    if (!infoLoaded) {
        console.log("Qns or symptoms not yet loaded, wackie going back to sleep");
        return;
    }
    if (conditionsMet < 2) {console.log("Users may not yet be loaded, wackie going back to sleep");return;}
    console.log("Wacky is up!");

    users = bot.getUsers(); // Will be updated to include users that join after bot has started-up
    //console.log(JSON.stringify(users));
    console.log("No. of users: " + users["_value"]["members"].length);
    console.log("Groups: " + JSON.stringify(bot.getGroups()));
    console.log("Channels: " + JSON.stringify(bot.getChannels()));
    console.log("Questions: " + JSON.stringify(questionTexts));
    console.log("Symptoms: " + JSON.stringify(symptoms));
    // define channel, where bot exist. You can adjust it there https://my.slack.com/services  
    bot.postMessageToChannel('general', "I'm awake!", params);
    bot.on('message', function(data) {
        var user = data["user"];
        if (data["type"] == "message" && data["subtype"] != "bot_message") {
            var userObj = currentUsers[user];
            var userName = userObj['name'];// || fml_getName(user); 
            console.log("Message from " + userName + " : " + data["text"]);
            if (!userName) {
                console.log("User not yet tracked! Treating as new user.");
                initUser(user);
                userName = currentUsers[user]['name']; // Check if call to fml_getName succeeded
            }
            else {
                console.log("User status: " + JSON.stringify(currentUsers[user]));
                if (currentUsers[user]['done']) bot.postMessageToUser(currentUsers[user]['name'], PLACEHOLDER, params);
                else {
                    currentUsers[user]['started'] ? processInput(data["text"], user) : startQuestions(user);
                }
            }
        }
        else if (data["subtype"] == "bot_message") {
            console.log("I said " + data["text"]);
        }
        else if (data["type"] == "presence_change") {
            if (data["presence"] == "active") {
                var foundUser = (currentUsers[user] && currentUsers[user]['name']) || fml_getName(user);
                console.log("User " + foundUser + " is now available!");
                if (foundUser != BOTNAME) { // TO-DO : Modify to use ID instead of name
                    initUser(user);
                    bot.postMessageToUser(foundUser, "Welcome back " + foundUser + "!", params);
                }
            }
            else {
                console.log("Presence change: " + data["presence"]);
                resetStatus(user);
            }
        }
        else if (data["type"] == "team_join") {
            //var user = data["user"];
            console.log("Newly joined user is " + JSON.stringify(user));
            //resetStatus(user);
            initUser(user);
            var foundUser = user["name"];
            bot.postMessageToUser(foundUser, "Welcome " + foundUser + "!", params);
            users["_value"]["members"].push(user); // handle joins after server started
        }
        else {
            console.log("Other event type: " + data["type"]);
        }
    });

    bot.on('close', saveAll); //
});


// Called when a new user logs in, which will happen when they sign in with some ID and are redirected to wackie
function initUser(user) {
    var userName = fml_getName(user);
    console.log("Initializing user " + (userName || user) + "'s status");
    var newUserObj = {'state' : 0, 'responses': [], 'started' : false, 'done': false, 'name' : userName};
    currentUsers[user] = newUserObj;
    console.log("Wackie is now tracking user " + userName);
    console.log("User info: " + JSON.stringify(currentUsers[user]));
}

function resetStatus(user) {
    if (!currentUsers[user]) return initUser(user);
    currentUsers[user]['state'] = 0;
    currentUsers[user]['responses'] = [];
    currentUsers[user]['started'] = false;
    currentUsers[user]['done'] = false;
    currentUsers[user]['name'] = currentUsers[user]['name'] || fml_getName(user);
}


function startQuestions(user) {
    var userName = currentUsers[user]['name'];
    console.log("Starting workflow for user " + userName);
    currentUsers[user]['started'] = true;
    var firstQn = questionTexts[0];
    var firstSymptoms = handleSymptoms(symptoms, currentUsers, user, "");
    var greeting = "Great!\n";
    bot.postMessageToUser(userName, greeting + firstQn + "\n" + firstSymptoms, params);
}

function processInput(input, user) {
    var parsedInput = parseInt(input);
    var userState = currentUsers[user]['state'];
    var nextUserState;
    var userName = currentUsers[user]['name'] || fml_getName(user);

     // compute next state
    if (userState == LIST_SYMPTOMS_STATE) { // submit response for this set of symptoms and retrieve next symptoms to display
        var nextMessage = handleSymptoms(symptoms, currentUsers, user, input);
        if (nextMessage == "done") { // transition to next state dependent on whether or not user has symptoms
            if (currentUsers[user]["symptoms"]["has"].length == 0) { // no symptoms, go straight to qn 4 (state 3)
                nextUserState = OTHER_CONCERNS_STATE;
            }
            else { // has symptoms, go to qn 2 (state 1)
                nextUserState = DESCRIBE_SYMPTOMS_STATE;
            }
        }
        else { // more rounds of symptoms to come
            nextUserState = LIST_SYMPTOMS_STATE;
            // post next set of symptoms to user
            bot.postMessageToUser(userName, nextMessage, params);
            // done until user responds to next set of symptoms
            return;
        }   
    }

    else if (userState == DESCRIBE_SYMPTOMS_STATE) { // submit response for this follow-up qn and retrieve next follow-up qn to display

    }

    else if (userState == DESCRIBE_PAINS_STATE) {

    }

    else { // A state with Yes/No answers
    
   
        if (!isNaN(parsedInput) && parsedInput > 0 && parsedInput <= transitionMatrix[userState].length) {
            nextUserState = transitionMatrix[userState][input];
            console.log("Transitioning user " + userName + " to state " + nextUserState + " using input " + input);
            // record user's input
            nextUserState == 0 ? currentUsers[user]['responses'] = [] : currentUsers[user]['responses'].push(input);
        }
        else {
            console.log("Invalid input-state combination received: input " + input + " on state " + userState + "; treating as 0 for error-recovery");
            nextUserState = transitionMatrix[userState][0];
            // send user a friendly error message
            bot.postMessageToUser(userName, ERROR_MESSAGE, params);
        }
    }
    // update state of user in map
    currentUsers[user]['state'] = nextUserState;
    nextUserState == transitionMatrix.length ? showCompletion(user) : bot.postMessageToUser(userName, questionTexts[nextUserState], params);
}

// Called when a user is done
function showCompletion(user) {
    var userName = currentUsers[user]['name'];
    console.log("Wackie is done with user " + userName);
    bot.postMessageToUser(userName, "Thanks " + (userName || "") + "! You are all set! :)", params);
    currentUsers[user]['done'] = true;
    saveUserResponses(user);
}

// Transfer user's responses from process memory to persistent memory - own MongoDB/REDIS store or just Slack's own DB?
function saveUserResponses(user) {
    var userInfo = currentUsers[user];
    // Make DB call here
}


function saveAll() {
    console.log("Wackie getting ready to sleep!");
    // save currentChannel to REDIS or MongoDB, whichever preferred
    Object.keys(currentUsers).forEach(function(user) {
        saveUserResponses(user);
    });
    bot.postMessageToChannel('general', "Goodnight!", params);
}

function fml_getName(userID) {
    //var users = bot.getUsers();
    var members = users["_value"]["members"];
    for (var index = 0; index < members.length; index ++) {
        if (members[index]["id"] == userID) {
            console.log("Found user by ID! Name is " + members[index]["name"]);
            return members[index]["name"];
        }
    }
    console.log("Unable to find name by id!");
    return null;
}
