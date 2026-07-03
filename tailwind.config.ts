import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'ui-sans-serif', 'system-ui']
      },
      colors: {
        obsidian: '#050A13',
        night: '#081B33',
        azure: '#009CFF',
        electric: '#00B8FF',
        cold: '#F4F8FB',
        metal: '#8A96A8',
        alert: '#FF2E2E',
        operational: '#00D084',
        incident: '#FF9F1C'
      },
      boxShadow: {
        premium: '0 20px 80px rgba(0, 156, 255, 0.10)'
      }
    }
  },
  plugins: []
};

export default config;
