'use strict';

const path = require('path');
const ZwaveDriver = require('homey-zwavedriver');

// Documentation: http://www.benext.eu/static/manual/molitesensor-nl.pdf

module.exports = new ZwaveDriver(path.basename(__dirname), {
	debug: true,
	capabilities: {
		alarm_motion: [{
			command_class: 'COMMAND_CLASS_SENSOR_BINARY',
			command_get: 'SENSOR_BINARY_GET',
			command_report: 'SENSOR_BINARY_REPORT',
			command_report_parser: report => report['Sensor Value'] === 'detected an event',
		}, {
			command_class: 'COMMAND_CLASS_BASIC',
			command_report: 'BASIC_SET',
			command_report_parser: report => {
				if (report && report.hasOwnProperty('Value')) return report.Value === 255;
				return null;
			},
		}],
		alarm_tamper: {
			command_class: 'COMMAND_CLASS_ALARM',
			command_get: 'ALARM_GET',
			command_get_parser: () => ({
				'Alarm Type': 3,
			}),
			command_report: 'ALARM_REPORT',
			command_report_parser: report => report['Alarm Level'] === 255,
		},
		measure_temperature: {
			getOnWakeUp: true,
			command_class: 'COMMAND_CLASS_SENSOR_MULTILEVEL',
			command_get: 'SENSOR_MULTILEVEL_GET',
			command_get_parser: () => ({
				'Sensor Type': 'Temperature (version 1)',
				Properties1: {
					Scale: 0,
				},
			}),
			command_report: 'SENSOR_MULTILEVEL_REPORT',
			command_report_parser: report => {
				if (report['Sensor Type'] !== 'Temperature (version 1)') return null;

				return report['Sensor Value (Parsed)'];
			},
		},
		measure_luminance: {
			getOnWakeUp: true,
			command_class: 'COMMAND_CLASS_SENSOR_MULTILEVEL',
			command_get: 'SENSOR_MULTILEVEL_GET',
			command_get_parser: () => ({
				'Sensor Type': 'Luminance (version 1)',
				Properties1: {
					Scale: 1,
				},
			}),
			command_report: 'SENSOR_MULTILEVEL_REPORT',
			command_report_parser: report => {
				if (report['Sensor Type'] !== 'Luminance (version 1)') return null;

				return report['Sensor Value (Parsed)'];
			},
		},
		measure_battery: {
			getOnWakeUp: true,
			command_class: 'COMMAND_CLASS_BATTERY',
			command_get: 'BATTERY_GET',
			command_report: 'BATTERY_REPORT',
			command_report_parser: (report, node) => {
				if (report &&
					report.hasOwnProperty('Battery Level') &&
					report['Battery Level'] === 'battery low warning') {
					if (node && node.hasOwnProperty('state') && (!node.state.hasOwnProperty('alarm_battery') || node.state.alarm_battery !== true)) {
						node.state.alarm_battery = true;
						module.exports.realtime(node.device_data, 'alarm_battery', true);
					}
					return 1;
				}
				if (report.hasOwnProperty('Battery Level (Raw)')) {
					if (node && node.hasOwnProperty('state') &&
						(!node.state.hasOwnProperty('alarm_battery') || node.state.alarm_battery !== false) &&
						report['Battery Level (Raw)'][0] > 5) {
						node.state.alarm_battery = false;
						module.exports.realtime(node.device_data, 'alarm_battery', false);
					}
					return report['Battery Level (Raw)'][0];
				}
				return null;
			},
		},
	},
	settings: {}
});
