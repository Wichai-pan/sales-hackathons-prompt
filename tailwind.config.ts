import type { Config } from "tailwindcss";

// Colors are oklch CHANNELS in globals.css; wrap with oklch(... / <alpha-value>)
// so /opacity modifiers (bg-primary/90, border-primary/40, bg-muted/50) keep working.
const c = (v: string) => `oklch(var(${v}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Sora", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        border: c("--border"),
        input: c("--input"),
        ring: c("--ring"),
        background: c("--background"),
        foreground: c("--foreground"),
        elevated: c("--elevated"),
        success: c("--success"),
        warning: c("--warning"),
        info: c("--info"),
        primary: {
          DEFAULT: c("--primary"),
          foreground: c("--primary-foreground"),
          glow: c("--primary-glow"),
        },
        secondary: {
          DEFAULT: c("--secondary"),
          foreground: c("--secondary-foreground"),
        },
        destructive: {
          DEFAULT: c("--destructive"),
          foreground: c("--destructive-foreground"),
        },
        muted: {
          DEFAULT: c("--muted"),
          foreground: c("--muted-foreground"),
        },
        accent: {
          DEFAULT: c("--accent"),
          foreground: c("--accent-foreground"),
        },
        popover: {
          DEFAULT: c("--popover"),
          foreground: c("--popover-foreground"),
        },
        card: {
          DEFAULT: c("--card"),
          foreground: c("--card-foreground"),
        },
        sidebar: {
          DEFAULT: c("--sidebar"),
          foreground: c("--sidebar-foreground"),
          border: c("--sidebar-border"),
        },
        chart: {
          1: c("--chart-1"),
          2: c("--chart-2"),
          3: c("--chart-3"),
          4: c("--chart-4"),
          5: c("--chart-5"),
        },
      },
      borderRadius: {
        sm: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 2px)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
    },
  },
  plugins: [],
};

export default config;
