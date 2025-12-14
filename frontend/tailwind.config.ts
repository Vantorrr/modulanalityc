import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#35BA5D',
          500: '#35BA5D',  // Основной цвет #35BA5D
          600: '#2a9e4a',
          700: '#22803d',
          800: '#1a6230',
          900: '#124423',
        },
      },
    },
  },
  plugins: [],
};
export default config;


