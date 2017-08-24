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

const eventsRecieved = new Array();
const eventIdsRecieved = new Array();

module.exports = new ZwaveDriver(path.basename(__dirname), {
	capabilities: {
		measure_battery: {
			command_class: 'COMMAND_CLASS_BATTERY',
			command_get: 'BATTERY_GET',
			command_report: 'BATTERY_REPORT',
			command_report_parser(report) {
				if (report['Battery Level'] === 'battery low warning') return 1;
				return report['Battery Level (Raw)'][0];
			},
		},
		user_code_report: {
			command_class: 'COMMAND_CLASS_USER_CODE',
			command_report: 'USER_CODE_REPORT',
			command_report_parser(report, node)            {
				console.log(report);
				setDeviceReport(node.instance.token, 'BASIC');

				// var userIdentifier = report["User Identifier (Raw)"];
				const tagOrUserCode = report.USER_CODE.toString('hex'); // It's a buffer (hex), and we store the translated value
				// var userIdStatus = report["User ID Status (Raw)"];

				// Tags are only allowed when the manual toggle is set to true and the system is not armed.
				const tagAllowed = getTagStatus() && !getSystemArmed();
				if (!tagAllowed) {
					console.log('You are not allowed to add tags. Either the manual toggle is set to off or your system is in armed status');
					return;
				}

				// When home is not armed, send a "USER_CODE_SET" back with a new/existing ID
				const tag = retrieveAndSetUserId(tagOrUserCode, node.instance, -1); // -1 because we don't know if it is a tag or not.
				console.log(tag);
				if (tag === false) {
					console.log('Something went wrong! :(');
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
			},
		},
		alarm_report: {
			command_class: 'COMMAND_CLASS_ALARM',
			command_get: 'ALARM_GET',
			command_get_parser(report)            {
				// console.log(report);
				// return 0;
			},
			command_report: 'ALARM_REPORT',
			command_report_parser(report, node)            {
				console.log('report event recieved');
				console.log(report);
				console.log(node.device_data);
				setDeviceReport(node.instance.token, 'BASIC');

				let eventType = -1;
				const tagReaderTagId = report['Event Parameter'].toString('hex'); // Tag reader sends us a tag ID we provided it earlier.
				const tokens = searchUserBelongingToTagId(tagReaderTagId, node);
				const state = {};

				switch (report['ZWave Alarm Event']) {
					case 6: // Home
						eventType = 1;

						// Toggle event, "User X came home"
						Homey.manager('flow').triggerDevice('user_home', tokens, state, node.device_data, (err, result) => {
							if (err) {
								console.log(err);
								return Homey.error(err);
							}
						});

						Homey.manager('flow').trigger('user_system_home', tokens, state, (err, result) => {
							if (err) {
								console.log(err);
								return Homey.error(err);
							}
						});

						break;
					case 5: // Away
						eventType = 0;

						// Toggle event, "User X went away"
						Homey.manager('flow').triggerDevice('user_away', tokens, state, node.device_data, (err, result) => {
							if (err) {
								console.log(err);
								return Homey.error(err);
							}
						});

						Homey.manager('flow').trigger('user_system_away', tokens, state, (err, result) => {
							if (err) {
								console.log(err);
								return Homey.error(err);
							}
						});

						break;
				}

				if (tokens !== null) {
					setStatusOfUser(tokens, eventType);
				}

				writeToLogFile(
					tokens !== null ? tokens.userId : null,
					node.instance.token,
					tokens !== null ? tokens.tagId : tagReaderTagId,
					eventType,
					tokens !== null ? tokens.userName : null,
					null
				);

				return 0;
			},
		}, my_gateway_control: {
			command_class: 'COMMAND_CLASS_ENTRY_CONTROL',
			command_report: 'ENTRY_CONTROL_NOTIFICATION',
			command_report_parser(report, node)            {
				eventsRecieved.push(report);
				eventIdsRecieved.push(report['Sequence Number']);
				// console.log(node.device_data);
				// console.log(report);

				setDeviceReport(node.instance.token, 'GATEWAY');

				const eventName = report['Event Type'];
				switch (eventName) {
					case 'ARM_HOME': // (0x06)
						// Announces home rfid/enter coming.
						// As gateway we can allow or deny this request.
						// Via a response: INDICATOR_SET ; ID: (0x06), value: (0x06) : allow
						// or via: INDICATOR_SET; ID: (0x04), value: 8 : deny
						return sendGatewayApprovalDisaproval(node.instance, 1, true, true);
						break;
					case 'ARM_AWAY': // (0x05)
						// Announces away rfid/enter coming.
						// As gateway we can allow or deny this request.
						// Via a response: INDICATOR_SET ; ID: (0x06), value: (0x06) : allow
						// or via: INDICATOR_SET; ID: (0x04), value: 8 : deny
						return sendGatewayApprovalDisaproval(node.instance, 0, true, true);
						break;
					case 'ARM_6': // (0x0D)
					case 'ENTER':
						// Contains a RFID tag in event data.
						// Contains array of numbers in event data.

						// Check previous event to see if we have to arm home or away
						var indexPreviousEvent = eventIdsRecieved.indexOf(report['Sequence Number'] - 1);
						var previousEvent = eventsRecieved[indexPreviousEvent];
						if (typeof previousEvent !== 'undefined' 
								&& typeof previousEvent['Event Type'] !== 'undefined'
								&& typeof report['Event Data'] !== 'undefined')
						{
							const eventType = previousEvent['Event Type'] === 'ARM_HOME' ? 1 : 0; // 1 = home, 0 = away
							const tagType = eventName === 'ARM_6' ? 0 : 1; // 0 = tag, 1 = user code
							const tagData = tagType === 1 ? report['Event Data'].toString('ascii') : report['Event Data'].toString('hex');

							// Now we have to find the tag in our list and user belonging to this tag.
							const identifiedTag = searchTag(getTagContainer(), tagData);

							// We didn't find a tag, are we allowed to add this tag to the system?
							// Please note that this can also happen when an unknown user is trying to get access to the home!
							if (identifiedTag === null) {
								const tagAllowed = getTagStatus() && !getSystemArmed();
								if (!tagAllowed) {
									console.log('You are not allowed to add tags. Either the manual toggle is set to off or your system is in armed status.');
									console.log('Possibly an unauthorized person is trying to get access to your system.');

									// Send error beeps?? Throw event??
									// TODO: Send red light and error bleep to device (thrice == tag adding / recognition failed)

									return;
								}

								// Well, we are allowed to add a tag, so let's add the tag!
								const tag = addTag(tagData, tagType); // -1 because we don't know if it is a tag or not.
								console.log(tag);
								if (tag === false) {
									console.log('Something went wrong! :(');
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

								// TODO: Send green light and bleep to device (thrice == tag added)

								return;
							}

							// Now we have to set the tokens to toggle the events
							var tokens = searchUserBelongingToTagId(identifiedTag.tagId, node);
							var state = {};

							// All went well, tag is identified and we possibly even found a matching user. Let's trigger the right triggers!
							switch (eventType) {
								case 1: // Home
									// Toggle event, "User X came home"
									Homey.manager('flow').triggerDevice('user_home', tokens, state, node.device_data, (err, result) => {
										if (err) {
											console.log(err);
											return Homey.error(err);
										}
									});

									Homey.manager('flow').trigger('user_system_home', tokens, state, (err, result) => {
										if (err) {
											console.log(err);
											return Homey.error(err);
										}
									});


									sendLedFeedback(node.instance, 1, true);
									break;
								case 0: // Away
									// Toggle event, "User X went away"
									Homey.manager('flow').triggerDevice('user_away', tokens, state, node.device_data, (err, result) => {
										if (err) {
											console.log(err);
											return Homey.error(err);
										}
									});

									Homey.manager('flow').trigger('user_system_away', tokens, state, (err, result) => {
										if (err) {
											console.log(err);
											return Homey.error(err);
										}
									});

									sendLedFeedback(node.instance, 0, true);
									break;
							}

							// Set status of user to home/away.
							if (tokens !== null) {
								setStatusOfUser(tokens, eventType);
							}

							// Write incoming event to log file.
							writeToLogFile(
								tokens !== null ? tokens.userId : null,
								node.instance.token,
								identifiedTag.tagId,
								eventType,
								tokens !== null ? tokens.userName : null,
								null
							);

							// TODO: Send green light and bleep to device (twice == armed, once == disarmed)
						} else {
							// TODO: Send red light and bleep error to device.
						}
						break;
					case 'CACHING':  // (0x00)
						// Announces a manual code is coming our way.
						// Cool, do nothing yet
						break;
					case 'CACHED_KEYS': // (0x01)
						// event data contains array of numbers (toggle scene)
						var sceneId = report['Event Data'].toString('ascii');
						console.log('Scene triggered');
						console.log(sceneId);

						// Now we have to set the tokens to toggle the events
						var tokens = { sceneId: parseInt(sceneId) };
						var state = {};

						Homey.manager('flow').triggerDevice('start_scene', tokens, state, node.device_data, (err, result) => {
							if (err) {
								console.log(err);
								return Homey.error(err);
							}
						});

						writeToLogFile(
							null,
							node.instance.token,
							parseInt(sceneId),
							3,
							null,
							null
						);
						break;
				}
			},
		},
	},
	settings: {
		set_to_default: {
			index: 1,
			size: 1,
			signed: false,
		},
		feedback_time: {
			index: 2,
			size: 1,
			signed: false,
		},
		feedback_timeout: {
			index: 3,
			size: 1,
			signed: false,
		},
		feedback_beeps_per_second: {
			index: 4,
			size: 1,
			signed: false,
		},
		always_awake_mode: {
			index: 5,
			size: 1,
			signed: false,
		},
		operation_mode: {
			index: 7,
			size: 1,
			signed: false,
		},
		gateway_confirmation: {
			index: 8,
			size: 1,
			signed: false,
		},
	},
});

Homey.manager('flow').on('condition.is_at_home', (callback, args) => {
	Homey.log('');
	Homey.log('on flow condition.is_at_home');
	Homey.log('args', args);

	console.log(args);

	// Get the status of the requested user
	const user = searchUserByUserId(args.person.id);
	if (user !== null && typeof user.statusCode !== 'undefined') {
		if (user.statusCode === 1 || user.statusCode === 0) {
			return callback(null, user.statusCode === 1); // we've fired successfully
		}

		var message = __('flow.condition.unknownUserStatus');
		return callback(new Error(message)); // user not found.
	}

	var message = __('flow.condition.userNotFound');
	return callback(new Error(message)); // user not found.
});

Homey.manager('flow').on('action.toggle_person_home', (callback, args) => {
	Homey.log('');
	Homey.log('on flow action.toggle_person_home');
	Homey.log('args', args);

	// Set status of user to home
	setStatusOfUser(args.person, 1);

	callback(null, true); // we've fired successfully
});

Homey.manager('flow').on('action.toggle_person_away', (callback, args) => {
	Homey.log('');
	Homey.log('on flow action.toggle_person_away');
	Homey.log('args', args);

	// Set status of user to away
	setStatusOfUser(args.person, 0);

	callback(null, true); // we've fired successfully
});

// Autocomplete events
Homey.manager('flow').on('action.toggle_person_home.person.autocomplete', (callback, args) => {
	const myItems = autocompleteUser(args.query);
	callback(null, myItems); // err, results
});

Homey.manager('flow').on('action.toggle_person_away.person.autocomplete', (callback, args) => {
	const myItems = autocompleteUser(args.query);
	callback(null, myItems); // err, results
});

Homey.manager('flow').on('condition.is_at_home.person.autocomplete', (callback, args) => {
	const myItems = autocompleteUser(args.query);
	callback(null, myItems); // err, results
});

// var tagContainer = [ ]; // contains objects: { "tagId": 0, "tagValue": "", "createdOn": "", "tagType": null };
// tagType can be null (unknown, when not in gateway mode), 0 == RFID, or 1 == Code
function getTagContainer() {
	return Homey.manager('settings').get('tagContainer');
}

function setTagContainer(value) {
	Homey.manager('settings').set('tagContainer', value);
}

// var userContainer = [ ]; // contains objects: { "name": "bla", "id": -1, "statusCode": 0 (0 = away, 1 = home), "tagIds": { 1, 3 } };
function getUserContainer() {
	return Homey.manager('settings').get('userContainer');
}

function setUserContainer(value) {
	Homey.manager('settings').set('userContainer', value);
}

function getSystemArmed() {
	return Homey.manager('settings').get('systemArmed') === true;
}

function setSystemArmed(value) {
	if (value === false || value === 0) {
		value = false;
	} else {
		value = true;
	}

	Homey.manager('settings').set('systemArmed', value);
}

function getTagStatus() {
	return Homey.manager('settings').get('tagStatus') === true;
}

function setTagStatus(value) // value needs to be true or false
{
	if (value === false || value === 0) {
		value = false;
	} else {
		value = true;
	}

	Homey.manager('settings').set('tagStatus', value);
}

function getTagReaders() {
	return Homey.manager('settings').get('tagReaders');
}

function setTagReaders(value) {
	Homey.manager('settings').set('tagReaders', value);
}

/**
 * Writes entry to log file for EU Benext
 * statusCodes: 0 = away, 1 = home, 2 = tag added, 3 = Scene Started
 */
function writeToLogFile(userId, deviceId, tagId, statusCode, userName, deviceName) {
	const logEntry =
		{
			time: new Date(),
			userId,
			tagId,
			statusCode, // 0 = away, 1 = home, 2 = tag added, 3 = Scene Started, -1 = unknown
			userName,
			deviceName,
			deviceId,
		};

	let log = Homey.manager('settings').get('systemEventLog');
	if (typeof log === 'undefined' || log === null) {
		log = [];
	}

	if (typeof log.push === 'undefined') {
		log = [];
	}

	log.push(logEntry);
	log = log.slice(Math.max(log.length - 50, 0)); // Only keep last 50 events from event log
	Homey.manager('settings').set('systemEventLog', log);

	console.log('Just logged entry:');
	console.log(logEntry);
}

/**
 * Function for autocompletion results in flow cards
 * @param filterValue ; value to search for
 * @returns array with user objects.
 */
function autocompleteUser(filterValue) {
	let myItems = getUserContainer();

	if (typeof myItems === 'undefined' || myItems === null) {
		myItems = [];
	}

	// filter items to match the search query
	myItems = myItems.filter((item) => (item.name.toLowerCase().indexOf(filterValue.toLowerCase()) > -1));

	return myItems;
}

/**
 * Retrieves user ID from the homey settings.
 * Sends ID confirmation if tagcode couldn't be found in the homey settings.
 */
function retrieveAndSetUserId(tagCode, node, tagType) {
	// Check if tagCode already exists
	let matchedTag = searchTag(getTagContainer(), tagCode);

	// Create new unique tag ID if tag doesn't exist
	if (matchedTag === null) {
		matchedTag = addTag(tagCode, tagType);
	}

	// Matched tag still null?
	if (matchedTag === null) {
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
function sendUserIdSetConfirmation(tag, node) {
	console.log('Sending information');
	node.CommandClass.COMMAND_CLASS_USER_CODE.USER_CODE_SET({
			'User Identifier': tag.tagId,
			'User ID Status': Buffer.from('01', 'hex'),
			USER_CODE: Buffer.from(tag.tagValue, 'hex'),
		},
		(err, result) => {
			console.log('Done sending information');
			console.log(err);
			console.log(result);

			if (err) { return console.error(err); }
		}
	);
}

/**
 * Checks if user is allowed to arm/disarm the home.
 * @param type: 1 == home (disarm), 0 == away (arm)
 * @param override: true if value must be overriden
 * @param overrideValue: the value to override it with (true/false)
 */
function sendGatewayApprovalDisaproval(node, type, override, overrideValue) {
	let allow = getTagStatus();
	if (override === true) {
		allow = overrideValue;
	} else {
		// check if system is armed
	}

	// Via a response: INDICATOR_SET ; ID: (0x06), value: (0x06) : allow
	// or via: INDICATOR_SET; ID: (0x04), value: 8 : deny
	let indicatorId = 4;
	let indicatorValue = 8;
	if (allow === true) {
		indicatorId = 6;
		indicatorValue = 6;
	}

	console.log('Sending information');
	console.log(`${indicatorId} -- ${indicatorValue}`);

	node.CommandClass.COMMAND_CLASS_INDICATOR.INDICATOR_SET({
			'Indicator 0 Value': 0,
			'Indicator ID 1': indicatorId,
			'Property ID 1': 1,
			'Value 1': indicatorValue,
			Properties1: { 'Indicator Object Count': 1 },
		},
		(err, result) => {
			console.log('Done sending information - Indicator Set');
			console.log(err);
			console.log(result);

			if (err) { return console.error(err); }
		}
	);
}

/**
 * Sends feedback to the device via indicator.
 * @param node: the node that is sending the request
 * @param eventType: 1 = Disarm, 0 = Arm, 2 = New Tag, 3 = Intruder Tag
 * @param success: if the LED has to be green or red (true = green, false = red)
 */
function sendLedFeedback(node, eventType, success) {
	/**
	 Variable indicators (using the indicator command class)
	 1. System walkin/out (armed)  red blink 2x every second (indicator: ARMED)
	 2. RF message send failed  red blink 8x (indicator: FAULT)
	 3. Ready for arm/disarm (enter rfid/pin) red on for 5 seconds (indicator: ENTER_ID)
	 4. Valid rfid/pin received  green on for 1 second (indicator: READY) Note: above values are default values
	 */

	let indicatorId = 0;
	let propertyId = 0;
	let indicatorValue = 0;
	if (eventType === 0) {
		indicatorId = 1;
		propertyId = 4;
		indicatorValue = 5;
	} else if (eventType === 1) {
		indicatorId = 3;
		propertyId = 3;
		indicatorValue = 2;
	}

	console.log('Sending LED confirmation');
	console.log(`${indicatorId} -- ${indicatorValue}`);

	node.CommandClass.COMMAND_CLASS_INDICATOR.INDICATOR_SET({
			'Indicator 0 Value': 0,
			'Indicator ID 1': indicatorId,
			'Property ID 1': propertyId,
			'Value 1': indicatorValue,
			Properties1: { 'Indicator Object Count': 1 },
		},
		(err, result) => {
			console.log('Done sending information - LED Confirmation');
			console.log(err);
			console.log(result);

			if (err) { return console.error(err); }
		}
	);
}

/**
 * Returns the tag for the value searched.
 * @param tags ; All the tags you want to look in
 * @param matchValue ; The value you are looking for
 * @returns null if no match found, otherwise the matched tag object.
 */
function searchTag(tags, matchValue) {
	let match = null;
	if (typeof tags === 'undefined' || tags === null) {
		return null;
	}

	for (let i = 0; i < tags.length; i++) {
		if (typeof tags[i].tagValue === 'undefined' || tags[i].tagValue === null) {
			continue;
		}

		if (tags[i].tagValue === matchValue) {
			console.log('match found');
			console.log(tags[i]);
			match = tags[i];
			i = 100;
		}
	}

	return match;
}

/**
 * Adds a tag to the tags container and returns the tag value (and id, as tag object). Searches first if the tag doesn't exist yet.
 * @param tagCode ; the tag code value
 * @param tagType ; the type of tag (0 = tag, 1 = user code, -1 = unknown)
 * @returns the newly added / or the found existing tag.
 * Please note that this function reads all tags from the tag container and overwrites all tags after adding the new tag.
 */
function addTag(tagCode, tagType) {
	let tags = getTagContainer();

	if (tagType !== 0 && tagType !== 1) // 0 = tag, 1 = user code, -1 = unknown
	{
		tagType = -1;
	}

	if (typeof tags === 'undefined' || tags == null) {
		console.log('Tags not set, new tag list initiated.');
		tags = new Array();
	}

	if (typeof tags !== 'object') {
		tags = new Array();
	}

	// Search for tag, in case we do not need to send the report back, we will still find a matching tag (or create a new one)
	const existingTag = searchTag(tags, tagCode);
	if (existingTag !== null) {
		return existingTag;
	}

	let highestId = 0;
	for (let i = 0; i < tags.length; i++) {
		if (tags[i].tagId > highestId) {
			highestId = tags[i].tagId;
		}
	}

	const tag = { tagId: (highestId + 1), tagValue: tagCode, createdOn: new Date(), tagType };
	tags.push(tag);
	setTagContainer(tags);
	return tag;
}

/**
 * Finds the user belonging to the tagId.
 * @param tagId; The tag ID you want to find a user match for
 * @returns null if no user with that Tag ID assigned found, otherwise returns the user object.
 */
function searchUser(tagId) {
	const users = getUserContainer();
	if (typeof users === 'undefined' || users === null || typeof users !== 'object') {
		return null;
	}

	for (let i = 0; i < users.length; i++) {

		if (typeof users[i].tagIds === undefined || typeof users[i].tagIds.indexOf !== 'function') {
			continue;
		}

		const match = users[i].tagIds.indexOf(tagId);
		if (match > -1) {
			console.log('match found id');
			console.log(users[i]);
			return users[i];
		}
	}

	return null;
}

/**
 * Finds the user based on user id.
 * @param userId ; The ID of the user you are looking for
 * @returns null if no match found, otherwise returns the user object.
 */
function searchUserByUserId(userId) {
	const users = getUserContainer();
	if (typeof users === 'undefined' || users === null || typeof users !== 'object') {
		return null;
	}

	for (let i = 0; i < users.length; i++) {
		if (users[i].id === userId) {
			console.log('match found id');
			console.log(users[i]);
			return users[i];
		}
	}

	return null;
}

/**
 * Sets the status of the user given in the user parameter
 * @param user ; An user object with user.id or user.userId
 * @param statusCode ; The statuscode this user should get (home = 1 or away = 0)
 * Please note: this function loads the user container and writes all objects back to it.
 */
function setStatusOfUser(user, statusCode) {
	const users = getUserContainer();
	if (typeof users === 'undefined' || users === null || typeof users !== 'object') {
		return null;
	}

	for (let i = 0; i < users.length; i++) {
		const userId = (typeof user.id !== 'undefined') ? user.id : user.userId;
		if (users[i].id === userId) {
			users[i].statusCode = (statusCode === 0 ? 0 : 1);
		}
	}

	setUserContainer(users);
}

/**
 * Lookups the user based on a tag ID
 * @param tagReaderTagId; the tag ID
 * @param node; the node that triggered this event
 * @returns an object with userId, userName, tagId, and deviceId
 */
function searchUserBelongingToTagId(tagReaderTagId, node) {
	let tagReaderTagIdInt = -1;
	try {
		tagReaderTagIdInt = parseInt(tagReaderTagId);
	} catch (e) { console.log('Cannot parse tag reader id to int'); }

	// Search for user with this tag id
	const userWithTagId = searchUser(tagReaderTagIdInt);
	console.log(userWithTagId);

	return {
		userId: userWithTagId !== null ? userWithTagId.id : -1,
		userName: userWithTagId !== null ? userWithTagId.name : '',
		tagId: tagReaderTagIdInt,
		deviceId: node.instance.token,
	};
}

/**
 * Sets the device status reports after a report came in.
 * @param nodeToken; the unique id from the device in the event
 * @param statusName; the type of status (BASIC or GATEWAY)
 */
function setDeviceReport(nodeToken, statusName) {
	let devices = getTagReaders();
	if (typeof devices === 'undefined' || devices === null || typeof devices.length === 'undefined') {
		devices = new Array();
	}

	let match = false;
	for (let i = 0; i < devices.length; i++) {
		if (devices[i].id === nodeToken) {
			devices[i].state = statusName;
			devices[i].lastUpdate = new Date();
			match = true;
			i = devices.length + 1;
		}
	}

	if (match === false) {
		devices.push({ id: nodeToken, state: statusName, lastUpdate: new Date(), name: '' });
	}

	setTagReaders(devices);
}
