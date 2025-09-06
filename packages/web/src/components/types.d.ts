export interface AppInformation {
	name: string;
	description: string;
	address: string;
	status: 'healthy' | 'down' | 'unknown' | 'maintenance';
	icon: string;
	domain: string;
	uptime?: string;
	lastCheck?: string;
	version?: string;
	category?: string;
	responseTime?: number;
}
