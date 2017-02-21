var BATCH_SIZE = 10;
var NUM_SYMPTOMS = 89;

var pains = ["Abdominal pain", "Chest pain", "Foot pain or ankle pain", "Hip pain", "Knee pain", "Low back pain", 
	"Low back pain", "Neck pain", "Pelvic pain", "Shoulder pain", "pain or burning with urination", 
	"burning or discharge from penis", "rectal pain"];

var painQns = ["Location?", "How severe on a scale of 1 to 10?", "What makes it worse?", "What makes it better?", "How often?", "Does it spread?", "What happens after the pain?"];

var followUpQns = ["When did it start?", "Did something happen that lead to it?", "Have you had the same problem before? (Enter 1 for No or 2 for Yes)\n1: NO\n2: YES", "When was the last time you had it?", "What happened that time?", "Did the treatment work?", "When was the VERY FIRST time you had this problem?"];

var NO = 1;
var YES = 2;
var BRANCH_QN_INDEX = 3;

var handleSymptoms = {
	/*
	pains: ["Abdominal pain", "Chest pain", "Foot pain or ankle pain", "Hip pain", "Knee pain", "Low back pain", 
	"Low back pain", "Neck pain", "Pelvic pain", "Shoulder pain", "pain or burning with urination", 
	"burning or discharge from penis", "rectal pain"],
	*/

	// List symptoms out 10 at a time, keeping track of which symptoms have been seen, and save them to user object
	listSymptoms: function(symptoms, users, userID, input) {
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
			userObj["pains"] = {};
			userObj["pains"]["has"] = [];
		}
		else {
			lastSeen = userSymptsObj["lastSeen"];
			userSympts = userSymptsObj["has"];
		}
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
					var unparsedSymptom = symptoms[parsedNum - 1];
					var parsedSymptom = unparsedSymptom.substring(unparsedSymptom.indexOf("\t") + 1, unparsedSymptom.length);
					userSympts.push(parsedSymptom);
					console.log("Added symptom " + parsedSymptom);
					if (pains.indexOf(parsedSymptom) > -1) {
						console.log("Pain detected: " + parsedSymptom);
						userObj["pains"]["has"].push(parsedSymptom);
					}
				}
				else {
					console.log("Ignoring illegal number " + num);
				}
			});
			// Save new symptoms and last seen to list
			userObj["symptoms"]["has"] = userSympts;
		}
		nextSympt = lastSeen + 1;
		console.log("Next symptom no. : " + nextSympt);
		nextLastSympt = Math.min(lastSeen + BATCH_SIZE, NUM_SYMPTOMS);
		console.log("Next last symptom no. : " + nextLastSympt)
		// Save back to map
		userObj["symptoms"]["lastSeen"] = nextLastSympt;
		users[userID] = userObj;
		if (lastSeen == NUM_SYMPTOMS) { // User has seen all symptoms, can progress to next state
			delete users[userID]["symptoms"]["lastSeen"];
			return "done"; // Bot will move to next question
		}
		// post next round of symptoms
		var symptString = "";
		for (var index = nextSympt - 1; index < nextLastSympt; index ++) {
			symptString += symptoms[index] + "\n";
		}	
		return symptString; // Bot will post this string to user
	},

	// LIST OF FOLLOW UP QNS
	//followUpQns : ["When did it start?", "Did something happen that lead to it?", "Have you had the same problem before?", "When was the last time you had it?", "What happened that time?", "Did the treatment work?", "When was the VERY FIRST time you had this problem?"],

	// Takes a userID, map of users, and an input (answer to that qn)
	handleSymptom: function(users, userID, symptom, index, input) {
		var userSyms = users[userID]["symptoms"];
		var symptInfo;
		if (index == 0) { // first follow-up qn for this specific symptom, input doesn't matter
			symptInfo = {};
		}
		else { // Process input as well
			symptInfo = userSyms[symptom];
			console.log("User's current symptom info for symptom " + symptom + " : " + symptInfo);
			symptInfo[followUpQns[index - 1]] = input;
		}
		// save back
		users[userID]["symptoms"][symptom] = symptInfo;
		if (index >= followUpQns.length) return "done"; // can proceed to next symptom
			
		if (index == BRANCH_QN_INDEX) {
			var parsedAns = parseInt(input);
			if (isNaN(parsedAns)) return "Invalid; Please enter 1 or 2\n" + symptom + " : " + followUpQns[index]; // repeat qn
			if (parsedAns == NO) {
				users[userID]["symptoms"][symptom] = "NO";
				return "done"; // can skip further qns
			}
			if (parsedAns == YES) users[userID]["symptoms"][symptom] = "YES";
			else return "Invalid; Please enter 1 or 2\n" + symptom + " : " + followUpQns[index]; // repeat qn
		}
		// Return string for next question
		return symptom + " : " + followUpQns[index];
	},

	handleSymptoms: function(users, userID, input) { // Need to keep track of current symptom and index
		// Retrieve symptoms object for this user
		var userSymptoms = users[userID]["symptoms"];
		var currentSymptomIndex;
		var currentSymptom;
		var followUpIndex;
		if (!userSymptoms.hasOwnProperty("currentIndex")) { // first symptom about to be processed
			console.log("About to start processing symptoms");
			currentSymptomIndex = 0;
			followUpIndex = 0;
		}
		else {
			currentSymptomIndex = userSymptoms["currentIndex"];
			followUpIndex = userSymptoms["followUpIndex"];
		}
		currentSymptom = userSymptoms["has"][currentSymptomIndex];
		var nextPrompt = handleSymptoms.handleSymptom(users, userID, currentSymptom, followUpIndex, input);
		// increment index if necessary, else return "done"
		if (nextPrompt.startsWith("Invalid")) { // invalid response to a yes or no (2 or 1) qn, repeat current qn, dont increment index
			users[userID]["symptoms"]["currentIndex"] = currentSymptomIndex;
			users[userID]["symptoms"]["followUpIndex"] = followUpIndex;
			return nextPrompt;
		}
		followUpIndex ++;
		if (nextPrompt == "done") {
			if (currentSymptomIndex >= userSymptoms["has"].length - 1) { // done with all symptoms
				console.log("Done with all symptoms!");
				delete users[userID]["symptoms"]["currentIndex"]; // Remove metadata
				delete users[userID]["symptoms"]["followUpIndex"];
				console.log("User's symptoms object is now: " + JSON.stringify(users[userID]["symptoms"]));
				return "done";
			}
			followUpIndex = 0;
			currentSymptomIndex ++;
			currentSymptom = userSymptoms["has"][currentSymptomIndex];
			nextPrompt = handleSymptoms.handleSymptom(users, userID, currentSymptom, followUpIndex, "");
			followUpIndex ++; // since the next qn was already asked
		}
		users[userID]["symptoms"]["currentIndex"] = currentSymptomIndex;
		users[userID]["symptoms"]["followUpIndex"] = followUpIndex;
		return nextPrompt;
	},

	//painQns: ["Location?", "How severe on a scale of 1 to 10?", "When did it start?", "What makes it worse?", "What makes it better?", "How often?", "Does it spread?", "What happens after the pain?"],

	handlePain: function(users, userID, pain, index, input) {
		var userPains = users[userID]["pains"];
		var painInfo;
		if (index == 0) { // first follow-up qn for this specific symptom, input doesn't matter
			painInfo = {};
		}
		else { // Process input as well
			painInfo = userPains[pain];
			console.log("User's current pain info for pain " + pain + " : " + painInfo);
			painInfo[painQns[index - 1]] = input;
		}
		// save back
		users[userID]["pains"][pain] = painInfo;
		if (index >= painQns.length) return "done"; // can proceed to next symptom
		// Return string for next question
		console.log("About to return string '" + pain + " : " + painQns[index] + "'");
		return pain + " : " + painQns[index];
	},

	handlePains: function(users, userID, input) {
		// Retrieve pains list for this user
		var userPains = users[userID]["pains"];
		var currentPainIndex;
		var currentPain;
		var followUpIndex;
		if (!userPains.hasOwnProperty("currentIndex")) { // first symptom about to be processed
			console.log("About to start processing pains");
			currentPainIndex = 0;
			followUpIndex = 0;
		}
		else {
			console.log("Back to process more pains");
			currentPainIndex = userPains["currentIndex"];
			followUpIndex = userPains["followUpIndex"];
		}
		currentPain = userPains["has"][currentPainIndex];
		var nextPrompt = handleSymptoms.handlePain(users, userID, currentPain, followUpIndex, input);
		// increment index if necessary, else return "done"
		followUpIndex ++;
		if (nextPrompt == "done") {
			if (currentPainIndex >= userPains["has"].length - 1) { // done with all symptoms
				console.log("Done with all pains!");
				delete users[userID]["pains"]["currentIndex"]; // Remove metadata
				delete users[userID]["pains"]["followUpIndex"];
				return "done";
			}
			followUpIndex = 0;
			currentPainIndex ++;
			currentPain = userPains["has"][currentPainIndex];
			nextPrompt = handleSymptoms.handlePain(users, userID, currentPain, followUpIndex, "");
			followUpIndex ++; // since the next qn was asked
		}
		users[userID]["pains"]["currentIndex"] = currentPainIndex;
		users[userID]["pains"]["followUpIndex"] = followUpIndex;
		return nextPrompt;
	}

}





module.exports = handleSymptoms; // TEMP - Replace by object which has both functions as fields, in JSON format


