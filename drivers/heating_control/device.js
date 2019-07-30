'use strict';

// Documentation: http://www.benext.eu/static/manual/heatingcontrol.pdf

//At the moment it just overrides the setpoint of the thermostate.  
//CLIMATE_CONTROL_SCHEDULE is not used at the moment

const Homey = require('homey');
const ZwaveDevice = require('homey-meshdriver').ZwaveDevice;

class HeatingDevice extends ZwaveDevice {


onMeshInit() {
	    this.enableDebug();
		this.printNode();



		this.registerCapability('target_temperature', 'THERMOSTAT_SETPOINT');
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



}
}

module.exports = HeatingDevice;