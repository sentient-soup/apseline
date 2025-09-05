import IconButton from "@mui/joy/IconButton";
import Tooltip from "@mui/joy/Tooltip";
import { useColorScheme } from "@mui/joy/styles";
import * as React from "react";

import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";

export default function ColorSchemeToggle() {
	const { mode, setMode } = useColorScheme();
	const [mounted, setMounted] = React.useState(false);
	React.useEffect(() => {
		setMounted(true);
	}, []);
	if (!mounted) {
		return <IconButton size="sm" variant="outlined" color="primary" />;
	}
	return (
		<Tooltip title="Change theme" variant="outlined">
			<IconButton
				data-screenshot="toggle-mode"
				size="sm"
				variant="plain"
				color="neutral"
				sx={{ alignSelf: "center" }}
				onClick={() => {
					if (mode === "light") {
						setMode("dark");
					} else {
						setMode("light");
					}
				}}
			>
				{mode === "light" ? <DarkModeRoundedIcon /> : <LightModeRoundedIcon />}
			</IconButton>
		</Tooltip>
	);
}
