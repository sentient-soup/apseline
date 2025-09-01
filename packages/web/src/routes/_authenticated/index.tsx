import { AppCard } from 'packages/web/src/components/AppCard';
import Stack from '@mui/joy/Stack';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/')({
	component: App,
});

function App() {
	const statuses = [
		{
			name: 'Pi-Hole',
			description: 'DNS sinkhole',
			address: 'https://pi-hole.net/',
			status: 'healthy',
			icon: 'https://raw.githubusercontent.com/pi-hole/graphics/refs/heads/master/Vortex/vortex_with_text.svg',
			domain: 'phis1',
		},
		{
			name: 'Portainer',
			description: 'Kubernetes Management',
			address: 'https://www.portainer.io/',
			status: 'down',
			icon: 'https://res.cloudinary.com/canonical/image/fetch/f_auto,q_auto,fl_sanitize,c_fill,w_200,h_200/https://api.charmhub.io/api/v1/media/download/charm_Owpj9CsDEMZwVtup3ZTxxs0FtyvDqb2o_icon_5cef79c2d18f67464f39c8f2cf2d7ebb815b0071f04d3ffbb94f49fddd3ab666.png',
			domain: 'phis1',
		},
		{
			name: 'Arm Ripper',
			description: 'Bluray/DVD Ripping',
			address:
				'https://github.com/automatic-ripping-machine/automatic-ripping-machine',
			status: 'unknown',
			icon: 'https://b3n.org/wp-content/uploads/2016/07/arm_flowchart_2.avif',
			domain: 'phis1',
		},
		{
			name: 'Jellyfin',
			description: 'Streaming Service',
			address: 'https://jellyfin.org/',
			status: 'healthy',
			icon: 'https://jellyfin.org/images/logo.svg',
			domain: 'phis4',
		},
		{
			name: 'Portfolio',
			description: 'SPA Website',
			address: 'https://aphelion.live/',
			status: 'healthy',
			icon: 'https://pbs.twimg.com/profile_images/1390736294666506242/_D_h6aWq_400x400.png',
			domain: 'phis4',
		},
		{
			name: 'Factorio',
			description: 'Game Server',
			address: 'https://aphelion.live/',
			status: 'healthy',
			icon: 'https://i.redd.it/cxd6h865itp71.png',
			domain: 'ahis1',
		},
		{
			name: 'Apseline',
			description: 'SPA Website',
			address: 'https://aphelion.live/',
			status: 'healthy',
			icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/React_Logo_SVG.svg/640px-React_Logo_SVG.svg.png',
			domain: 'ahis1',
		},
		{
			name: 'Foundry',
			description: 'DnD VTT',
			address: 'https://aphelion.live/dnd',
			status: 'healthy',
			icon: 'https://r2.foundryvtt.com/website-static-public/assets/icons/fvtt.png',
			domain: 'ahis1',
		},
	]
	return (
		<Stack
			direction="row"
			sx={{
				p: 2,
				justifyContent: 'center',
				alignContent: 'flex-start',
				flexWrap: 'wrap',
				overflow: 'auto',
			}}
		>
			{statuses.map((app) => (
				<AppCard key={`status-${app.name}`} app={app} />
			))}
		</Stack>
	)
}
