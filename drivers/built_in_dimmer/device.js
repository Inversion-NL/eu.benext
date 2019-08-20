'use strict';

// Documentation: http://www.benext.eu/static/manual/builtindimmer.pdf

const Homey = require('homey');
const ZwaveDevice = require('homey-meshdriver').ZwaveDevice;

class DimmerDevice extends ZwaveDevice {

onMeshInit() {
			this.enableDebug();
		this.printNode();
this.registerCapability('onoff', 'SWITCH_MULTILEVEL');
this.registerCapability('onoff', 'BASIC_SET');
this.registerCapability('dim', 'SWITCH_MULTILEVEL');
this.registerCapability('measure_power', 'METER');
this.registerCapability('meter_power', 'METER');


}
}

module.exports = DimmerDevice;
