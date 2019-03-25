const recorder = require('watchtower-recorder');
const uuidv4 = require('uuid/v4');


const mock = {
    'dummy'     : {
	operation: () => {
	    console.log(`#####EVENTUPDATE[DUMMY_EVENT(${uuidv4()})]#####`);
	},
    },
};

module.exports.hello = recorder.createRecordingHandler('handler.js', 'hello' , mock);
