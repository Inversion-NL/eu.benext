'use strict';

const path = require('path');
const ZwaveDriver = require('homey-zwavedriver');

// http://products.z-wavealliance.org/products/1979
// http://www.benext.eu/static/manual/tagreader500.pdf

// Plan: When user gives an unknown tag. Search for the tag code in the settings of the benext app
// When user is found, send the user ID back to the device
// If user is not found, add the user to the settings with a new ID and reply this to the device
// This way within Benext all the tags have the same ID, we can't add match it with the users in Homey (yet)
// But when this becomes available it's easily integrateble
// The same way is for custom codes added by the user
// On a setting page we can map the ID's we send out here to readable user names and use them in cards.

module.exports = new ZwaveDriver(path.basename(__dirname), {
	debug: true,
    capabilities: {
		'measure_battery': {
			'command_class'				: 'COMMAND_CLASS_BATTERY',
			'command_get'				: 'BATTERY_GET',
			'command_report'			: 'BATTERY_REPORT',
			'command_report_parser'		: function( report ) {
				if( report['Battery Level'] === "battery low warning" ) return 1;
				return report['Battery Level (Raw)'][0];
			}
		},
		'user_code_report': {
			'command_class'				: 'COMMAND_CLASS_USER_CODE',
			'command_report'			: 'USER_CODE_REPORT',
			'command_report_parser'		: function( report, node )
			{
				console.log(report);
				
				//var userIdentifier = report["User Identifier (Raw)"];
				var tagOrUserCode = report["USER_CODE"]; // It's a buffer (hex), and we store the buffer
				//var userIdStatus = report["User ID Status (Raw)"];
				
				// Tags are only allowed when the manual toggle is set to true and the system is not armed.
				var tagAllowed = getTagStatus() && !getSystemArmed();
				if(!tagAllowed)
				{
					console.log("You are not allowed to add tags. Either the manual toggle is set to off or your system is in armed status");
					return;
				}

				// When home is not armed, send a "USER_CODE_SET" back with a new/existing ID
				var tag = retrieveAndSetUserId(tagOrUserCode, node.instance);
				console.log(tag);
				if(tag === false)
				{
					console.log("Something went wrong! :(");
					return 0;
				}
				
				writeToLogFile(
					null,
					node.instance.token,
					tag.tagId,
					2, // tag added
					null,
					null
				);
				
				return tag.tagId;
			}
		},
		'alarm_report':
		{
			'command_class'				: 'COMMAND_CLASS_ALARM',
			'command_get'				: 'ALARM_GET',
			'command_get_parser'		: function ( report )
			{
				//console.log(report);
				//return 0;
			},
			'command_report'			: 'ALARM_REPORT',
			'command_report_parser'		: function( report, node)
			{
				console.log("report event recieved");
				console.log(report);
				console.log(node.device_data);
				
				var eventType = -1;
				var tagReaderTagId = report["Event Parameter"].toString('hex');
				var tagReaderTagIdInt = -1;
				
				try {
					tagReaderTagIdInt = parseInt(tagReaderTagId);
				} catch(e) { console.log("Cannot parse tag reader id to int"); }
				
				// Search for user with this tag id
				var userWithTagId = searchUser(tagReaderTagIdInt);
				console.log(userWithTagId);
				
				var tokens = {
								userId: userWithTagId !== null ? userWithTagId.id : -1,
								userName: userWithTagId !== null ? userWithTagId.name : "",
								tagId: tagReaderTagIdInt,
								deviceId: node.instance.token
							};
				var state = {};
				
				switch(report["ZWave Alarm Event"])
				{
					case 6: // Home
						eventType = 1;
						
						// Toggle event, "User X came home"
						Homey.manager('flow').triggerDevice('user_home', tokens, state, node.device_data, function(err, result) {
							if( err ){ console.log(err); return Homey.error(err); }
						});
						
						Homey.manager('flow').trigger('user_system_home', tokens, state, function(err, result) {
							if( err ){ console.log(err); return Homey.error(err); }
						});
						
					break;
					case 5: // Away
						eventType = 0;
						
						// Toggle event, "User X went away"
						Homey.manager('flow').triggerDevice('user_away', tokens, state, node.device_data, function(err, result) {
							if( err ){ console.log(err); return Homey.error(err); }
						});
						
						Homey.manager('flow').trigger('user_system_away', tokens, state, function(err, result) {
							if( err ){ console.log(err); return Homey.error(err); }
						});
						
					break;
				}
				
				if(userWithTagId !== null)
				{
					setStatusOfUser(userWithTagId, eventType);
				}
				
				writeToLogFile(
					userWithTagId !== null ? userWithTagId.id : null,
					node.instance.token,
					tagReaderTagIdInt,
					eventType,
					userWithTagId !== null ? userWithTagId.name : null,
					null
				);
				
				return 0;
			}
		}
		/*, 'my_gateway_control': {
			'command_class'				: 'COMMAND_CLASS_ENTRY_CONTROL',
			'command_class_get'			: 'ENTRY_CONTROL_NOTIFICATION',
			'command_get_parser'		: function( report )
			{
				console.log(report);
				
				var eventName = "none";
				switch(eventName)
				{
					case "ARM_HOME": // (0x06)
						// Announces home rfid/enter coming.
						// As gateway we can allow or deny this request.
							// Via a response: INDICATOR_SET ; ID: (0x06), value: (0x06) : allow
							// or via: INDICATOR_SET; ID: (0x04), value: 8 : deny
					break;
					case "ARM_AWAY": // (0x05)
						// Announces away rfid/enter coming.
						// As gateway we can allow or deny this request.
							// Via a response: INDICATOR_SET ; ID: (0x06), value: (0x06) : allow
							// or via: INDICATOR_SET; ID: (0x04), value: 8 : deny
					break;
					case "RFID": // (0x0D)
						// Contains a RFID tag in event data.
					break;
					case "ENTER":  // (0x0D)
						// Contains array of numbers in event data.
					break;
					case "CACHING":  // (0x00)
						// Announces a manual code is coming our way.
					break;
					case "CACHED_KEYS": // (0x01)
						// event data contains array of numbers (toggle scene)
					break;
				}
			},
			'command_report'			: 'ENTRY_CONTROL_GET'
		}*/
    },
    settings: {
		"set_to_default" : {
			"index": 0,
			"size": 1
		},
		"feedback_time" : {
			"index": 1,
			"size": 1
		},
		"feedback_timeout" : {
			"index": 2,
			"size": 1
		},
		"feedback_beeps_per_second" : {
			"index": 3,
			"size": 1
		},
		"always_awake_mode" : {
			"index": 4,
			"size": 1
		},
		"operation_mode" : {
			"index": 6,
			"size": 1
		},
		"gateway_confirmation" : {
			"index": 7,
			"size": 1
		}
    }
});

