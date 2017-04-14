'use strict';

const path = require('path');
const ZwaveDriver = require('homey-zwavedriver');

// Documentation: http://www.benext.eu/static/manual/alarmsound.pdf

module.exports = new ZwaveDriver(path.basename(__dirname), {
	capabilities: {
		onoff: {
			command_class: 'COMMAND_CLASS_SWITCH_BINARY',
			command_set: 'SWITCH_BINARY_SET',
			command_set_parser: value => ({
				'Switch Value': value,
			}),
			command_report: 'SWITCH_BINARY_REPORT',
			command_report_parser: report => report.Value === 'on/enable',
		},
	},
	settings: {
		destination_routine_enabled: {
			index: 2,
			size: 1,
			signed: false,
		},
		sound_light_mode_index: {
			index: 7,
			size: 1,
		},
		power_offline_sound_light_mode: {
			index: 8,
			size: 1,
		},
		destination_route_failed_sound_light_mode: {
			index: 9,
			size: 1,
		},
	},
});

Homey.manager('flow').on('action.sound_alarm', (callback, args) => {
	Homey.manager('drivers').getDriver('alarmsound').capabilities.onoff.set(args.device, true, callback);
});

Homey.manager('flow').on('action.silence_alarm', (callback, args) => {
	Homey.manager('drivers').getDriver('alarmsound').capabilities.onoff.set(args.device, false, callback);
});
