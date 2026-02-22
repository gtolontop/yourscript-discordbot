import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        discord: {
          dark: "#1e1f22",
          darker: "#111214",
          card: "#2b2d31",
          border: "#3f4147",
          text: "#dbdee1",
          muted: "#949ba4",
          blurple: "#5865f2",
          green: "#57f287",
          yellow: "#fee75c",
          red: "#ed4245",
          fuchsia: "#eb459e",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