// This is only available in Gateway mode and that isn't supported by Homey yet
// Can be implemented when class COMMAND_CLASS_ENTRY_CONTROL . ENTRY_CONTROL_NOTIFICATION is supported
// Homey.manager('flow').on('trigger.system_scene', function( callback, args ){
	// Homey.log('');
	// Homey.log('on flow trigger.system_scene');
	// Homey.log('args', args);
	
	// callback( null, true ); // we've fired successfully
// });

Homey.manager('flow').on('condition.is_at_home', function( callback, args ) {
	Homey.log('');
	Homey.log('on flow condition.is_at_home');
	Homey.log('args', args);
	
	console.log(args);
		
	// Get the status of the requested user
	var user = searchUserByUserId(args.person.id);
	if(user !== null && typeof user.statusCode !== 'undefined')
	{
		if(user.statusCode === 1 || user.statusCode === 0)
		{
			return callback( null, user.statusCode === 1 ); // we've fired successfully
		}
		
		var message = __('flow.condition.unknownUserStatus');
		return callback( new Error( message )); // user not found.
	}
	
	var message = __('flow.condition.userNotFound');
	return callback( new Error( message )); // user not found.
});

Homey.manager('flow').on('action.toggle_person_home', function( callback, args ) {
	Homey.log('');
	Homey.log('on flow action.toggle_person_home');
	Homey.log('args', args);
	
	// Set status of user to home
	setStatusOfUser(args.person, 1);

	callback( null, true ); // we've fired successfully
});

