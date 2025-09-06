import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Menu from "@mui/joy/Menu";
import MenuItem from "@mui/joy/MenuItem";
import ListItemDecorator from "@mui/joy/ListItemDecorator";
import ListDivider from "@mui/joy/ListDivider";

import { DeviceHub, AccountCircle, Logout } from "@mui/icons-material";
import ColorSchemeToggle from "./ColorToggle";
import { useAuth } from "../auth";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

export default function Header() {
	const { user, logout } = useAuth();
	const navigate = useNavigate();
	const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
	const open = Boolean(anchorEl);

	const handleClick = (event: React.MouseEvent<HTMLElement>) => {
		setAnchorEl(event.currentTarget);
	};

	const handleClose = () => {
		setAnchorEl(null);
	};

	const handleLogout = async () => {
		await logout();
		navigate({ to: '/login' });
		handleClose();
	};

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
					{user && (
						<>
							<Button
								id="user-menu-button"
								variant="plain"
								color="neutral"
								onClick={handleClick}
								aria-controls={open ? 'user-menu' : undefined}
								aria-haspopup="true"
								aria-expanded={open ? 'true' : undefined}
								startDecorator={<AccountCircle />}
								sx={{ minWidth: 'auto' }}
							>
								<Typography level="body-sm" sx={{ display: { xs: 'none', sm: 'block' } }}>
									{user.username}
								</Typography>
							</Button>
							<Menu
								id="user-menu"
								anchorEl={anchorEl}
								open={open}
								onClose={handleClose}
								aria-labelledby="user-menu-button"
								placement="bottom-end"
							>
								<MenuItem disabled>
									<Typography level="body-sm" color="neutral">
										{user.email}
									</Typography>
								</MenuItem>
								<ListDivider />
								<MenuItem onClick={handleLogout}>
									<ListItemDecorator>
										<Logout />
									</ListItemDecorator>
									Logout
								</MenuItem>
							</Menu>
						</>
					)}
				</Box>
			</Box>
		</Box>
	);
}
