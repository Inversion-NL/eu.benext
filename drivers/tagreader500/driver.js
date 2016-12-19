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

var tagContainer = [ ]; // contains objects: { "tagId": 0, "tagValue": "" };
var userContainer = [ ]; // contains objects: { "user": "bla", "tagIds": { 1, 3 } };

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
		/*'custom.user_code_report': {
			'command_class'				: 'COMMAND_CLASS_USER_CODE',
			'command_get'				: function( report )
			{
				// Parse UserID, UID Status 0, Tag Code
				
				// Send USER_CODE_SET (UserId, UID Status 1, Tag Code)
				return;
			}
		},
		'custom.arm_disarm': {
			'command_class'				: 'COMMAND_CLASS_ALARM_V2',
			'command_get'				: function( report )
			{
				// Parse UserID, UID Status 0, Tag Code
				
				// Send USER_CODE_SET (UserId, UID Status 1, Tag Code)
				return;
			}
		},*/
		'custom.gateway_control': {
			'command_class'				: 'COMMAND_CLASS_ENTRY_CONTROL',
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
			}
		}
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

Homey.manager('flow').on('trigger.system_home', function( callback, args ){
	Homey.log('');
	Homey.log('on flow trigger.system_home');
	Homey.log('args', args);

	//Homey.manager('drivers').getDriver('alarmsound').capabilities.onoff.set(args.device, true, function (err, data) {
	//	if (err) callback (err, false);
	//});

	callback( null, true ); // we've fired successfully
});

Homey.manager('flow').on('trigger.system_away', function( callback, args ){
	Homey.log('');
	Homey.log('on flow trigger.system_away');
	Homey.log('args', args);

	//Homey.manager('drivers').getDriver('alarmsound').capabilities.onoff.set(args.device, true, function (err, data) {
	//	if (err) callback (err, false);
	//});

	callback( null, true ); // we've fired successfully
});

Homey.manager('flow').on('trigger.system_scene', function( callback, args ){
	Homey.log('');
	Homey.log('on flow trigger.system_scene');
	Homey.log('args', args);

	//Homey.manager('drivers').getDriver('alarmsound').capabilities.onoff.set(args.device, true, function (err, data) {
	//	if (err) callback (err, false);
	//});

	callback( null, true ); // we've fired successfully
});

Homey.manager('flow').on('condition.is_at_home', function( callback, args ){
	Homey.log('');
	Homey.log('on flow condition.is_at_home');
	Homey.log('args', args);

	//Homey.manager('drivers').getDriver('alarmsound').capabilities.onoff.set(args.device, true, function (err, data) {
	//	if (err) callback (err, false);
	//});

	callback( null, true ); // we've fired successfully
});

Homey.manager('flow').on('action.toggle_system_home', function( callback, args ){
	Homey.log('');
	Homey.log('on flow action.toggle_system_home');
	Homey.log('args', args);

	//Homey.manager('drivers').getDriver('alarmsound').capabilities.onoff.set(args.device, true, function (err, data) {
	//	if (err) callback (err, false);
	//});

	callback( null, true ); // we've fired successfully
});

Homey.manager('flow').on('action.toggle_system_away', function( callback, args ){
	Homey.log('');
	Homey.log('on flow action.toggle_system_away');
	Homey.log('args', args);

	//Homey.manager('drivers').getDriver('alarmsound').capabilities.onoff.set(args.device, true, function (err, data) {
	//	if (err) callback (err, false);
	//});

	callback( null, true ); // we've fired successfully
});

Homey.manager('flow').on('action.toggle_system_away.person.autocomplete', function( callback, args ) {
	var myItems = autocomplete(args.query);
    callback( null, myItems ); // err, results
});

Homey.manager('flow').on('action.toggle_system_home.person.autocomplete', function( callback, args ) {
	var myItems = autocomplete(args.query);
    callback( null, myItems ); // err, results
});

Homey.manager('flow').on('condition.is_at_home.person.autocomplete', function( callback, args ) {
	var myItems = autocomplete(args.query);
    callback( null, myItems ); // err, results
});

function autocompleteUser(filterValue)
{
	var myItems = [ ];

    // filter items to match the search query
    myItems = myItems.filter(function(item){
    	return ( item.name.toLowerCase().indexOf( filterValue.toLowerCase() ) > -1 )
    })

    // args can also contain other arguments, so you can specify your autocomplete results

    /*
        example `myItems`:
        [
            {
                icon: 'https://path.to/icon.svg', // or use "image: 'https://path.to/icon.png'" for non-svg icons.
                name: 'Item name',
                description: 'Optional description',
                some_value_for_myself: 'that i will recognize when fired, such as an ID'
            },
            {
                ...
            }
        ]
    */
	
	return myItems;
}











