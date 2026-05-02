/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Perihelion (Homelab) - Sophisticated warm
        perihelion: {
          primary: '#EC4899',    // Pink
          secondary: '#F472B6',  // Light pink
          accent: '#FB7185',     // Rose
          glow: 'rgba(236, 72, 153, 0.2)',
        },
        // Aphelion (Cloud) - Sophisticated cool
        aphelion: {
          primary: '#8B5CF6',    // Purple
          secondary: '#A78BFA',  // Light purple
          accent: '#6366F1',     // Indigo
          glow: 'rgba(139, 92, 246, 0.2)',
        },
        // Neutral - Darker, more sophisticated
        themed: {
          bg:         'var(--color-bg)',
          perihelion: 'var(--color-perihelion)',
          aphelion:   'var(--color-aphelion)',
          cloudflare: 'var(--color-cloudflare)',
          gce:        'var(--color-gce)',
          warn:       'var(--color-warn)',
          alerts:     'var(--color-alerts)',
        },
        space: {
          background: '#0F0F1E',  // Very dark navy
          surface: '#1A1A2E',     // Dark surface
          card: '#252541',        // Card background
          border: 'rgba(255, 255, 255, 0.05)',
          text: {
            primary: '#FFFFFF',
            secondary: 'rgba(255, 255, 255, 0.6)',
            muted: 'rgba(255, 255, 255, 0.4)',
          },
        },
      },
      animation: {
        'orbit-slow': 'orbit 20s linear infinite',
        'orbit-medium': 'orbit 15s linear infinite',
        'orbit-fast': 'orbit 10s linear infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.5s ease-out',
        'slide-down': 'slide-down 0.5s ease-out',
        'shimmer': 'shimmer 3s linear infinite',
        'bounce-slow': 'bounce 3s infinite',
        'spin-slow': 'spin 3s linear infinite',
        'scale-pulse': 'scale-pulse 2s ease-in-out infinite',
      },
      keyframes: {
        orbit: {
          '0%': { transform: 'rotate(0deg) translateX(100px) rotate(0deg)' },
          '100%': { transform: 'rotate(360deg) translateX(100px) rotate(-360deg)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px var(--glow-color)' },
          '50%': { boxShadow: '0 0 40px var(--glow-color)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-100% 0' },
          '100%': { backgroundPosition: '100% 0' },
        },
        'scale-pulse': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
