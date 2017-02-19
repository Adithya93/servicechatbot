var BATCH_SIZE = 10;
var NUM_SYMPTOMS = 89;


// List symptoms out 10 at a time, keeping track of which symptoms have been seen, and save them to user object
function listSymptoms(symptoms, users, userID, input) {
	var userObj = users[userID];
	var userSymptsObj = userObj["symptoms"] || {};
	//console.log("User's symptoms object: " + JSON.stringify(userSymptsObj));
	var lastSeen;
	var userSympts;
	if (!userSymptsObj.hasOwnProperty("lastSeen")) {
		lastSeen = 0;
		userSymptsObj["lastSeen"] = lastSeen;
		userSympts = [];
		userSymptsObj["has"] = userSympts;
		userObj["symptoms"] = userSymptsObj;
	}
	else {
		lastSeen = userSymptsObj["lastSeen"];
		userSympts = userSymptsObj["has"];
	}
	/*
	//var lastSeen = (userSymptsObj && userSymptsObj["lastSeen"]) || 0;
	var lastSeen = userSymptsObj.hasOwnProperty("lastSeen") ? userSymptsObj["lastSeen"] : 0;
	//console.log("User's symptoms object: " + JSON.stringify(userSymptsObj));
	//var userSympts = (userSymptsObj && userSymptsObj["has"]) || [];
	var userSympts = userSymptsObj.hasOwnProperty("has") ? userSymptsObj["has"] : [];
	*/
	console.log("User's symptoms object: " + JSON.stringify(userSymptsObj));
	// process answer to previous round of symptoms
	var lastStart = (lastSeen == 0) ? 0 : (lastSeen == NUM_SYMPTOMS) ? lastSeen - (lastSeen % BATCH_SIZE) + 1 : lastSeen - BATCH_SIZE + 1;
	//var lastStart = (lastSeen == 0) ? 0 : lastSeen - BATCH_SIZE + 1;
	var inputNums = input.match(/\d+/g); // extract string into list of numbers
	var nextSympt;
	var nextLastSympt;
	if (lastSeen > 0 && inputNums && inputNums.length > 0) {
		console.log("List of numbers: " + JSON.stringify(inputNums));
		inputNums.forEach(function(num) {
			var parsedNum = parseInt(num);
			if (!isNaN(parsedNum) && (parsedNum <= lastSeen) && (parsedNum >= lastStart)) { // check if the number legally falls within previous range
				userSympts.push(symptoms[parsedNum - 1]);
				console.log("Added symptom " + symptoms[parsedNum - 1]);
			}
			else {
				console.log("Ignoring illegal number " + num);
			}
		});
		// Save new symptoms and last seen to list
		userObj["symptoms"]["has"] = userSympts;
	}
	/*
	else {
		userObj["symptoms"] = {};
		userObj["symptoms"]["has"] = [];
	}
	*/
	nextSympt = lastSeen + 1;
	console.log("Next symptom no. : " + nextSympt);
	nextLastSympt = Math.min(lastSeen + BATCH_SIZE, NUM_SYMPTOMS);
	console.log("Next last symptom no. : " + nextLastSympt)
	// Save back to map
	userObj["symptoms"]["lastSeen"] = nextLastSympt;
	users[userID] = userObj;
	if (lastSeen == NUM_SYMPTOMS) { // User has seen all symptoms, can progress to next state
		return "done"; // Bot will move to next question
	}
	// post next round of symptoms
	var symptString = "";
	for (var index = nextSympt - 1; index < nextLastSympt; index ++) {
		symptString += symptoms[index] + "\n";
	}	
	return symptString; // Bot will post this string to user
}




function handleSymptoms(symptoms) {



}





module.exports = listSymptoms; // TEMP - Replace by object which has both functions as fields, in JSON format


