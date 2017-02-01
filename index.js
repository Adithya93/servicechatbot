var SlackBot = require('slackbots');
 
// create a bot 
var bot = new SlackBot({
    token: 'xoxb-135870068519-NUwU5m8VkKb0K6ic7RnFeGkc', // Add a bot https://my.slack.com/services/new/bot and put the token  
    name: 'Wackie'
});

var state = 0;
var currentUser;
var currentChannel;
var started = false;
var done = false;

var transitionMatrix = [[0, 1, 2], [1, 2, 3], [2, 3, 4], [3, 0, 4]];
var stateTexts = ["Answer all questions with the corresponding numbers. First question:\nHow old are you?\n1: Under 30\n2: Over 30\n", "Next question:\
\nAre you male or female?\n1: Male\n2:Female\n", "Next question:\nDo you have children?\n1: Yes\n2: No\n", "Would you like to start over?\n1: Yes\n2: No\n"];
var validResponses = [];
var ERROR_MESSAGE = "Sorry, that is not a valid answer. Please enter one of the numbers in the prompt.";
var PLACEHOLDER = "Alright, noted!";
// more information about additional params https://api.slack.com/methods/chat.postMessage 
var params = {
    icon_emoji: ':cat:'
};

bot.on('start', function() {
    console.log("Wacky is up!");
    
    var users = bot.getUsers();
    var firstRealName = users["_value"]["members"].length > 0 ? users["_value"]["members"][0]["real_name"] : null;
    var firstUserName = users["_value"]["members"].length > 0 ? users["_value"]["members"][0]["name"] : null;
    if (firstRealName != null) {
        console.log("First user in this group: " + firstRealName);
    }
    if (firstUserName != null) {
        console.log("Username of current client: " + firstUserName);
        currentUser = firstUserName;
    }
    // define channel, where bot exist. You can adjust it there https://my.slack.com/services  
    bot.postMessageToChannel('general', 'yakshemesh!', params);
    
    // define existing username instead of 'user_name' 
    //bot.postMessageToUser('ra102', 'booyakasha!', params); 
    bot.postMessageToUser(firstUserName, "What's up " + (firstRealName || "friend") + "?", params);

    bot.on('message', function(data) {
        if (data["type"] == "message" && data["subtype"] != "bot_message") {
            currentChannel = currentChannel || data["channel"];
            console.log("Omg I got a message : " + data["text"]);
            if (done) bot.postMessageToUser(currentUser, PLACEHOLDER, params);
            else {
                //bot.postMessageToUser(firstUserName, data["text"], params);
                started ? processInput(data["text"]) : startQuestions();
            }
        }
        else if (data["subtype"] == "bot_message") {
            console.log("I said " + data["text"]);
        }
        else {
            console.log("Non-message event");
        }
    });
    
    // If you add a 'slackbot' property,  
    // you will post to another user's slackbot channel instead of a direct message 
    //bot.postMessageToUser('user_name', 'meow!', { 'slackbot': true, icon_emoji: ':cat:' }); 
    // define private group instead of 'private_group', where bot exist 
    //bot.postMessageToGroup('private_group', 'meow!', params); 

    bot.on('close', function() {
        saveChannel(); //
    });
});

function startQuestions() {
    started = true;
    bot.postMessageToUser(currentUser, "Great! " + stateTexts[0], params);
}

function processInput(input) {
    var parsedInput = parseInt(input);
    if (!isNaN(parsedInput) && parsedInput > 0 && parsedInput <= transitionMatrix[state].length) {
        state = transitionMatrix[state][input];
        console.log("Transitioning to state " + state + " using input " + input);
        state == 0 ? validResponses = [] : validResponses.push(input);
    }
    else {
        console.log("Invalid input received: " + input + "; treating as 0 for error-recovery");
        state = transitionMatrix[state][0];
        bot.postMessageToUser(currentUser, ERROR_MESSAGE, params);
    }

    state == transitionMatrix.length ? showCompletion() : bot.postMessageToUser(currentUser, stateTexts[state], params);
}

function showCompletion() {
    console.log("Wackie is done.");
    bot.postMessageToUser(currentUser, "Thanks! You are all set! :)", params);
    done = true;
}

function saveChannel() {
    console.log("User's valid responses: " + JSON.stringify(validResponses));
    // save currentChannel to REDIS or MongoDB, whichever preferred
}