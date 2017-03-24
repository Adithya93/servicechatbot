var SlackBot = require('slackbots');
require('dotenv').config();
var handleSympts = require('./handleSymptoms.js');
//var handlePains = require('./handlePains.js');

console.log("handleSymptoms obj: " + JSON.stringify(handleSympts));
var listSymptoms = handleSympts.listSymptoms;
var handleSymptoms = handleSympts.handleSymptoms;
var handlePains = handleSympts.handlePains;

var TOKEN = process.env.TOKEN;
var BOTNAME = process.env.BOTNAME;

var NO = 1;
var YES = 2;

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
var stagePrompts;
var banter;

bot.on('infoLoaded', function(loadedInfo) {
    console.log("Yay! All info loaded!");
    info = loadedInfo;
    infoLoaded = true;
    questionTexts = info['qns'];
    symptoms = info["sympts"];
    stagePrompts = info["stagePrompts"];
    banter = info["banter"];
    bot.emit('start');
});

var getQuestions = require('./loadInfo.js')(bot, ["./questions.txt", "./symptoms.txt", "./stagePrompts", "./banter.txt"], ["qns", "sympts", "stagePrompts", "banter"], 'infoLoaded');
//var stage2 = require('./stage2.js')(bot);
var stage2 = require('./stage2.js');
console.log("Calling initStage2");
stage2.initStage2(bot);

/*
function testStage2(stage2) {
    var dummyObj = {};
    var testIndex = 1;
    console.log("About to test stage 2");
    while (testIndex <= stage2.NUM_SYMPTOMS) {
        console.log(stage2.test(dummyObj, testIndex));
        testIndex += stage2.BATCH_SIZE;
    }
}
*/

//testStage2(stage2);
//stage2.test();

var conditionsMet = 0;

var currentUsers = {}; // Upon starting, no currently active users

// GLOBAL ENCODING OF CONTROL FLOW AND LOGIC (MOORE FSM)
//var transitionMatrix = [[0, 1, 2], [1, 2, 3], [2, 3, 4], [3, 0, 4]];
var transitionMatrix = [[OTHER_CONCERNS_STATE, DESCRIBE_SYMPTOMS_STATE], [OTHER_CONCERNS_STATE, DESCRIBE_PAINS_STATE], [OTHER_CONCERNS_STATE], [OTHER_CONCERNS_STATE, PRIMARY_CONCERN_STATE, SPECIFY_CONCERN_STATE], [DESCRIBE_SYMPTOMS_STATE], [PRIMARY_CONCERN_STATE, COMPLETE_STATE]];

var ERROR_MESSAGE = "Sorry, that is not a valid answer. Please enter one of the numbers in the prompt.";
var PLACEHOLDER = "Alright, noted!";
var params = {
    icon_emoji: ':cat:'
};

var LIST_SYMPTOMS_STATE = 0;
var DESCRIBE_SYMPTOMS_STATE = 1;
var DESCRIBE_PAINS_STATE = 2;
var OTHER_CONCERNS_STATE = 3;
var SPECIFY_CONCERN_STATE = 4;
var PRIMARY_CONCERN_STATE = 5;
var COMPLETE_STATE = 6;

var users;


var NUM_STAGES = 5;

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
    var newUserObj = {'state' : 0, 'responses': [], 'started' : false, 'done': false, 'name' : userName, 'stage': 0};
    currentUsers[user] = newUserObj;
    console.log("Wackie is now tracking user " + userName);
    console.log("User info: " + JSON.stringify(currentUsers[user]));
}

function resetStatus(user) {
    if (!currentUsers[user]) return initUser(user);
    currentUsers[user]['state'] = 0;
    currentUsers[user]['stage'] = 0;
    currentUsers[user]['responses'] = [];
    currentUsers[user]['started'] = false;
    currentUsers[user]['done'] = false;
    currentUsers[user]['name'] = currentUsers[user]['name'] || fml_getName(user);
}


function startQuestions(user) {
    var userName = currentUsers[user]['name'];
    console.log("Starting workflow for user " + userName);
    currentUsers[user]['started'] = true;
    currentUsers[user]['stage'] = 1;
    var firstQn = questionTexts[0];
    //var firstSymptoms = handleSymptoms(symptoms, currentUsers, user, "");
    var firstSymptoms = listSymptoms(symptoms, currentUsers, user, "");
    var greeting = "Great! First, let's go through some common symptoms.\n";
    bot.postMessageToUser(userName, greeting + firstQn + "\n" + firstSymptoms, params);
}

