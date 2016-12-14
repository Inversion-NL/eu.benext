'use strict';

const path = require('path');
const ZwaveDriver = require('homey-zwavedriver');

// http://products.z-wavealliance.org/products/1979
// http://www.benext.eu/static/manual/tagreader500.pdf

//
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
			'command_class'				: 'COMMAND_CLASS_ALARM_V2',
			'command_get'				: function( report )
			{
				// Parse UserID, UID Status 0, Tag Code
				
				// Send USER_CODE_SET (UserId, UID Status 1, Tag Code)
				return;
			}
		},
		'manual_entry':{
			'command_class'				: 'COMMAND_CLASS_ENTRY_CONTROL',
			'command_get'				: function( report )
			{
				/*
				The supported events are: 
				- Caching 
				- Cached Keys 
				- Enter 
				- Arm Home 
				- Arm Away 
				- RFID 
				*/
				return;
			}
		}
    },

    settings: {
		
    }
	
	// COMMAND_CLASS_USER_CODE (only used in local mode), we don't want to support this if not nescecarry
	// 
});
