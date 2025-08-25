import { CssVarsProvider, StyledEngineProvider } from '@mui/joy/styles';
import { CssBaseline, GlobalStyles } from '@mui/material';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';

import './styles.css';
import { routeTree } from './routeTree.gen';

const router = createRouter({
	routeTree,
	context: {},
	defaultPreload: 'intent',
	scrollRestoration: true,
	defaultStructuralSharing: true,
	defaultPreloadStaleTime: 0,
});

declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router;
	}
}

const rootElement = document.getElementById('app');
if (rootElement && !rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	root.render(
		<StrictMode>
			<CssVarsProvider>
				<CssBaseline />
				<StyledEngineProvider enableCssLayer>
					<GlobalStyles styles="@layer theme, base, mui, components, utilities;" />
					<RouterProvider router={router} />
				</StyledEngineProvider>
			</CssVarsProvider>
		</StrictMode>,
	);
}
