'use strict';

// Documentation: http://www.benext.eu/static/manual/heatingcontrol.pdf

//still experimental

const Homey = require('homey');
const ZwaveDevice = require('homey-meshdriver').ZwaveDevice;

const DEFAULT_SETPOINT = 20;

class HeatingDevice extends ZwaveDevice {


onMeshInit() {
	    this.enableDebug();
		this.printNode();
		this.registerCapability('target_temperature', 'CLIMATE_CONTROL_SCHEDULE', {
	get: 'SCHEDULE_OVERRIDE_GET',
	report: 'SCHEDULE_OVERRIDE_REPORT',
	reportParser: report => {
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
					return Math.max(7.5, Math.min(DEFAULT_SETPOINT + delta, 32.5));
				}
			},
	set: 'SCHEDULE_OVERRIDE_SET',
	setParser(value) {

				console.log('Set target temperature', value);

				let delta = (value - DEFAULT_SETPOINT) * 10;

				console.log('SCHEDULE_OVERRIDE_SET -> calculated delta ->', delta);

				if (delta < 0 && delta < -125) {
					console.error('out_of_range_too_low', delta);
					delta = -125;
				} else if (delta > 0 && delta > 125) {
					console.error('out_of_range_too_high', delta);
					delta = 125;
				}

				if (delta < 0) delta = 256 + delta;

				console.log('SCHEDULE_OVERRIDE_SET -> final object ->', {
					Properties1: {
						'Override Type': Number(this.getSetting('override_mode')) || 1,
					},
					'Override State': new Buffer([delta])
				});

				return {
					Properties1: {
						'Override Type': Number(this.getSetting('override_mode')) || 1,
					},
					'Override State': new Buffer([delta])
				}
			}
		});

		this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL');

		this.registerCapability('measure_pressure', 'SENSOR_MULTILEVEL', {
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
		});
		
		
		
		this.registerCapability('measure_temperature.outside', 'SENSOR_MULTILEVEL', {
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
		});


		//Setpoint
				if (this.node && this.node.CommandClass && this.node.CommandClass.COMMAND_CLASS_THERMOSTAT_SETPOINT) {
			this.node.CommandClass.COMMAND_CLASS_THERMOSTAT_SETPOINT.THERMOSTAT_SETPOINT_GET({
				'Level': {
					'Setpoint Type': 'Heating 1'
				}
			}, (err, result) => {
				console.log('GET', err, result);
				if (result && result.hasOwnProperty('Value')) {
					let parsedValue = result['Value'].readUIntBE(0, 2);
					if (typeof parsedValue === 'number' && parsedValue / 10 !== 20) {
						this.node.CommandClass.COMMAND_CLASS_THERMOSTAT_SETPOINT.THERMOSTAT_SETPOINT_SET({
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
							} else {
								console.log('Success after THERMOSTAT_SETPOINT_SET', result);
							}
						});
					} 
				}
			});

		} else {
			console.log('missing_command_class_or_method');
		}
		
		
		

}
}

module.exports = HeatingDevice;
