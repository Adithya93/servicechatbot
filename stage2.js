var BATCH_SIZE = 10;
var NUM_SYMPTOMS;
var symptoms = [];
var headers = {};
var HEADER_TOKEN = "<";

var stage2 = {

	initStage2 : function(listener) {
		// Register event-handler
		listener.on('stage2_infoLoaded', function(stage2Info) {
			console.log("BOOYAKASHA STAGE 2 INFO LOADED");
			console.log(JSON.stringify(stage2Info));
			//symptoms = stage2Info["features"];
			//NUM_SYMPTOMS = symptoms.length;
			//console.log("Set num sympts to " + NUM_SYMPTOMS);
			stage2Info["features"].forEach(function(sym, index) {
				if (sym.startsWith(HEADER_TOKEN)) {
					// a header
					headers[symptoms.length] = sym.match(/[a-zA-Z]+/)[0].toUpperCase();
				}
				else {
					symptoms.push(sym); // actual symptom
				}
			});
			NUM_SYMPTOMS = symptoms.length;
			console.log("Set num sympts to " + NUM_SYMPTOMS);
			stage2.test();
		});
		this.loadStage2Info(listener); // load file asynchronously
	},

	loadStage2Info : function(listener) {
		require('./loadInfo.js')(listener, ["./stage2_features.txt"], ["features"], 'stage2_infoLoaded');
	},

	processFeatures : function(users, userID, input) {
		var userObj = users[userID];
		var userStage2 = userObj["review"] || {};
		var lastSeen;
		var userSympts;
		var symptString = "";
		if (!userStage2.hasOwnProperty("lastSeen")) {
			lastSeen = 0;
			userStage2["lastSeen"] = lastSeen;
			userSympts = [];
			userStage2["has"] = userSympts;
			userObj["review"] = userStage2;
			symptString += "For each of the following symptoms, enter its corresponding number if you are experiencing it.\n";
		}
		else {
			lastSeen = userStage2["lastSeen"];
			userSympts = userStage2["has"];
		}
		console.log("User's stage 2 symptoms object: " + JSON.stringify(userStage2));
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
				}
				else {
					console.log("Ignoring illegal number " + num);
				}
			});
			// Save new symptoms and last seen to list
			userObj["review"]["has"] = userSympts;
		}
		nextSympt = lastSeen + 1;
		console.log("Next symptom no. : " + nextSympt);
		nextLastSympt = Math.min(lastSeen + BATCH_SIZE, NUM_SYMPTOMS);
		console.log("Next last symptom no. : " + nextLastSympt)
		// Save back to map
		userObj["review"]["lastSeen"] = nextLastSympt;
		users[userID] = userObj;
		if (lastSeen == NUM_SYMPTOMS) { // User has seen all symptoms, can progress to next state
			delete users[userID]["review"]["lastSeen"];
			return "done"; // Bot will move to next question
		}
		// post next round of symptoms IF not already flagged
		//var symptString = "";
		for (var index = nextSympt - 1; index < nextLastSympt; index ++) {
			if (index in headers) {
				symptString += headers[index] + "\n";
			}
			if (userObj["symptoms"]["has"].indexOf(symptoms[index]) == -1) {
				symptString += (index + 1) + ". " + symptoms[index] + "\n";
			}
			else {
				console.log("SKIPPING "  + symptoms[index]);
			}
		}	
		return symptString; // Bot will post this string to user
	},

	test : function() {
		var users = {"a" : {"symptoms" : {"has": "chest pain"}}};
		var userID = "a";
	    var testIndex = -1;
	    console.log("About to test stage 2");
	    console.log("No. of symptoms: " + NUM_SYMPTOMS);
	    console.log("Batch Size: " + BATCH_SIZE);
	    while (testIndex <= NUM_SYMPTOMS + BATCH_SIZE) {
	        console.log(this.processFeatures(users, userID, "" + testIndex));
	        testIndex += BATCH_SIZE;
	    }
		console.log("Done testing stage2, user object is : ");
		console.log(JSON.stringify(users[userID]));
	}


};

module.exports = stage2;