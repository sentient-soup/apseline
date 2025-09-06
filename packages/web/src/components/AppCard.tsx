import AspectRatio from '@mui/joy/AspectRatio';
import Box from '@mui/joy/Box';
import Card from '@mui/joy/Card';
import CardContent from '@mui/joy/CardContent';
import Chip from '@mui/joy/Chip';
import Typography from '@mui/joy/Typography';
import IconButton from '@mui/joy/IconButton';
import Stack from '@mui/joy/Stack';
import { 
	OpenInNew, 
	AccessTime, 
	Speed, 
	CheckCircle, 
	Error, 
	Warning, 
	Build 
} from '@mui/icons-material';
import type { AppInformation } from './types';

interface AppCardProps {
	app: AppInformation;
}

const getStatusIcon = (status: string) => {
	switch (status) {
		case 'healthy':
			return <CheckCircle sx={{ fontSize: 16 }} />;
		case 'down':
			return <Error sx={{ fontSize: 16 }} />;
		case 'maintenance':
			return <Build sx={{ fontSize: 16 }} />;
		default:
			return <Warning sx={{ fontSize: 16 }} />;
	}
};

const getStatusColor = (status: string) => {
	switch (status) {
		case 'healthy':
			return 'success';
		case 'down':
			return 'danger';
		case 'maintenance':
			return 'warning';
		default:
			return 'neutral';
	}
};

const getDomainColor = (domain: string) => {
	if (domain?.includes('phis')) return 'primary';
	if (domain?.includes('ahis')) return 'success';
	return 'neutral';
};

export function AppCard({ app }: AppCardProps) {
	const statusColor = getStatusColor(app.status);
	const domainColor = getDomainColor(app.domain);
	
	const mockData = {
		uptime: app.uptime || '99.9%',
		lastCheck: app.lastCheck || '2 min ago',
		version: app.version || 'v2.1.4',
		category: app.category || 'Infrastructure',
		responseTime: app.responseTime || Math.floor(Math.random() * 200) + 50,
	};

	return (
		<Card
			variant="outlined"
			sx={{
				width: 320,
				height: 300,
				position: 'relative',
				overflow: 'visible',
				background: 'linear-gradient(135deg, var(--joy-palette-background-surface) 0%, var(--joy-palette-background-level1) 100%)',
				border: '1px solid',
				borderColor: 'divider',
				transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
				':hover': {
					transform: 'translateY(-4px) scale(1.02)',
					boxShadow: '0 12px 24px rgba(0, 0, 0, 0.15)',
					borderColor: 'primary.300',
				},
				cursor: 'pointer',
			}}
			onClick={() => window.open(app.address, '_blank')}
		>
			{/* Status indicator bar */}
			<Box
				sx={{
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					height: 3,
					background: `linear-gradient(90deg, var(--joy-palette-${statusColor}-500) 0%, var(--joy-palette-${statusColor}-300) 100%)`,
				}}
			/>

			<CardContent sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
				{/* Header with icon and status */}
				<Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
						<AspectRatio 
							ratio="1" 
							sx={{ 
								width: 40, 
								height: 40,
								borderRadius: '8px',
								overflow: 'hidden',
								background: 'var(--joy-palette-background-level2)',
								border: '1px solid',
								borderColor: 'divider',
							}}
						>
							<img 
								src={app.icon} 
								loading="lazy" 
								alt={app.name}
								style={{ 
									width: '100%', 
									height: '100%', 
									objectFit: 'contain',
									filter: app.status === 'down' ? 'grayscale(100%)' : 'none',
								}} 
							/>
						</AspectRatio>
						<Box>
							<Typography level="title-sm" sx={{ fontWeight: 'lg', mb: 0.25 }}>
								{app.name}
							</Typography>
							<Typography level="body-xs" color="neutral">
								{mockData.category}
							</Typography>
						</Box>
					</Box>
					
					<Chip
						color={statusColor}
						variant="soft"
						size="sm"
						startDecorator={getStatusIcon(app.status)}
						sx={{ 
							textTransform: 'capitalize',
							fontWeight: 'md',
						}}
					>
						{app.status}
					</Chip>
				</Box>

				{/* Description */}
				<Typography level="body-sm" color="neutral" sx={{ mb: 1, lineHeight: 1.3 }}>
					{app.description}
				</Typography>

				{/* Stats grid */}
				<Box sx={{ 
					display: 'grid', 
					gridTemplateColumns: '1fr 1fr', 
					gap: 1, 
					mb: 1,
					flex: 1,
				}}>
					<Stack direction="row" spacing={0.5} alignItems="center">
						<AccessTime sx={{ fontSize: 14, color: 'var(--joy-palette-neutral-500)' }} />
						<Box>
							<Typography level="body-xs" color="neutral">
								Uptime
							</Typography>
							<Typography level="body-sm" sx={{ fontWeight: 'md' }}>
								{mockData.uptime}
							</Typography>
						</Box>
					</Stack>
					
					<Stack direction="row" spacing={0.5} alignItems="center">
						<Speed sx={{ fontSize: 14, color: 'var(--joy-palette-neutral-500)' }} />
						<Box>
							<Typography level="body-xs" color="neutral">
								Response
							</Typography>
							<Typography level="body-sm" sx={{ fontWeight: 'md' }}>
								{mockData.responseTime}ms
							</Typography>
						</Box>
					</Stack>
				</Box>

				{/* Footer with domain and action */}
				<Box sx={{ 
					display: 'flex', 
					justifyContent: 'space-between', 
					alignItems: 'center',
					pt: 1,
					borderTop: '1px solid',
					borderColor: 'divider',
				}}>
					<Chip 
						color={domainColor} 
						variant="outlined" 
						size="sm"
						sx={{ fontWeight: 'md' }}
					>
						{app.domain}
					</Chip>
					
					<IconButton
						size="sm"
						variant="plain"
						color="neutral"
						sx={{ 
							'--IconButton-size': '24px',
							opacity: 0.7,
							':hover': { opacity: 1 },
						}}
					>
						<OpenInNew sx={{ fontSize: 16 }} />
					</IconButton>
				</Box>
			</CardContent>
		</Card>
	);
}
