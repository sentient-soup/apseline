import Header from 'packages/web/src/components/Header';
import { Box } from '@mui/material';
import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
 
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }
  },
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
				<TanStackRouterDevtools />
			</Box>
		</>
	),
})