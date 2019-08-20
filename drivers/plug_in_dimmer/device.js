'use strict';

// Documentation: http://www.benext.eu/static/manual/plugindimmer.pdf

const Homey = require('homey');
const ZwaveDevice = require('homey-meshdriver').ZwaveDevice;

class PluginDimmerDevice extends ZwaveDevice {

onMeshInit() {
			this.enableDebug();
		this.printNode();
this.registerCapability('onoff', 'SWITCH_MULTILEVEL');
this.registerCapability('dim', 'SWITCH_MULTILEVEL');
this.registerCapability('measure_power', 'METER');
this.registerCapability('meter_power', 'METER');


}
}

module.exports = PluginDimmerDevice;