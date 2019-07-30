'use strict';

const Homey = require('homey');
const ZwaveDevice = require('homey-meshdriver').ZwaveDevice;

// Documentation: http://www.benext.eu/static/manual/alarmsound.pdf

class AlarmSoundDevice extends ZwaveDevice {

onMeshInit() {
		this.enableDebug();
		this.printNode();
this.registerCapability('onoff', 'SWITCH_BINARY');

}
}

module.exports = AlarmSoundDevice;