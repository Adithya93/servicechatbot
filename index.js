var SlackBot = require('slackbots');
require('dotenv').config();
var TOKEN = process.env.TOKEN;
var BOTNAME = process.env.BOTNAME;
console.log("Token: " + TOKEN);
console.log("Bot Name: " + BOTNAME);

// create a bot 
var bot = new SlackBot({
    token: TOKEN, // Add a bot https://my.slack.com/services/new/bot and put the token  
    name: BOTNAME
});

var state = 0;
var currentUsers = {}; // Upon starting, no currently active users

// GLOBAL ENCODING OF CONTROL FLOW AND LOGIC (MOORE FSM)
var transitionMatrix = [[0, 1, 2], [1, 2, 3], [2, 3, 4], [3, 0, 4]];

// TO-DO : REFACTOR INTO FILE-READING/ENV LOADING METHOD
var stateTexts = ["Answer all questions with the corresponding numbers. First question:\nHow old are you?\n1: Under 30\n2: Over 30\n", "Next question:\
\nAre you male or female?\n1: Male\n2:Female\n", "Next question:\nDo you have children?\n1: Yes\n2: No\n", "Would you like to start over?\n1: Yes\n2: No\n"];
var ERROR_MESSAGE = "Sorry, that is not a valid answer. Please enter one of the numbers in the prompt.";
var PLACEHOLDER = "Alright, noted!";
var params = {
    icon_emoji: ':cat:'
};

bot.on('start', function() {
    console.log("Wacky is up!");
    //console.log("Users info: " + JSON.stingify(im.list(TOKEN)));
                
            users = bot.getUsers(); // Will be updated to include users that join after bot has started-up
            //console.log(JSON.stringify(users));
            console.log("No. of users: " + users["_value"]["members"].length);
            console.log("Groups: " + JSON.stringify(bot.getGroups()));
            console.log("Channels: " + JSON.stringify(bot.getChannels()));
            // define channel, where bot exist. You can adjust it there https://my.slack.com/services  
            bot.postMessageToChannel('general', "I'm awake!", params);
            bot.on('message', function(data) {
                var user = data["user"];
                if (data["type"] == "message" && data["subtype"] != "bot_message") {
                    var userObj = currentUsers[user];
                    var userName = userObj['name'];// || fml_getName(user); 
                    console.log("Message from " + userName + " : " + data["text"]);
                    //console.log("Here's all the message info: " + JSON.stringify(data));
                    if (!userName) {
                        console.log("User not yet tracked! Treating as new user.");
                        initUser(user);
                        userName = currentUsers[user]['name']; // Check if call to fml_getname succeeded
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
                        //var user = data["user"];
                        //console.log("User " + user + " is now available!");
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
                    //resetStatus(user);
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
    currentUsers[user]['state'] = 0;
    currentUsers[user]['responses'] = [];
    currentUsers[user]['started'] = false;
    currentUsers[user]['done'] = false;
    currentUsers[user]['name'] = currentUsers[user]['name'] || fml_getName(user);
}


function startQuestions(user) {
    console.log("Starting workflow for user " + currentUsers[user]['name']);
    currentUsers[user]['started'] = true;
    bot.postMessageToUser(currentUsers[user]['name'], "Great! " + stateTexts[0], params);
}

function processInput(input, user) {
    var parsedInput = parseInt(input);
    var userState = currentUsers[user]['state'];
    var nextUserState;
    var userName = currentUsers[user]['name'] || fml_getname(user);
    // compute next state
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
    // update state of user in map
    currentUsers[user]['state'] = nextUserState;
    nextUserState == transitionMatrix.length ? showCompletion(user) : bot.postMessageToUser(userName, stateTexts[nextUserState], params);
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
