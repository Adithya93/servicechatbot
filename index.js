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
                if (data["type"] == "message" && data["subtype"] != "bot_message") {
                    var user = data["user"];
                    var userObj = currentUsers[user];
                    var userName = userObj['name'];// || fml_getName(user); 
                    console.log("Message from " + userName + " : " + data["text"]);
                    /*
                    if (done) bot.postMessageToUser(currentUser, PLACEHOLDER, params);
                    else {
                        //bot.postMessageToUser(firstUserName, data["text"], params);
                        started ? processInput(data["text"]) : startQuestions();
                    }
                    */
                    //console.log("Here's all the message info: " + JSON.stringify(data));
                    if (!userName) {
                        console.log("User not yet tracked! Treating as new user.");
                        initUser(user);
                        userName = currentUsers[user]['name']; // Check if call to fml_getname succeeded
                    }
                    else {
                        if (currentUsers[user]['done']) bot.postMessageToUser(user, PLACEHOLDER, params);
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
                        var user = data["user"];
                        console.log("User " + user + " is now available!");
                        var foundUser = fml_getName(user);
                        if (foundUser != BOTNAME) {
                            console.log("Resetting user " + foundUser + "'s status");
                            bot.postMessageToUser(foundUser, "Welcome back " + foundUser + "!", params);
                        }
                    }
                    else {
                        console.log("Presence change: " + data["presence"]);
                    }
                    resetStatus(user);
                }
                else if (data["type"] == "team_join") {
                    var user = data["user"];
                    console.log("Newly joined user is " + JSON.stringify(user));
                    resetStatus(user);
                    var foundUser = user["name"];
                    bot.postMessageToUser(foundUser, "Welcome " + foundUser + "!", params);
                    users["_value"]["members"].push(user); // handle joins after server started
                }
                else {
                    console.log("Other event type: " + data["type"]);
                }
            });

    //});    
    // If you add a 'slackbot' property,  
    // you will post to another user's slackbot channel instead of a direct message 
    //bot.postMessageToUser('user_name', 'meow!', { 'slackbot': true, icon_emoji: ':cat:' }); 
    // define private group instead of 'private_group', where bot exist 
    //bot.postMessageToGroup('private_group', 'meow!', params); 

    bot.on('close', saveAll); //
});


// Called when a new user logs in, which will happen when they sign in with some ID and are redirected to wackie
function initUser(user) {
    var newUserObj = {'state' : 0, 'responses': [], 'started' : false, 'done': false, 'name' : fml_getName(user) || 'friend'};
    currentUsers[user] = newUserObj;
    console.log("Wackie is now tracking user " + fml_getName(user));
}

function resetStatus(user) {
    currentUsers[user]['state'] = 0;
    currentUsers[user]['started'] = false;
    currentUsers[user]['done'] = false;
}


function startQuestions(user) {
    currentUsers[user]['started'] = true;
    bot.postMessageToUser(user, "Great! " + stateTexts[0], params);
}

function processInput(input, user) {
    var parsedInput = parseInt(input);
    var userState = currentUsers[user]['state'];
    var nextUserState;
    var userName = currentUsers[user]['name'] || fml_getname(user);
    // compute next state
    if (!isNaN(parsedInput) && parsedInput > 0 && parsedInput <= transitionMatrix[userState].length) {
        nextUserState = transitionMatrix[userState][input];
        console.log("Transitioning user " + userName + " to state " + currentUsers[user]['state'] + " using input " + input);
        // record user's input
        nextUserState == 0 ? currentUsers[user]['responses'] = []; currentUsers[user]['responses'].push(input);
    }
    else {
        console.log("Invalid input-state combination received: input " + input + " on state " + userState + "; treating as 0 for error-recovery");
        nextUserState = transitionMatrix[userState][0];
        // send user a friendly error message
        bot.postMessageToUser(user, ERROR_MESSAGE, params);
    }
    // update state of user in map
    currentUsers[user]['state'] = nextUserState;
    nextUserState == transitionMatrix.length ? showCompletion(user) : bot.postMessageToUser(user, stateTexts[state], params);
}

// Called when a user is done
function showCompletion(user) {
    console.log("Wackie is done with user " + currentUsers[user]['name']);
    bot.postMessageToUser(user, "Thanks " + (currentUsers[user]['name'] || "") + "! You are all set! :)", params);
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