function processInput(input, user) {
    var parsedInput = parseInt(input);
    var userState = currentUsers[user]['state'];
    var nextUserState;
    var userName = currentUsers[user]['name'] || fml_getName(user);

    if (currentUsers[user]['stage'] == 2) {
        var nextMessage = stage2.processFeatures(currentUsers, user, input);
        if (nextMessage == "done") { // transition to next stage
            showCompletion(user);
        }
        else { // continue with this stage
            bot.postMessageToUser(userName, nextMessage, params);
            return;
        }
    }

    if (currentUsers[user]['stage'] == 3) {

    }

    if (currentUsers[user]['stage'] == 4) {

    }

    if (currentUsers[user]['stage'] == 5) {

    }    


     // compute next state
    if (userState == LIST_SYMPTOMS_STATE) { // submit response for this set of symptoms and retrieve next symptoms to display
        //var nextMessage = handleSymptoms(symptoms, currentUsers, user, input);
        var nextMessage = listSymptoms(symptoms, currentUsers, user, input);
        if (nextMessage == "done") { // transition to next state dependent on whether or not user has symptoms
            if (currentUsers[user]["symptoms"]["has"].length == 0) { // no symptoms, go straight to qn 4 (state 3)
                nextUserState = OTHER_CONCERNS_STATE;
            }
            else { // has symptoms, go to qn 2 (state 1)
                nextUserState = DESCRIBE_SYMPTOMS_STATE;
                var firstDescribePrompt = handleSymptoms(currentUsers, user, "");
                nextMessage = questionTexts[nextUserState] + "\n" + firstDescribePrompt;
                currentUsers[user]['state'] = nextUserState;
                bot.postMessageToUser(userName, nextMessage, params);
                return;
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
        var nextMessage = handleSymptoms(currentUsers, user, input);
        if (nextMessage == "done") { // transition to next state dependent on whether user has pains
            if (currentUsers[user]["pains"]["has"].length == 0 || currentUsers[user]["other"]) { // no pains or just handled additional concern, go straight to qn 4 (state 3)
                nextUserState = OTHER_CONCERNS_STATE;
            }
            else { // has pains, go to qn 3 (state 2)
                nextUserState = DESCRIBE_PAINS_STATE;
                var firstPainPrompt = handlePains(currentUsers, user, "");
                console.log("First pain prompt is " + firstPainPrompt);
                nextMessage = questionTexts[nextUserState] + "\n" + firstPainPrompt;
                currentUsers[user]['state'] = nextUserState;
                bot.postMessageToUser(userName, nextMessage, params);
                return;
            }
        }
        else { // more rounds of symptom follow-up to come
            nextUserState = DESCRIBE_PAINS_STATE;
            // post next set of follow-ups to user
            bot.postMessageToUser(userName, nextMessage, params);
            // done until user responds to next set of follow-ups
            return;
        }
    }

    else if (userState == DESCRIBE_PAINS_STATE) {
        var nextMessage = handlePains(currentUsers, user, input);
        if (nextMessage == "done") { // transition to next state
            nextUserState = OTHER_CONCERNS_STATE;
        }
        else { // more rounds of describing pain to come
            nextUserState = DESCRIBE_PAINS_STATE;
            // post next description qn to user
            bot.postMessageToUser(userName, nextMessage, params);
            return;
        }
    }

    else if (userState == OTHER_CONCERNS_STATE) { // answer has to be either 1 for YES or 2 for NO
        if (!isNaN(parsedInput) && parsedInput > 0 && parsedInput < 3) {
            //nextUserState = parsedInput == YES ? SPECIFY_CONCERN_STATE : PRIMARY_CONCERN_STATE;
            if (parsedInput == YES) {
                nextUserState = SPECIFY_CONCERN_STATE;
            }
            else {
                nextUserState = PRIMARY_CONCERN_STATE;
                var nextMessage = getConcerns(user);
                currentUsers[user]['state'] = nextUserState;
                bot.postMessageToUser(userName, nextMessage, params);
                return;
            }
        }
        else {
            console.log("Invalid answer to whether there are concerns, treating as 0 for error-recovery");
            nextUserState = transitionMatrix[userState][0];
            // send user a friendly error message
            bot.postMessageToUser(userName, ERROR_MESSAGE, params);
        }
    }

    else if (userState == SPECIFY_CONCERN_STATE) { // push concern to list of concerns, set currentIndex to point there, and send to describe_symptoms_state
        currentUsers[user]["symptoms"]["has"].push(input);
        console.log("Pushed other concern " + parsedInput + " into user's concerns");
        var totalSympts = currentUsers[user]["symptoms"]["has"].length;
        currentUsers[user]["other"] = true; // so that bot goes straight back to OTHER_CONCERNS_STATE after follow-up qns for this concern
        currentUsers[user]["symptoms"]["currentIndex"] = totalSympts - 1;
        currentUsers[user]["symptoms"]["followUpIndex"] = 0;
        nextUserState = DESCRIBE_SYMPTOMS_STATE;
        var describePrompt = handleSymptoms(currentUsers, user, "");
        nextMessage = questionTexts[nextUserState] + "\n" + describePrompt;
        currentUsers[user]['state'] = nextUserState;
        bot.postMessageToUser(userName, nextMessage, params);
        return;
    }

    else if (userState == PRIMARY_CONCERN_STATE) { // record primary concern to user object
        var userConcerns = currentUsers[user]['symptoms']['has'];
        console.log(userName + "'s problems: " + JSON.stringify(userConcerns));
        if (!isNaN(parsedInput) && parsedInput > 0 && parsedInput <= userConcerns.length) { 
            currentUsers[user]['primaryConcern'] = userConcerns[parsedInput - 1]; // save to user object
            console.log("Set " + userName + "'s primary concern to be " + currentUsers[user]['primaryConcern']);
            //nextUserState = transitionMatrix[userState][1];
            nextUserState = COMPLETE_STATE;
            console.log("Set state to " + nextUserState);
        }
        else {
            console.log("Invalid choice of concern, treating as 0 for error-recovery");
            nextUserState = transitionMatrix[userState][0];
            // send user a friendly error message
            bot.postMessageToUser(userName, ERROR_MESSAGE, params);
        }
    }

    // update state of user in map
    currentUsers[user]['state'] = nextUserState;
    nextUserState == COMPLETE_STATE ? showCompletion(user) : bot.postMessageToUser(userName, questionTexts[nextUserState], params);
}

function getConcerns(user) {
    var concernsStr = "";
    var userConcerns = currentUsers[user]["symptoms"]["has"];
    userConcerns.forEach(function(cons, index) {
        concernsStr += (index + 1) +  " : " + cons + "\n";
    });
    console.log("Concerns string for user: " + concernsStr);
    nextMessage = questionTexts[PRIMARY_CONCERN_STATE] + "\n" + concernsStr;
    return nextMessage;
}

// Called when a user is done
function showCompletion(user) {
    var userName = currentUsers[user]['name'];
    console.log("Wackie is done with user " + userName + " for stage " + currentUsers[user]['stage']);
    
    if (currentUsers[user]['stage'] == NUM_STAGES) {
        console.log("User " + userName + " has completed all stages!");
        bot.postMessageToUser(userName, "Thanks " + (userName || "") + "! You are all set! :)", params);
        currentUsers[user]['done'] = true;
        saveUserResponses(user);
    }

    else {
        var message = "Congratulations " + (userName || "") + "! You are done with stage " + currentUsers[user]['stage'];
        //bot.postMessageToUser(userName, "Congratulations " + (userName || "") + "! You are done with stage " + currentUsers[user]['stage'], params);
        currentUsers[user]['stage'] += 1;
        console.log("Transitioning user to stage " + currentUsers[user]['stage']);
        message += "\n" + stagePrompts[currentUsers[user]['stage'] - 2];
        //bot.postMessageToUser(userName, stagePrompts[currentUsers[user]['stage'] - 2], params);
        bot.postMessageToUser(userName, message, params);
    }

}

/*
function addBanter(user, txt) {
    currentUsers[user]["banter"] = (currentUsers[user]["banter"] + 1) % banter.length
}
*/

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
