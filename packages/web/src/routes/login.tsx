import Alert from '@mui/joy/Alert';
import Box from '@mui/joy/Box';
import Button from '@mui/joy/Button';
import Checkbox from '@mui/joy/Checkbox';
import FormControl from '@mui/joy/FormControl';
import FormLabel from '@mui/joy/FormLabel';
import Input from '@mui/joy/Input';
import Stack from '@mui/joy/Stack';
import Typography from '@mui/joy/Typography';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useAuth } from '../auth';

interface FormElements extends HTMLFormControlsCollection {
  username: HTMLInputElement;
  password: HTMLInputElement;
  persistent: HTMLInputElement;
}
interface SignInFormElement extends HTMLFormElement {
  readonly elements: FormElements;
}

export const Route = createFileRoute('/login')({
  validateSearch: (search) => ({
    redirect: (search.redirect as string) || '/',
  }),
  beforeLoad: ({ context, search }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: search.redirect });
    }
  },
  component: LoginComponent,
});

export default function LoginComponent() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<SignInFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const formElements = event.currentTarget.elements;
    const username = formElements.username.value;
    const password = formElements.password.value;

    try {
      await login(username, password);
      navigate({ to: '/' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        width: { xs: '100%', md: '50vw' },
        transition: 'width var(--Transition-duration)',
        transitionDelay: 'calc(var(--Transition-duration) + 0.1s)',
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        justifyContent: 'flex-end',
        backdropFilter: 'blur(12px)',
        backgroundColor: 'rgba(19 19 24 / 0.4)',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100dvh',
          width: '100%',
          px: 2,
        }}
      >
        <Box
          component="main"
          sx={{
            my: 'auto',
            py: 2,
            pb: 5,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            width: 400,
            maxWidth: '100%',
            mx: 'auto',
            borderRadius: 'sm',
            '& form': {
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            },
            '& .MuiFormLabel-asterisk': {
              visibility: 'hidden',
            },
          }}
        >
          <Stack sx={{ gap: 4, mt: 2 }}>
            <Stack sx={{ gap: 1 }}>
              <Typography component="h1" level="h3">
                Sign in
              </Typography>
              <Typography level="body-sm" color="neutral">
                Enter your username and password to access your account
              </Typography>
            </Stack>

            {error && (
              <Alert color="danger" variant="soft">
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <FormControl required>
                <FormLabel>Username</FormLabel>
                <Input
                  type="text"
                  name="username"
                  disabled={isLoading}
                  placeholder="Enter your username"
                />
              </FormControl>
              <FormControl required>
                <FormLabel>Password</FormLabel>
                <Input
                  type="password"
                  name="password"
                  disabled={isLoading}
                  placeholder="Enter your password"
                />
              </FormControl>
              <Stack sx={{ gap: 4, mt: 2 }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Checkbox
                    size="sm"
                    label="Remember me"
                    name="persistent"
                    disabled={isLoading}
                  />
                </Box>
                <Button
                  type="submit"
                  fullWidth
                  loading={isLoading}
                  disabled={isLoading}
                >
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </Button>
              </Stack>
            </form>
          </Stack>
        </Box>
        <Box component="footer" sx={{ py: 3 }}>
          <Typography level="body-xs" sx={{ textAlign: 'center' }}>
            © Apseline {new Date().getFullYear()}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
