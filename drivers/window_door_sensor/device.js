'use strict';

const Homey = require('homey');
const ZwaveDevice = require('homey-meshdriver').ZwaveDevice;

// Documentation NL: http://www.benext.eu/static/manual/doorsensor-nl.pdf
// English: https://www.benext.eu/static/manual/doorsensor.pdf

class DoorSensorDevice extends ZwaveDevice {

onMeshInit() {
//this.enableDebug();
//this.printNode();
this.registerCapability('alarm_contact', 'BASIC');
this.registerCapability('alarm_contact', 'SENSOR_BINARY');
this.registerCapability('alarm_generic', 'ALARM', {
			get: 'ALARM_GET',
			getParser: () => ({
				'Alarm Type': 2,
			}),
			report: 'ALARM_REPORT',
			reportParser: report => {
				if (report &&
				    report.hasOwnProperty('Alarm Type') &&
				    report['Alarm Type'] === 2 &&
				    report.hasOwnProperty('Alarm Level')) {
					return report['Alarm Level'] === 255;
				}
				return null;
			}
});
this.registerCapability('alarm_tamper', 'ALARM', {
			get: 'ALARM_GET',
			getParser: () => ({
				'Alarm Type': 3,
			}),
			report: 'ALARM_REPORT',
			reportParser: report => {
				if (report &&
				    report.hasOwnProperty('Alarm Type') &&
				    report['Alarm Type'] === 3 &&
				    report.hasOwnProperty('Alarm Level')) {
					return report['Alarm Level'] === 255;
				}
				return null;
			}
});
this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL');
this.registerCapability('measure_battery', 'BATTERY');
this.registerCapability('alarm_battery', 'BATTERY');


}
}

module.exports = DoorSensorDevice;