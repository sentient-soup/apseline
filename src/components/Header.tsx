import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Stack from "@mui/joy/Stack";

import { DeviceHub } from "@mui/icons-material";
import ColorSchemeToggle from "./ColorToggle";

export default function Header() {
	return (
		<Box
			component="header"
			className="Header"
			sx={[
				{
					p: 2,
					gap: 2,
					bgcolor: "background.surface",
					display: "flex",
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "center",
					gridColumn: "1 / -1",
					borderBottom: "1px solid",
					borderColor: "divider",
					position: "sticky",
					top: 0,
					zIndex: 1100,
				},
			]}
		>
			<Box
				sx={{ display: "flex", flexGrow: 1, justifyContent: "space-between" }}
			>
				<Stack
					direction="row"
					spacing={1}
					sx={{
						justifyContent: "center",
						alignItems: "center",
						display: { xs: "none", sm: "flex" },
					}}
				>
					<DeviceHub />
					<Button
						variant="plain"
						color="neutral"
						component="a"
						// href="/"
						size="sm"
						sx={{ alignSelf: "center" }}
					>
						Apps
					</Button>
					<Button
						variant="plain"
						color="neutral"
						aria-pressed="true"
						component="a"
						// href="/status"
						size="sm"
						sx={{ alignSelf: "center" }}
					>
						Status
					</Button>
					<Button
						variant="plain"
						color="neutral"
						component="a"
						// href="/"
						size="sm"
						sx={{ alignSelf: "center" }}
					>
						Logs
					</Button>
				</Stack>
				<Box
					sx={{
						display: "flex",
						flexDirection: "row",
						gap: 1.5,
						alignItems: "center",
					}}
				>
					<ColorSchemeToggle />
				</Box>
			</Box>
		</Box>
	);
}
