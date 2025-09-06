import { createFileRoute } from '@tanstack/react-router';
import { AppCard } from '@/components/AppCard';
import Box from '@mui/joy/Box';

export const Route = createFileRoute('/_authenticated/')({
	component: App,
});

function App() {
	const statuses = [
		{
			name: 'Pi-Hole',
			description: 'DNS sinkhole and ad blocker for your network',
			address: 'https://pi-hole.net/',
			status: 'healthy' as const,
			icon: 'https://raw.githubusercontent.com/pi-hole/graphics/refs/heads/master/Vortex/vortex_with_text.svg',
			domain: 'phis1',
			uptime: '99.9%',
			version: 'v5.17.2',
			category: 'Network',
			responseTime: 12,
		},
		{
			name: 'Portainer',
			description: 'Container management platform for Kubernetes',
			address: 'https://www.portainer.io/',
			status: 'down' as const,
			icon: 'https://res.cloudinary.com/canonical/image/fetch/f_auto,q_auto,fl_sanitize,c_fill,w_200,h_200/https://api.charmhub.io/api/v1/media/download/charm_Owpj9CsDEMZwVtup3ZTxxs0FtyvDqb2o_icon_5cef79c2d18f67464f39c8f2cf2d7ebb815b0071f04d3ffbb94f49fddd3ab666.png',
			domain: 'phis1',
			uptime: '0%',
			version: 'v2.19.4',
			category: 'Infrastructure',
			responseTime: 0,
		},
		{
			name: 'Arm Ripper',
			description: 'Automatic Blu-ray and DVD ripping machine',
			address: 'https://github.com/automatic-ripping-machine/automatic-ripping-machine',
			status: 'maintenance' as const,
			icon: 'https://b3n.org/wp-content/uploads/2016/07/arm_flowchart_2.avif',
			domain: 'phis1',
			uptime: '98.2%',
			version: 'v2.2.0',
			category: 'Media',
			responseTime: 156,
		},
		{
			name: 'Jellyfin',
			description: 'Open-source media server and streaming platform',
			address: 'https://jellyfin.org/',
			status: 'healthy' as const,
			icon: 'https://jellyfin.org/images/logo.svg',
			domain: 'phis4',
			uptime: '99.7%',
			version: 'v10.8.13',
			category: 'Media',
			responseTime: 89,
		},
		{
			name: 'Portfolio',
			description: 'Personal portfolio and project showcase',
			address: 'https://aphelion.live/',
			status: 'healthy' as const,
			icon: 'https://pbs.twimg.com/profile_images/1390736294666506242/_D_h6aWq_400x400.png',
			domain: 'phis4',
			uptime: '99.8%',
			version: 'v1.2.1',
			category: 'Web',
			responseTime: 45,
		},
		{
			name: 'Factorio',
			description: 'Dedicated game server for Factorio multiplayer',
			address: 'https://aphelion.live/',
			status: 'healthy' as const,
			icon: 'https://i.redd.it/cxd6h865itp71.png',
			domain: 'ahis1',
			uptime: '99.5%',
			version: 'v1.1.103',
			category: 'Gaming',
			responseTime: 23,
		},
		{
			name: 'Apseline',
			description: 'Home lab monitoring and management dashboard',
			address: 'https://aphelion.live/',
			status: 'healthy' as const,
			icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/React_Logo_SVG.svg/640px-React_Logo_SVG.svg.png',
			domain: 'ahis1',
			uptime: '100%',
			version: 'v1.0.0',
			category: 'Monitoring',
			responseTime: 34,
		},
		{
			name: 'Foundry',
			description: 'Virtual tabletop for D&D and other RPGs',
			address: 'https://aphelion.live/dnd',
			status: 'healthy' as const,
			icon: 'https://r2.foundryvtt.com/website-static-public/assets/icons/fvtt.png',
			domain: 'ahis1',
			uptime: '99.3%',
			version: 'v11.315',
			category: 'Gaming',
			responseTime: 67,
		},
	]
	return (
		<Box
			sx={{
				p: 2,
				display: 'grid',
				gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
				gap: 2,
				justifyItems: 'center',
				overflow: 'auto',
				height: '100%',
			}}
		>
			{statuses.map((app) => (
				<AppCard key={`status-${app.name}`} app={app} />
			))}
		</Box>
	)
}
