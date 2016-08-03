"use strict";

const path			= require('path');
const ZwaveDriver	= require('homey-zwavedriver');

var devices = {};

// http://www.vesternet.com/downloads/dl/file/id/1024/product/2155/z_wave_benext_alarm_sound_manual.pdf

module.exports = new ZwaveDriver( path.basename(__dirname), {
	capabilities: {
		'onoff': {
			'command_class'				: 'COMMAND_CLASS_SWITCH_BINARY',
			'command_set'				: 'SWITCH_BINARY_SET',
			'command_set_parser'		: function( value ){
				return {
					'Switch Value': value
				}
			},
			'command_report'			: 'SWITCH_BINARY_REPORT',
			'command_report_parser'		: function( report ){
				return report['Value'] === 'on/enable';
			}
		},
	},
	settings: {
		"destination_routine_enabled" : {
			"index": 2,
			"size": 1,
			"parser": function( input ) {
				return new Buffer([ parseInt(input) ]);
			}
		},
		"sound_light_mode_index" : {
			"index": 7,
			"size": 1,
			"parser": function( input ) {
				return new Buffer([ parseInt(input) ]);
			}
		},
		"power_offline_sound_light_mode" : {
			"index": 8,
			"size": 1,
			"parser": function( input ) {
				return new Buffer([ parseInt(input) ]);
			}
		},
		"destination_route_failed_sound_light_mode" : {
			"index": 9,
			"size": 1,
			"parser": function( input ) {
				return new Buffer([ parseInt(input) ]);
			}
		}
	}
});

module.exports.init = function( devices_data, callback ) {
	Homey.log("init method", devices_data);
	devices_data.forEach(initDevice);

    // let Homey know the driver is ready
    callback(true, null);
}

// the `added` method is called is when pairing is done and a device has been added
module.exports.added = function( device_data, callback ) {
	Homey.log("added method", device_data);
    initDevice( device_data );
    callback( null, true );
}

// the `delete` method is called when a device has been deleted by a user
module.exports.deleted = function( device_data, callback ) {
	Homey.log("deleted method", device_data);
    delete devices[ device_data.id ];
    callback( null, true );
}

// a helper method to add a device to the devices list
function initDevice( device_data ) {
	Homey.log('initDevice');
	Homey.log('device_data', device_data);
}

// a helper method to get a device from the devices list by it's device_data object
function getDeviceByData( device_data ) {
    var device = devices[ device_data.id ];
    if( typeof device === 'undefined' ) {
        return new Error("invalid_device");
    } else {
        return device;
    }
}

Homey.manager('flow').on('action.alarmsound_enable-sound', function( callback, args ){
	Homey.log('on flow action.alarmsound_enable-sound');
	Homey.log('args', args);

	//var device = getDeviceByData( args.device );

	callback( null, true ); // we've fired successfully
});