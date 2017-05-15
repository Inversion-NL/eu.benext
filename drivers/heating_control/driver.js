'use strict';

const path = require('path');
const ZwaveDriver = require('homey-zwavedriver');

// Documentation: http://www.benext.eu/static/manual/heatingcontrol.pdf

const DEFAULT_SETPOINT = 20;

module.exports = new ZwaveDriver(path.basename(__dirname), {
	capabilities: {
		target_temperature: {
			command_class: 'COMMAND_CLASS_CLIMATE_CONTROL_SCHEDULE',
			command_get: 'SCHEDULE_OVERRIDE_GET',
			command_report: 'SCHEDULE_OVERRIDE_REPORT',
			command_report_parser: report => {
				console.log('SCHEDULE_OVERRIDE_REPORT -> report', report, 'override value', report['Override State (Raw)'][0]);
				if (report &&
					report.hasOwnProperty('Override State (Raw)')) {

					let delta;
					// Value is below DEFAULT_SETPOINT
					if (report['Override State (Raw)'][0] >= 126 && report['Override State (Raw)'][0] <= 256) {
						delta = ((256 - report['Override State (Raw)'][0]) / 10) * -1;
						console.log('calculated incoming (negative) delta', delta);
					}
					// Value is above DEFAULT_SETPOINT
					else if (report['Override State (Raw)'][0] >= 0 && report['Override State (Raw)'][0] < 126) {
						delta = report['Override State (Raw)'][0] / 10;
						console.log('calculated incoming (positive) delta', delta);
					}
					console.log('SCHEDULE_OVERRIDE_REPORT -> calculated value ->', DEFAULT_SETPOINT + delta);
					return Math.max(7, Math.min(DEFAULT_SETPOINT + delta, 32));
				}
			},
			command_set: 'SCHEDULE_OVERRIDE_SET',
			command_set_parser: (value, node) => {

				console.log('Set target temperature', value);

				let delta = (value - DEFAULT_SETPOINT) * 10;

				console.log('SCHEDULE_OVERRIDE_SET -> calculated delta ->', delta);

				if (delta < 0 && delta < -130) {
					console.error('out_of_range_too_low', delta);
					delta = -130;
				} else if (delta > 0 && delta > 120) {
					console.error('out_of_range_too_high', delta);
					delta = 120;
				}

				if (delta < 0) delta = 256 + delta;

				console.log('SCHEDULE_OVERRIDE_SET -> final object ->', {
					Properties1: {
						'Override Type': Number(node.settings.override_mode) || 1,
					},
					'Override State': new Buffer([delta])
				});

				return {
					Properties1: {
						'Override Type': Number(node.settings.override_mode) || 1,
					},
					'Override State': new Buffer([delta])
				}
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
	settings: {
		override_mode: (newValue, oldValue, deviceData) => module.exports.nodes[deviceData.token].settings.override_mode = newValue
	},
});

function configureDefaultSetpoint(deviceData, callback) {
	console.log('configureDefaultSetpoint()');

	Homey.wireless('zwave').getNode(deviceData, (err, node) => {
		if (err) {
			console.error('Error getting node', err);
			return callback(err);
		}

		if (node && node && node.CommandClass && node.CommandClass.COMMAND_CLASS_THERMOSTAT_SETPOINT) {
			node.CommandClass.COMMAND_CLASS_THERMOSTAT_SETPOINT.THERMOSTAT_SETPOINT_GET({
				'Level': {
					'Setpoint Type': 'Heating 1'
				}
			}, (err, result) => {
				console.log('GET', err, result);
				if (result && result.hasOwnProperty('Value')) {
					let parsedValue = result['Value'].readUIntBE(0, 2);
					if (typeof parsedValue === 'number' && parsedValue / 10 !== 20) {
						node.CommandClass.COMMAND_CLASS_THERMOSTAT_SETPOINT.THERMOSTAT_SETPOINT_SET({
							'Level': {
								'Setpoint Type': 'Heating 1'
							},
							'Level2': {
								'Size': 2,
								'Scale': 0,
								'Precision': 1
							},
							'Value': new Buffer([0, DEFAULT_SETPOINT * 10])
						}, (err, result) => {
							if (err) {
								console.error('Error on THERMOSTAT_SETPOINT_SET', err);
								return callback(err);
							} else {
								console.log('Success after THERMOSTAT_SETPOINT_SET', result);
								return callback(null, true);
							}
						});
					} else {
						return callback(null, true);
					}
				}
			});

		} else {
			return callback('missing_command_class_or_method');
		}
	});
}

module.exports.on('initNode', token => {
	const node = module.exports.nodes[token];
	if (node) {
		configureDefaultSetpoint(node.device_data, (err, result) => {
			console.log('initNode() -> configureDefaultSetpoint callback ->', err, result);
		});
	}
});
