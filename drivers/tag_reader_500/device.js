'use strict';

const Homey = require('homey');
const path = require('path');
const util = require('homey-meshdriver').Util;
const ZwaveDevice = require('homey-meshdriver').ZwaveDevice;

// http://products.z-wavealliance.org/products/1979
// http://www.benext.eu/static/manual/tagreader500.pdf


// Based on the https://github.com/aartse/athom.zipato which is based on https://github.com/Inversion-NL/eu.benext 

const eventsRecieved = new Array();
const eventIdsRecieved = new Array();

const clamp = function(num, min, max) {
	return Math.min(Math.max(num, min), max);
};

class tagReaderDevice extends ZwaveDevice {
	async onMeshInit() {
		this.enableDebug();
		this.printNode();
		this.log("Initializing mesh driver")
		this.registerCapability('measure_battery', 'BATTERY');
		this.registerCapability('homealarm_state', 'SWITCH_BINARY');
		this.registerCapability('user_code_report', 'USER_CODE', {
			report: 'USER_CODE_REPORT',
			reportParser: report => {

				this.log(report)

				// var userIdentifier = report["User Identifier (Raw)"];
				const tagOrUserCode = report.USER_CODE.toString('hex'); // It's a buffer (hex), and we store the translated value
				// var userIdStatus = report["User ID Status (Raw)"];
				this.log("User code: " + tagOrUserCode)
				// Tags are only allowed when the manual toggle is set to true and the system is not armed.
				const tagAllowed = getTagStatus() && !getSystemArmed();
				if (!tagAllowed) {
					this.log('You are not allowed to add tags. Either the manual toggle is set to off or your system is in armed status');
					return null;
				}

				// When home is not armed, send a "USER_CODE_SET" back with a new/existing ID
				const tag = this.retrieveAndSetUserId(tagOrUserCode, -1); // -1 because we don't know if it is a tag or not.
				this.log(tag);
				if (tag === false) {
					this.log('Something went wrong! :(');
					return null;
				}

				writeToLogFile(
					null,
					this.getData().token,
					tag.tagId,
					2, // tag added
					null,
					null
				);

				return {
					'Tag Value': tagOrUserCode,
					'Tag Id':tag.tagId
				};
			}
		});
		this.registerCapability('alarm_tamper', 'ALARM', {
			report: 'ALARM_REPORT',
			reportParser: report => {
				switch (report['ZWave Alarm Event']) {
					case 3: // Tamper
						return (report['ZWave Alarm Status'] == 'On');
					case 6: // Home
						return false;
				}
				return null
			}
		});
		this.registerCapability('homealarm_state', 'ALARM', {
			report: 'ALARM_REPORT',
			reportParser: report => {
				const evt = report['ZWave Alarm Event'];
				if(evt == 3) { 
				  return null;
				}
				this.log('report event recieved');
				//this.log(report);
				//this.log('Device ID: ' + this.getData().token);
				setDeviceReport(this.getData().token, 'BASIC');

				let eventType = -1;
				const tagReaderTagId = report['Event Parameter'].toString('hex'); // Tag reader sends us a tag ID we provided it earlier.
				const tokens = searchUserBelongingToTagId(tagReaderTagId, this.getData().token);
				const state = {};

				switch (evt) {
					case 6: // Home
						eventType = 1;

						this.log("Home")
						// Toggle event, "User X came home"
						this.userHomeTrigger.trigger(this, tokens, state, (err, result) => {
							if (err) {
								this.log(err);
								return Homey.error(err);
							}
						});

						//this.log("Trigger: ");
						//console.log(this.userSystemHomeTrigger)
						if (getSystemArmed() == true) {
							this.userSystemHomeTrigger.trigger(this, tokens, state, (err, result) => {
								if (err) {
									this.log(err);
									return Homey.error(err);
								}
							});
						}
						setSystemArmed(false);

						break;
					case 5: // Away
						eventType = 0;
						this.log("Away")
						// Toggle event, "User X went away"
						this.userAwayTrigger.trigger(this, tokens, state, (err, result) => {
							if (err) {
								this.log(err);
								return Homey.error(err);
							}
						});

						//this.log("Trigger: ");
						//console.log(this.userSystemAwayTrigger)
						if (getSystemArmed() == false) {
							this.userSystemAwayTrigger.trigger(this, tokens, state, (err, result) => {
								if (err) {
									this.log(err);
									return Homey.error(err);
								}
							});
						}
						setSystemArmed(true);

						break;
				}

				if (tokens !== null) {
					setStatusOfUser(tokens, eventType);
				}

				writeToLogFile(
					tokens !== null ? tokens.userId : null,
					this.getData().token,
					tokens !== null ? tokens.tagId : tagReaderTagId,
					eventType,
					tokens !== null ? tokens.userName : null,
					null
				);

				return (eventType == 0) ? "armed" : "disarmed";
			}
		});
		this.registerSetting('set_to_default', value => {
			return new Buffer([ (value === true) ? 0 : 1 ])
		});
		this.registerSetting('feedback_time', value => {
			return new Buffer([ clamp(value, 0, 255) ])
		});
		this.registerSetting('feedback_timeout', value => {
			return new Buffer([ clamp(value, 0, 255) ])
		});
		this.registerSetting('feedback_beeps_per_second', value => {
			return new Buffer([ clamp(value, 0, 255) ])
		});
		this.registerSetting('always_awake_mode', value => {
			return new Buffer([ (value === true) ? 0 : 1 ])
		});
		// Gateway confirmation is not yet implemented
		await this.configurationSet({index: 8, size: 1}, 0);


		let isAtHome = new Homey.FlowCardCondition('tagReader-is_at_home');
		isAtHome
		    .register()
		    .registerRunListener(( args, state ) => {
				this.log('');
				this.log('on flow condition.is_at_home');
				this.log('args', args);

				this.log(args);

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
			let isArmed = new Homey.FlowCardCondition('tagReader-system_is_armed');
			isArmed
				.register()
				.registerRunListener(( args, state, callback ) => {
					this.log('');
					this.log('on flow condition.system_is_armed');

					return callback(null, getSystemArmed());
				});

			let setPersonHome = new Homey.FlowCardAction('tagReader-toggle_person_home');
			setPersonHome
				.register()
				.registerRunListener(( args, state, callback ) => {
					this.log('');
					this.log('Set person home');
					this.log('args', args);

					// Set status of user to home
					setStatusOfUser(args.person, 1);

					callback(null, true); // we've fired successfully
				});
			let setPersonAway = new Homey.FlowCardAction('tagReader-toggle_person_away');
			setPersonAway
				.register()
				.registerRunListener(( args, state, callback ) => {
					this.log('');
					this.log('Set person away');
					this.log('args', args);
				
					// Set status of user to home
					setStatusOfUser(args.person, 0);
				
					callback(null, true); // we've fired successfully
				});
			function personAutocompleteListener(query, args, callback) {
				const result = autocompleteUser(query);
				callback(null, result); // err, results
			}
			isAtHome.getArgument("person").registerAutocompleteListener(personAutocompleteListener)
			setPersonHome.getArgument("person").registerAutocompleteListener(personAutocompleteListener)
			setPersonAway.getArgument("person").registerAutocompleteListener(personAutocompleteListener)

			this.userSystemAwayTrigger = new Homey.FlowCardTriggerDevice('tagReader-user_system_away').register();
			this.userSystemHomeTrigger = new Homey.FlowCardTriggerDevice('tagReader-user_system_home').register();
			this.userHomeTrigger = new Homey.FlowCardTriggerDevice('tagReader-user_home').register();
			this.userAwayTrigger = new Homey.FlowCardTriggerDevice('tagReader-user_away').register();
	}


	/**
	 * Retrieves user ID from the homey settings.
	 * Sends ID confirmation if tagcode couldn't be found in the homey settings.
	 */
	retrieveAndSetUserId(tagCode, tagType) {
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
		this.sendUserIdSetConfirmation(matchedTag);

		return matchedTag;
	}

	/**
	 * Sends the tag ID to the device
	 */
	sendUserIdSetConfirmation(tag) {
		console.log('Sending information');
		this.node.CommandClass.COMMAND_CLASS_USER_CODE.USER_CODE_SET({
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
}

// var tagContainer = [ ]; // contains objects: { "tagId": 0, "tagValue": "", "createdOn": "", "tagType": null };
// tagType can be null (unknown, when not in gateway mode), 0 == RFID, or 1 == Code
function getTagContainer() {
	return Homey.ManagerSettings.get('tagContainer');
}

function setTagContainer(value) {
	Homey.ManagerSettings.set('tagContainer', value);
}

// var userContainer = [ ]; // contains objects: { "name": "bla", "id": -1, "statusCode": 0 (0 = away, 1 = home), "tagIds": { 1, 3 } };
function getUserContainer() {
	return Homey.ManagerSettings.get('userContainer');
}

function setUserContainer(value) {
	Homey.ManagerSettings.set('userContainer', value);
}

function getSystemArmed() {
	return Homey.ManagerSettings.get('systemArmed') === true;
}

function setSystemArmed(value) {
	if (value === false || value === 0) {
		value = false;
	} else {
		value = true;
	}

	Homey.ManagerSettings.set('systemArmed', value);
}

function getTagStatus() {
	return Homey.ManagerSettings.get('tagStatus') === true;
}

function setTagStatus(value) // value needs to be true or false
{
	if (value === false || value === 0) {
		value = false;
	} else {
		value = true;
	}

	Homey.ManagerSettings.set('tagStatus', value);
}

function getTagReaders() {
	return Homey.ManagerSettings.get('tagReaders');
}

function setTagReaders(value) {
	Homey.ManagerSettings.set('tagReaders', value);
}

/**
 * Writes entry to log file
 * statusCodes: 0 = away, 1 = home, 2 = tag added, 3 = Scene Started
 */
function writeToLogFile(userId, deviceId, tagId, statusCode, userName, deviceName) {
	const logEntry =
		{
			time: new Date(),
			userId,
			tagId,
			statusCode, // 0 = away, 1 = home, 2 = tag added, 3 = Scene Started, 4 = Unknown Tag, -1 = unknown
			userName,
			deviceName,
			deviceId,
		};

	let log = Homey.ManagerSettings.get('systemEventLog');
	if (typeof log === 'undefined' || log === null) {
		log = [];
	}

	if (typeof log.push === 'undefined') {
		log = [];
	}

	log.push(logEntry);
	log = log.slice(Math.max(log.length - 50, 0)); // Only keep last 50 events from event log
	Homey.ManagerSettings.set('systemEventLog', log);

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
function searchUserBelongingToTagId(tagReaderTagId, nodeId) {
	let tagReaderTagIdInt = -1;
	try {
		tagReaderTagIdInt = parseInt(tagReaderTagId, 16);
	} catch (e) { console.log('Cannot parse tag reader id to int'); }

	// Search for user with this tag id
	const userWithTagId = searchUser(tagReaderTagIdInt);
	if(userWithTagId == null) {
		console.log("No user matching tag ID " + tagReaderTagId)
		handleOrphanTag(tagReaderTagId, nodeId)
	}

	return {
		userId: userWithTagId !== null ? userWithTagId.id : -1,
		userName: userWithTagId !== null ? userWithTagId.name : '',
		tagId: tagReaderTagIdInt,
		deviceId: nodeId,
	};
}

function handleOrphanTag(tagId, nodeId) {
	let tags = getTagContainer();
	for (let i = 0; i < tags.length; i++) {
		if (tags[i].tagId == tagId) {
			return null
		}
	}
	const tagAllowed = getTagStatus() && !getSystemArmed();
	if(!tagAllowed) {
		writeToLogFile(-1, nodeId, parseInt(tagId, 16), 4, '', null);
	} else {
		const tag = { tagId: parseInt(tagId, 16), tagValue: '(From device)', createdOn: new Date(), tagType: -1 };
		tags.push(tag);
		setTagContainer(tags);
		return tag;
	}
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

module.exports = tagReaderDevice;