Homey.manager('flow').on('action.toggle_person_away', function( callback, args ) {
	Homey.log('');
	Homey.log('on flow action.toggle_person_away');
	Homey.log('args', args);

	// Set status of user to away
	setStatusOfUser(args.person, 0);
	
	callback( null, true ); // we've fired successfully
});

// Autocomplete events
Homey.manager('flow').on('action.toggle_person_home.person.autocomplete', function( callback, args ) {
	var myItems = autocompleteUser(args.query);
    callback( null, myItems ); // err, results
});

Homey.manager('flow').on('action.toggle_person_away.person.autocomplete', function( callback, args ) {
	var myItems = autocompleteUser(args.query);
    callback( null, myItems ); // err, results
});

Homey.manager('flow').on('condition.is_at_home.person.autocomplete', function( callback, args ) {
	var myItems = autocompleteUser(args.query);
    callback( null, myItems ); // err, results
});

// var tagContainer = [ ]; // contains objects: { "tagId": 0, "tagValue": "", "createdOn": "", "tagType": null };
// tagType can be null (unknown, when not in gateway mode), 0 == RFID, or 1 == Code
function getTagContainer()
{
	return Homey.manager('settings').get('tagContainer');
}

function setTagContainer(value)
{
	Homey.manager('settings').set('tagContainer', value);
}

//var userContainer = [ ]; // contains objects: { "name": "bla", "id": -1, "statusCode": 0 (0 = away, 1 = home), "tagIds": { 1, 3 } };
function getUserContainer()
{
	return Homey.manager('settings').get('userContainer');
}

function setUserContainer(value)
{
	Homey.manager('settings').set('userContainer', value);
}

function getSystemArmed()
{
	return Homey.manager('settings').get('systemArmed') === true;
}

function setSystemArmed(value)
{
	if(value === false || value === 0) {
		value = false;
	} else {
		value = true;
	}
	
	Homey.manager('settings').set('systemArmed', value);
}

function getTagStatus()
{
	return Homey.manager('settings').get('tagStatus') === true;
}

function setTagStatus(value) // value needs to be true or false
{
	if(value === false || value === 0) {
		value = false;
	} else {
		value = true;
	}
	
	Homey.manager('settings').set('tagStatus', value);
}

/**
* Writes entry to log file for EU Benext
* statusCodes: 0 = away, 1 = home, 2 = tag added, 3 = Scene Started
*/
function writeToLogFile(userId, deviceId, tagId, statusCode, userName, deviceName)
{
	var logEntry =
	{
		"time": new Date(),
		"userId": userId,
		"tagId": tagId,
		"statusCode": statusCode, // 0 = away, 1 = home, 2 = tag added, 3 = Scene Started, -1 = unknown
		"userName": userName,
		"deviceName": deviceName,
		"deviceId": deviceId
	};
	
	var log = Homey.manager('settings').get('systemEventLog');
	if(typeof log === 'undefined' || log === null)
	{
		log = [];
	}
	
	if (typeof log.push === "undefined") { 
		log = [];
	}
	
	log.push(logEntry);
	console.log("Just logged entry:");
	console.log(logEntry);
	Homey.manager('settings').set('systemEventLog', log);
}

function autocompleteUser(filterValue)
{
	var myItems = getUserContainer();
	
	if(typeof myItems === 'undefined' || myItems === null)
	{
		myItems = [];
	}
	
    // filter items to match the search query
    myItems = myItems.filter(function(item) {
    	return ( item.name.toLowerCase().indexOf( filterValue.toLowerCase() ) > -1 )
    });
	
	return myItems;
}

