'use strict';

const Homey = require('homey');
const ZwaveDevice = require('homey-meshdriver').ZwaveDevice;

// Documentation: http://www.benext.eu/static/manual/molitesensor-nl.pdf

class MoliteSensorDevice extends ZwaveDevice {

onMeshInit() {
		this.enableDebug();
		this.printNode();
this.registerCapability('alarm_motion', 'SENSOR_BINARY');
this.registerCapability('alarm_tamper', 'SENSOR_ALARM');	
this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL');
this.registerCapability('measure_luminance', 'SENSOR_MULTILEVEL');
this.registerCapability('measure_battery', 'BATTERY');
}
}

module.exports = MoliteSensorDevice;