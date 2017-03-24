var fs = require('fs');
var readline = require('readline');

function getData(listener, files, IDs, emitEvent) {
	var numFiles = files.length;
	var allData = {};
	files.forEach(function(file, index) {
		getInfo(listener, file, IDs[index], allData, numFiles, emitEvent);
	});
}

function getInfo(listener, file, ID, allData, numFiles, emitEvent) {
	var infoStream = fs.createReadStream(file);
	console.log("Stream now available for file " + file);
	var rl = readline.createInterface({
		input: infoStream
	});
	var infoArray = [];
	rl.on('line', function(input) {
		console.log("Info: " + input);
		infoArray.push(input);
	});
	rl.on('close', function() {
		console.log("Done reading file " + file);
		allData[ID] = infoArray;
		if (Object.keys(allData).length == numFiles) {
			console.log("Emitting event " + emitEvent);
			listener.emit(emitEvent, allData); // note : will not emit if there are any duplicate filenames in files
		}
	});
}

module.exports = getData;