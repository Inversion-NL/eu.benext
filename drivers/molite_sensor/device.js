'use strict';

const Homey = require('homey');
const ZwaveDevice = require('homey-meshdriver').ZwaveDevice;

// Documentation NL: http://www.benext.eu/static/manual/molitesensor-nl.pdf
// English: http://www.benext.eu/static/manual/molitesensor.pdf

class MoliteSensorDevice extends ZwaveDevice {

onMeshInit() {
		this.enableDebug();
		this.printNode();
this.registerCapability('alarm_motion', 'SENSOR_BINARY');
this.registerCapability('alarm_motion', 'BASIC');
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
this.registerCapability('measure_luminance', 'SENSOR_MULTILEVEL');
this.registerCapability('measure_battery', 'BATTERY');
}
}

module.exports = MoliteSensorDevice;