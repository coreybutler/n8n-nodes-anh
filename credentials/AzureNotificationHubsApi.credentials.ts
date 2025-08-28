import {
	Icon,
	ICredentialType,
	INodeProperties,
	ICredentialTestRequest,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { NotificationHubsClient } from '@azure/notification-hubs';

export class AzureNotificationHubsApi implements ICredentialType {
	name = 'azureNotificationHubsApi';
	displayName = 'Azure Notification Hubs API';
	documentationUrl = 'https://github.com/coreybutler/n8n-nodes-anh#credentials';
	icon: Icon = { light: 'file:anh.svg', dark: 'file:anh.svg' };

	properties: INodeProperties[] = [
		{
			displayName: 'Hub Name',
			name: 'azHubName',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'my-notification-hub',
			description: 'The name of the Azure Notification Hub.',
			hint: 'Go to <b><a href="https://portal.azure.com/" target="_blank">Azure Portal</a></b> → <b>Notification Hubs</b> → <i>select your hub</i> → <b>Overview</b> → <i>copy the Hub Name</i>.',
		},
		{
			displayName: 'Connection String',
			name: 'connectionString',
			type: 'string',
			default: '',
			required: true,
			// typeOptions: {
			//   password: true,
			// },
			placeholder:
				'Endpoint=sb://<namespace>.servicebus.windows.net/;SharedAccessKeyName=DefaultFullSharedAccessSignature;SharedAccessKey=2xYP...XIE=',
			description: 'The connection string for your Azure Notification Hub.',
			hint: 'Go to <b><a href="https://portal.azure.com/" target="_blank">Azure Portal</a></b> → <b>Notification Hubs</b> → <i>select your namespace</i> → <i>select your hub</i> → <b>Access Policies</b> → <i>copy the connection string</i>.',
		},
		{
			displayName:
				'<b>PERMISSIONS</b><br/>The access policy for your connection string must have <code>Manage</code> and <code>Send</code> permissions to use the Azure Notification Hubs node.',
			name: 'credNote',
			type: 'notice',
			default: '',
		},
	];

	// Use the function form of `authenticate` (IAuthenticate) so n8n will call it with credentials and requestOptions
	authenticate = async (
		credentials: any,
		requestOptions?: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> => {
		const connectionString = credentials?.connectionString as string;

		// Parse the connection string to get the necessary components
		const connectionParts = (connectionString ?? '').split(';').reduce(
			(acc, part) => {
				const [key, value] = part.split('=').map((s) => s.trim());
				if (key && value) {
					acc[key] = value;
				}
				return acc;
			},
			{} as Record<string, string>,
		);

		let endpoint = connectionParts.Endpoint ?? '';
		const hubName = credentials.azHubName ?? connectionParts.Hub ?? '';
		const sharedAccessKeyName = connectionParts.SharedAccessKeyName;
		const sharedAccessKey = connectionParts.SharedAccessKey;

		// Validate required components before using them
		if (!endpoint || !hubName || !sharedAccessKeyName || !sharedAccessKey) {
			throw new Error(
				`Invalid connection string. Must include Hub ("${hubName ?? ''}"), Endpoint ("${endpoint ?? 'none'}"), SharedAccessKeyName ("${sharedAccessKeyName}"), and SharedAccessKey ("${sharedAccessKey}").`,
			);
		}

		endpoint = endpoint.replace('sb://', 'https://');

		requestOptions = requestOptions ?? ({ headers: {} } as IHttpRequestOptions);
		requestOptions.baseURL = endpoint;
		requestOptions.headers = requestOptions.headers ?? {};
		// (requestOptions.headers as Record<string, string>)['Authorization'] = sasToken;

		const conn = connectionString.replace(`Hub=${hubName};`, '');
		// console.log({conn, hubName})

		try {
			const client = new NotificationHubsClient(conn, hubName);
			const registrations = client.listRegistrations();
			const iterator = registrations.byPage({ maxPageSize: 1 });
			await iterator.next();
		} catch (err) {
			switch (err.statusCode) {
				case 403:
					throw new Error(
						'Access denied (remember to check your access policies to assure Manage and Send permissions are granted)',
					);
				case 401:
					throw new Error(
						'Invalid credentials (remember to prefix the connection string with "Hub=my_namespace;")',
					);
				default:
					throw new Error(`Could not validate credentials: ${err.message}`);
			}
		}

		// console.warn({ requestOptions })
		return requestOptions;
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseURL}}',
			url: '',
		},
	};
}

// function generateSasToken(uri: string, keyName: string, key: string): string {
//   const expiry = Math.floor(Date.now() / 1000) + 3600; // Token valid for one hour
//   const stringToSign = `${encodeURIComponent(uri)}\n${expiry}`;
//   const hmac = crypto.createHmac('sha256', key);
//   hmac.update(stringToSign);
//   const signature = hmac.digest('base64');
//   const token = `SharedAccessSignature sig=${encodeURIComponent(signature)}&se=${expiry}&skn=${keyName}&sr=${encodeURIComponent(uri)}`;
//   return token;
// }
