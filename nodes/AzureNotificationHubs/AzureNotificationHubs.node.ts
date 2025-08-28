import {
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IExecuteFunctions,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';

import { NotificationHubsClient, createTemplateNotification } from '@azure/notification-hubs';

export class AzureNotificationHubs implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Azure Notification Hubs',
		name: 'azureNotificationHubs',
		icon: 'file:anh.svg',
		group: ['input'],
		version: 1,
		description: 'Sends notifications to an Azure Notification Hub',
		defaults: {
			name: 'Azure Notification Hubs',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		// usableAsTool: true,
		credentials: [
			{
				name: 'azureNotificationHubsApi',
				required: true,
				// This links the node to a test function on the credential itself.
				// This is only necessary for custom credential types.
				// testedBy: 'testConnection',
			},
		],
		properties: [
			{
				displayName: 'Send Type',
				name: 'sendType',
				type: 'options',
				options: [
					{
						name: 'Audience',
						value: 'audienceSend',
						description: 'Sends to a specific audience using tags',
					},
					{
						name: 'Broadcast',
						value: 'broadcastSend',
						description: 'Sends to all registered devices',
					},
					{
						name: 'Direct',
						value: 'directSend',
						description: 'Sends to a specific device handle',
					},
					{
						name: 'Scheduled',
						value: 'scheduledSend',
						description: 'Sends at a specified future time',
					},
				],
				default: 'broadcastSend',
				required: true,
				description: 'Select the method for sending notifications',
			},
			{
				displayName: 'Send Time',
				name: 'schedule',
				type: 'dateTime',
				default: '',
				description: 'The date and time to send the notification',
				required: true,
				displayOptions: {
					show: {
						sendType: ['scheduledSend'],
					},
				},
			},
			{
				displayName: 'Platform',
				name: 'platform',
				type: 'options',
				default: 'all',
				options: [
					{ name: 'All Registered Platforms', value: 'all' },
					// { name: 'Apple (APNS)', value: 'apns' },
					// { name: 'Firebase (FCM)', value: 'fcm' },
					// { name: 'Windows (WNS)', value: 'wns' },
					// { name: 'Microsoft Phone (MPNS)', value: 'mpns' },
					// { name: 'Amazon (ADM)', value: 'adm' },
					// { name: 'Baidu', value: 'baidu' },
					// { name: 'Browser (Web Push)', value: 'webpush' },
				],
				description:
					'Select the target platform(s) for the notification. Selecting all will send to all registered devices on all platforms configured in the notification hub.',
			},
			{
				displayName: 'Audience Tags',
				name: 'tags',
				type: 'string',
				default: [''],
				description:
					'Tags to to identifiy notification subscribers. Accepts one or more individual entries, comma-separated lists, and tag expressions. Each item is treated as a group.',
				displayOptions: {
					show: {
						sendType: ['audienceSend', 'scheduledSend'],
					},
				},
				typeOptions: {
					multipleValues: true,
				},
				placeholder: 'Add specific tag, list, or expression',
			},
			{
				displayName: 'Device Handle',
				name: 'deviceHandle',
				type: 'string',
				default: '',
				description: 'The device handle to send the notification to',
				required: true,
				displayOptions: {
					show: {
						sendType: ['directSend'],
					},
				},
			},
			{
				displayName: 'Use Raw Message',
				name: 'raw',
				type: 'boolean',
				default: true,
			},
			{
				displayName: 'Template Data (JSON)',
				name: 'templateData',
				type: 'string',
				default: '',
				required: true,
				description: 'Provide the JSON data to be applied to the notification template',
				displayOptions: {
					show: {
						raw: [true],
					},
				},
				typeOptions: {
					rows: 10,
					alwaysOpenEditWindow: true,
				},
			},
			{
				displayName:
					"<b>NOTICE:</b><br/>At this time, only raw notifications are supported. There are many options available for configuring notifications. I tried to implement them in the GUI, but I simply don't have the time to build everything. This module will be updated as time allows.<br/><br/><b>These settings are placeholders - THEY DO NOT WORK!</b>",
				name: 'warning',
				type: 'notice',
				default: '',
				displayOptions: {
					show: {
						raw: [false],
					},
				},
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The title of the notification',
				noDataExpression: true, // remove when this is actually supported
				displayOptions: {
					show: {
						raw: [false],
					},
				},
			},
			{
				displayName: 'Subtitle',
				name: 'subtitle',
				type: 'string',
				default: '',
				noDataExpression: true, // remove when this is actually supported
				description: 'Optional subtitle for the notification',
				displayOptions: {
					show: {
						raw: [false],
						platform: ['apns'],
					},
				},
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				default: '',
				description: 'The message of the notification',
				noDataExpression: true, // remove when this is actually supported
				displayOptions: {
					show: {
						raw: [false],
					},
				},
			},
			{
				displayName: 'Icon',
				name: 'icon',
				type: 'string',
				default: '',
				noDataExpression: true, // remove when this is actually supported
				description: 'The icon to display for the notification',
				displayOptions: {
					show: {
						raw: [false],
					},
				},
			},
			{
				displayName: 'Play Sound',
				name: 'playSound',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						raw: [false],
					},
				},
			},
			{
				displayName: 'Sound Name',
				name: 'sound',
				type: 'string',
				default: 'default',
				noDataExpression: true, // remove when this is actually supported
				description: 'The sound to play for the notification',
				displayOptions: {
					show: {
						raw: [false],
						playSound: [true],
					},
				},
			},
			{
				displayName: 'Include Custom Data',
				name: 'useCustomData',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						raw: [false],
					},
				},
			},
			{
				displayName: '',
				name: 'customData',
				type: 'string',
				default: '',
				noDataExpression: true, // remove when this is actually supported
				placeholder: 'Custom data included in the notification payload...',
				typeOptions: {
					rows: 6,
					alwaysOpenEditWindow: true,
				},
				displayOptions: {
					show: {
						useCustomData: [true],
						raw: [false],
					},
				},
			},

			// {
			// 	displayName: 'Options',
			// 	name: 'options',
			// 	type: 'fixedCollection',
			// 	default: {},
			// 	placeholder: 'Add Option',
			// 	options: [{
			// 		name: 'testing',
			// 		displayName: 'Testing',
			// 		values: [{
			// 			name: 'testMode',
			// 			displayName: 'Dry Run',
			// 			type: 'boolean',
			// 			default: false,
			// 			description: 'When enabled, the node will perform a dry-run and return the constructed payload instead of sending notifications.',
			// 		}],
			// 	}, {
			// 		name: 'processing',
			// 		displayName: 'Processing',
			// 		displayOptions: {
			// 			show: {
			// 				platform: ['apns'],
			// 			},
			// 		},
			// 		values: [{
			// 			name: 'processingMode',
			// 			displayName: 'Modifiable',
			// 			type: 'boolean',
			// 			default: false,
			// 			description: 'Enables mutable content, allowing the client to modify the push notification\'s content on the user device before it is displayed.',
			// 		}],
			// 	}]
			// },
		],
	};

	// methods = {
	// };

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		// const items = this.getInputData(); // input items
		const { azHubName, connectionString } = (await this.getCredentials(
			'azureNotificationHubsApi',
		)) as any;
		const client = new NotificationHubsClient(connectionString, azHubName);
		// const inputs = this.getNodeInputs();
		const sendType = this.getNodeParameter('sendType', 0) as string;
		const payload = this.getNodeParameter('templateData', 0, '') as string;
		const notification = createTemplateNotification(JSON.parse(payload));
		const returnData: INodeExecutionData[] = [];

		// Capture audience tags if present
		const rawtags = this.getNodeParameter('tags', 0, []) as Array<string>;
		const tags = [];
		const opts: any = {};

		for (const group of rawtags) {
			const items = group
				.trim()
				.split(',')
				.map((i) => i.trim())
				.filter((i) => i.length > 0);
			if (items.length > 0) {
				tags.push(`(${items.join(' || ')})`);
			}
		}

		if (tags.length > 0) {
			opts.tagExpression = tags.join(' || ');
		}

		let res
		switch (sendType) {
			case 'directSend':
				const deviceHandle = (this.getNodeParameter('deviceHandle', 0, '') as string).trim();
				try {
					res = await client.sendNotification(notification, { deviceHandle });
				} catch (err: any) {
					if ((err.message as string).toLowerCase().includes('must include handle')) {
						if (deviceHandle && deviceHandle.length > 0) {
							throw new Error('Device handle is not registered with the Azure Notification Hub.') as NodeOperationError;
						} else {
							throw new Error('Missing device handle. Provide one in the Device Handle input field.') as NodeOperationError;
						}
					}
					throw err;
				}
				break;
			case 'audienceSend':
				if (!opts || !opts.tagExpression || opts.tagExpression.length === 0) {
					throw new Error('At least one audience tag/expression must be specified for audience sends. If you wish to send to all devices, use the Broadcast send option instead,') as NodeOperationError;
				}
				res = await client.sendNotification(notification, opts);
				break;
			case 'broadcastSend':
				res = await client.sendBroadcastNotification(notification);
				break;
			case 'scheduledSend':
				const scheduleTime = new Date(this.getNodeParameter('schedule', 0, '') as string);
				const now = new Date();

				if (scheduleTime < now) {
					throw new Error('Scheduled time must be in the future.') as NodeOperationError;
				}

				res = await client.scheduleNotification(scheduleTime, notification, opts);
		}

		let correlationId, trackingId, successCount, failureCount, results, state, notificationId;
		if (res) {
			({ correlationId, trackingId, successCount, failureCount, results, state, notificationId } = res);
		}

		const result: INodeExecutionData = {
			json: {
				correlationId,
				trackingId,
				notificationId: notificationId ?? null,
				successCount,
				failureCount,
				results,
				state,
			},
			// json: {
			// 	credentials: {
			// 		azHubName,
			// 		connectionString
			// 	},
			// 	inputs,
			// 	sendType,
			// 	payload,
			// 	notification,
			// 	client,
			// 	tags,
			// 	opts,
			// 	res
			// }
		};

		returnData.push(result);

		return [returnData];
	}
}
