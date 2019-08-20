'use strict';

const Homey = require('homey');
const ZwaveDevice = require('homey-meshdriver').ZwaveDevice;

// Documentation: http://www.benext.eu/static/manual/doorsensor-nl.pdf

class DoorSensorDevice extends ZwaveDevice {

onMeshInit() {
		this.enableDebug();
		this.printNode();
this.registerCapability('alarm_contact', 'SENSOR_BINARY');
this.registerCapability('alarm_water', 'SENSOR_ALARM');
this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL');
this.registerCapability('measure_battery', 'BATTERY');


}
}

module.exports = DoorSensorDevice;