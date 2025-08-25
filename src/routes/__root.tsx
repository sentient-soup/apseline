import Header from '@/components/Header';
import { Box } from '@mui/material';
import { Outlet, createRootRoute } from '@tanstack/react-router';

export const Route = createRootRoute({
	component: () => (
		<>
			<Box
				id="body"
				sx={{
					bgcolor: 'background.appBody',
					display: 'grid',
					gridTemplateRows: '64px 1fr',
					height: '100vh',
					width: 1,
				}}
			>
				<Header />
				<Outlet />
			</Box>
		</>
	),
});
