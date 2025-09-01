import { CssVarsProvider, StyledEngineProvider } from '@mui/joy/styles';
import { CssBaseline, GlobalStyles } from '@mui/material';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';

import './styles.css';
import App from './app';

const rootElement = document.getElementById('app');
if (rootElement && !rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	root.render(
		<StrictMode>
			<CssVarsProvider>
				<CssBaseline />
				<StyledEngineProvider enableCssLayer>
					<GlobalStyles styles="@layer theme, base, mui, components, utilities;" />
					<App />
				</StyledEngineProvider>
			</CssVarsProvider>
		</StrictMode>,
	);
}
