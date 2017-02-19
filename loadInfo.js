var fs = require('fs');
var readline = require('readline');

var numFiles;
var allData = {};

function getData(listener, files, IDs) {
	numFiles = files.length;
	files.forEach(function(file, index) {
		getInfo(listener, file, IDs[index]);
	});
}

function getInfo(listener, file, ID) {
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
		//if (++done == numFiles)
		if (Object.keys(allData).length == numFiles) {
			listener.emit('infoLoaded', allData);
		}
	});
}

module.exports = getData;