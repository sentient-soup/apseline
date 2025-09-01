import AspectRatio from '@mui/joy/AspectRatio';
import Box from '@mui/joy/Box';
import Card from '@mui/joy/Card';
import CardContent from '@mui/joy/CardContent';
import CardOverflow from '@mui/joy/CardOverflow';
import Chip from '@mui/joy/Chip';
import Typography from '@mui/joy/Typography';
import type { AppInformation } from './types';

interface AppCardProps {
	app: AppInformation;
}

export function AppCard({ app }: AppCardProps) {
	return (
		<Card
			orientation="horizontal"
			variant="outlined"
			sx={{
				m: 1,
				width: 260,
				height: 90,
				':hover': {
					transform: 'scale(1.02)',
				},
				cursor: 'pointer',
			}}
			onClick={() => window.open(app.address, '_blank')}
		>
			<CardOverflow>
				<AspectRatio objectFit="contain" ratio="1" sx={{ width: 90 }}>
					<img src={app.icon} loading="lazy" alt={app.name} />
				</AspectRatio>
			</CardOverflow>
			<CardContent>
				<Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
					<Typography sx={{ fontWeight: 'md' }}>{app.name}</Typography>
					<Chip color={app.domain?.includes('phis') ? 'primary' : 'warning'}>
						{app.domain}
					</Chip>
				</Box>
				<Typography level="body-sm">{app.description}</Typography>
			</CardContent>
			<CardOverflow
				variant="soft"
				color={
					app.status === 'healthy'
						? 'success'
						: app.status === 'down'
							? 'danger'
							: 'warning'
				}
				sx={{
					px: 0.2,
					writingMode: 'vertical-rl',
					justifyContent: 'center',
					fontSize: 'xs',
					fontWeight: 'xl',
					letterSpacing: '1px',
					textTransform: 'uppercase',
					borderLeft: '1px solid',
					borderColor: 'divider',
				}}
			>
				{app.status}
			</CardOverflow>
		</Card>
	);
}
