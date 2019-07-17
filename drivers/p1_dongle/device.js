'use strict';

// Documentation: http://www.benext.eu/static/manual/P1_dongle-nl.pdf

const Homey = require('homey');
const ZwaveDevice = require('homey-meshdriver').ZwaveDevice;

class P1DongleDevice extends ZwaveDevice {

onMeshInit() {
		this.enableDebug();
		this.printNode();

this.registerCapability('measure_power', 'METER');
this.registerCapability('meter_power.normal', 'METER', {
            multiChannelNodeId: 1,
			pollInterval: 'poll_interval_channel_1',
});
this.registerCapability('meter_power.low', 'METER', {
            multiChannelNodeId: 2,
			pollInterval: 'poll_interval_channel_2',
});
this.registerCapability('meter_gas', 'METER', {
			multiChannelNodeId: 3,
			pollInterval: 'poll_interval_channel_3',
			});



}
}

module.exports = P1DongleDevice;