/**
* Retrieves user ID from the homey settings.
* Sends ID confirmation if tagcode couldn't be found in the homey settings.
*/
function retrieveAndSetUserId(tagCode, node)
{
	// Check if tagCode already exists
	var matchedTag = searchTag(getTagContainer(), tagCode);
	
	// Create new unique tag ID if tag doesn't exist
	if(matchedTag === null)
	{
		matchedTag = addTag(tagCode);
	}
	
	// Matched tag still null?
	if(matchedTag === null)
	{
		console.log("Tag couldn't be added.");
		return false;
	}
	
	console.log(matchedTag);
	
	// Send USER_CODE_SET to device with the new/existing unique tag ID
	sendUserIdSetConfirmation(matchedTag, node);
	
	return matchedTag;
}

/**
* Sends the tag ID to the device
*/
function sendUserIdSetConfirmation(tag,  node)
{
	node.CommandClass.COMMAND_CLASS_USER_CODE.USER_CODE_SET({
			"User Identifier": tag.tagId,
			"User ID Status": Buffer.from('01', 'hex'),
			"USER_CODE": tag.tagValue
		},
		function( err, result )
		{
			if( err ) { return console.error( err ); }
		}
	);
}

/**
* Returns the tag for the value searched.
*/
function searchTag(tags, matchValue)
{
	var match = null;
	if(typeof tags === 'undefined' || tags === null)
	{
		return null;
	}
	
	for(var i = 0; i < tags.length; i++) {
		if(tags[i].tagValue === matchValue)
		{
			console.log("match found");
			console.log(tags[i]);
			match = tags[i];
			i = 100;
		}
	}
	
	return match;
}

/**
* Finds the user belonging to the tagId.
*/
function searchUser(tagId)
{
	var users = getUserContainer();
	if(typeof users === 'undefined' || users === null || typeof users !== 'object')
	{
		return null;
	}
	
	for(var i = 0; i < users.length; i++) {
		var match = users[i].tagIds.indexOf(tagId);
		if(match > -1)
		{
			console.log("match found id");
			console.log(users[i]);
			return users[i];
		}
	}
	
	return null;
}

/**
* Finds the user based on user id.
*/
function searchUserByUserId(userId)
{
	var users = getUserContainer();
	if(typeof users === 'undefined' || users === null || typeof users !== 'object')
	{
		return null;
	}
	
	for(var i = 0; i < users.length; i++) {
		if(users[i].id === userId)
		{
			console.log("match found id");
			console.log(users[i]);
			return users[i];
		}
	}
	
	return null;
}

function setStatusOfUser(user, statusCode)
{
	var users = getUserContainer();
	if(typeof users === 'undefined' || users === null || typeof users !== 'object')
	{
		return null;
	}
	
	for(var i = 0; i < users.length; i++) {
		if(users[i].id === user.id)
		{
			users[i].statusCode = (statusCode === 0 ? 0 : 1);
		}
	}
	
	setUserContainer(users);
}

/**
* Adds a tag to the tag ID and returns the tag value.
*/
function addTag(tagCode)
{
	var tags = getTagContainer();
	
	if(typeof tags === 'undefined' || tags == null)
	{
		console.log("Tags not set, new tag list initiated.");
		tags = new Array();
	}
	
	if(typeof tags !== "object")
	{
		tags = new Array();
	}
	
	// Fallback to search for tags if someone is to stupid to not search for the tag himself
	var existingTag = searchTag(tags, tagCode);
	if(existingTag !== null)
	{
		return existingTag;
	}
	
	var highestId = 0;
	for(var i = 0; i < tags.length; i++) {
		if(tags[i].tagId > highestId)
		{
			highestId = tags[i].tagId;
		}
	}
	
	var tag = { "tagId": (highestId+1), "tagValue": tagCode, "createdOn": new Date(), "tagType": null };
	tags.push(tag);
	setTagContainer(tags);
	return tag;
}