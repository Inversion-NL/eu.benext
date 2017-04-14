'use strict';

const path = require('path');
const ZwaveDriver = require('homey-zwavedriver');

// http://www.cd-jackson.com/index.php/zwave/zwave-device-database/zwave-device-list/devicesummary/340

module.exports = new ZwaveDriver(path.basename(__dirname), {
	debug: true,
	capabilities: {
		measure_power: {
			command_class: 'COMMAND_CLASS_METER',
			command_get: 'METER_GET',
			command_get_parser() {
				return {
					Properties1: {
						'Rate Type': 'Import',
						Scale: 2,
					},
					'Scale 2': 0,
				};
			},
			command_report: 'METER_REPORT',
			command_report_parser: report => {
				if (report.hasOwnProperty('Properties2')
					&& report.Properties2.hasOwnProperty('Scale bits 10')
					&& report.Properties2['Scale bits 10'] === 2) {
					return report['Meter Value (Parsed)'];
				}
				return null;
			},
		},
		'meter_power.normal': {
			multiChannelNodeId: 1,
			command_class: 'COMMAND_CLASS_METER',
			command_get: 'METER_GET',
			command_get_parser() {
				return {
					Properties1: {
						'Rate Type': 'Import',
						Scale: 0,
					},
					'Scale 2': 0,
				};
			},
			command_report: 'METER_REPORT',
			command_report_parser: report => {
				if (report.hasOwnProperty('Properties2')
					&& report.Properties2.hasOwnProperty('Scale bits 10')
					&& report.Properties2['Scale bits 10'] === 0) {
					return report['Meter Value (Parsed)'];
				}
				return null;
			},
		},
		'meter_power.low': {
			multiChannelNodeId: 2,
			command_class: 'COMMAND_CLASS_METER',
			command_get: 'METER_GET',
			command_get_parser() {
				return {
					Properties1: {
						'Rate Type': 'Import',
						Scale: 0,
					},
					'Scale 2': 0,
				};
			},
			command_report: 'METER_REPORT',
			command_report_parser: report => {
				if (report.hasOwnProperty('Properties2')
					&& report.Properties2.hasOwnProperty('Scale bits 10')
					&& report.Properties2['Scale bits 10'] === 0) {
					return report['Meter Value (Parsed)'];
				}
				return null;
			},
		},
		meter_gas: {
			multiChannelNodeId: 3,
			command_class: 'COMMAND_CLASS_METER',
			command_get: 'METER_GET',
			command_get_parser() {
				return {
					Properties1: {
						'Rate Type': 'Import',
						Scale: 0,
					},
					'Scale 2': 0,
				};
			},
			command_report: 'METER_REPORT',
			command_report_parser: report => {
				if (report.hasOwnProperty('Properties2')
					&& report.Properties2.hasOwnProperty('Scale bits 10')
					&& report.Properties2['Scale bits 10'] === 0) {
					return report['Meter Value (Parsed)'];
				}
				return null;
			},
		},
	},
	settings: {
		HW_pullup: {
			index: 3,
			size: 1,
		},
		baud_rate: {
			index: 4,
			size: 2,
		},
		channel_1_unasked_Report_use_w: {
			index: 72,
			size: 4,
		},
		channel_1_unasked_Report_use_kwh: {
			index: 73,
			size: 4,
		},
		channel_1_unasked_Report_returned_w: {
			index: 74,
			size: 4,
		},
		channel_1_unasked_Report_returned_kwh: {
			index: 75,
			size: 4,
		},
		channel_2_unasked_Report_use_w: {
			index: 76,
			size: 4,
		},
		channel_2_unasked_Report_use_kwh: {
			index: 77,
			size: 4,
		},
		channel_2_unasked_Report_returned_w: {
			index: 78,
			size: 4,
		},
		channel_2_unasked_Report_returned_kwh: {
			index: 79,
			size: 4,
		},
		channel_3_unasked_Report_use_w: {
			index: 80,
			size: 4,
		},
		channel_3_unasked_Report_use_kwh: {
			index: 81,
			size: 4,
		},
		channel_3_unasked_Report_returned_w: {
			index: 82,
			size: 4,
		},
		channel_3_unasked_Report_returned_kwh: {
			index: 83,
			size: 4,
		},
	},
});
