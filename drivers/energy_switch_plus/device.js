'use strict';

// Documentation: http://www.benext.eu/static/manual/energyswitchrs-nl.pdf

const Homey = require('homey');
const ZwaveDevice = require('homey-meshdriver').ZwaveDevice;

class EnergySwitchDevice extends ZwaveDevice {


onMeshInit() {
	    this.enableDebug();
		this.printNode();
		
		
this.registerCapability('onoff', 'SWITCH_BINARY');
this.registerCapability('onoff', 'BASIC_SET');
this.registerCapability('measure_power', 'METER');
this.registerCapability('meter_power', 'METER');

}
}

module.exports = EnergySwitchDevice;