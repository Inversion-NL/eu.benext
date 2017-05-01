'use strict';

const path = require('path');
const ZwaveDriver = require('homey-zwavedriver');

// Documentation: http://www.benext.eu/static/manual/heatingcontrol.pdf

module.exports = new ZwaveDriver(path.basename(__dirname), {
	debug: true,
	capabilities: {
		target_temperature: {
			command_class: 'COMMAND_CLASS_THERMOSTAT_SETPOINT',
			command_get: 'THERMOSTAT_SETPOINT_GET',
			command_get_parser: () => ({
				'Level': {
					'Setpoint Type': 'Heating 1',
				}
			}),
			command_set: 'THERMOSTAT_SETPOINT_SET',
			command_set_parser: (value) => {

				// Create value buffer
				const a = new Buffer(2);
				a.writeUInt16BE((Math.round(value * 2) / 2 * 10).toFixed(0));

				return {
					'Level': {
						'Setpoint Type': 'Heating 1'
					},
					'Level2': {
						'Size': 2,
						'Scale': 0,
						'Precision': 1
					},
					'Value': a
				};
			},
			command_report: 'THERMOSTAT_SETPOINT_REPORT',
			command_report_parser: report => {
				if (report.hasOwnProperty('Level2')
					&& report.Level2.hasOwnProperty('Scale')
					&& report.Level2.hasOwnProperty('Precision')
					&& report.Level2['Scale'] === 0
					&& report.Level2['Size'] !== 'undefined'
					&& typeof report['Value'].readUIntBE(0, report.Level2['Size']) !== 'undefined') {
					return report['Value'].readUIntBE(0, report.Level2['Size']) / Math.pow(10, report.Level2['Precision']);
				}
				return null;
			},
		},
		measure_temperature: {
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
				if (report['Sensor Type'] !== 'Temperature (version 1)' || report['Sensor Value (Parsed)'] === -999.9) return null;
				return report['Sensor Value (Parsed)'];
			},
			optional: true,
		},
		measure_pressure: {
			command_class: 'COMMAND_CLASS_SENSOR_MULTILEVEL',
			command_get: 'SENSOR_MULTILEVEL_GET',
			command_get_parser: () => ({
				'Sensor Type': 'Barometric pressure (version 2) ',
				Properties1: {
					Scale: 0,
				},
			}),
			command_report: 'SENSOR_MULTILEVEL_REPORT',
			command_report_parser: report => {
				if (report['Sensor Type'] !== 'Barometric pressure (version 2) ' || report['Sensor Value (Parsed)'] === -999.9) return null;
				return report['Sensor Value (Parsed)'];
			},
			optional: true,
		},
		'measure_temperature.outside': {
			command_class: 'COMMAND_CLASS_SENSOR_MULTILEVEL',
			command_get: 'SENSOR_MULTILEVEL_GET',
			command_get_parser: () => ({
				'Sensor Type': 'Target Temperature (v6)',
				Properties1: {
					Scale: 0,
				},
			}),
			command_report: 'SENSOR_MULTILEVEL_REPORT',
			command_report_parser: report => {
				if (report['Sensor Type'] !== 'Target Temperature (v6)' || report['Sensor Value (Parsed)'] === -999.9) return null;
				return report['Sensor Value (Parsed)'];
			},
			optional: true,
		},
	},
	settings: {},
});
