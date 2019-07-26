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
			command_class: 'COMMAND_CLASS_METER',
			command_get: 'METER_GET',
			command_get_parser: () => ({
				Properties1: {
					'Rate Type': 'Import',
					Scale: 0,
				},
				'Scale 2': 0,
			}),
			command_report: 'METER_REPORT',
			command_report_parser: report => {
				if (report.hasOwnProperty('Properties2')
					&& report.Properties2.hasOwnProperty('Scale bits 10')
					&& report.Properties2['Scale bits 10'] === 0) {
					return report['Meter Value (Parsed)'];
				}
				return null;
}
});
this.registerCapability('meter_power.low', 'METER', {
			multiChannelNodeId: 2,
			pollInterval: 'poll_interval_channel_2',
			command_class: 'COMMAND_CLASS_METER',
			command_get: 'METER_GET',
			command_get_parser: () => ({
				Properties1: {
					'Rate Type': 'Import',
					Scale: 0,
				},
				'Scale 2': 0,
			}),
			command_report: 'METER_REPORT',
			command_report_parser: report => {
				if (report.hasOwnProperty('Properties2')
					&& report.Properties2.hasOwnProperty('Scale bits 10')
					&& report.Properties2['Scale bits 10'] === 0) {
					return report['Meter Value (Parsed)'];
				}
				return null;
}
});
this.registerCapability('meter_gas', 'METER', {
			multiChannelNodeId: 3,
			pollInterval: 'poll_interval_channel_3',
			});



}
}

module.exports = P1DongleDevice;
