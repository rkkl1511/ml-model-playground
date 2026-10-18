import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";

// The proxy forwards /api calls to FastAPI, so the frontend can
// fetch("/api/health") without worrying about CORS or port numbers.
export default defineConfig({
  plugins: [react()
    ],
  server: {
    port: 5173,
    proxy: {
            "/api": "http://localhost:8000",
        },
    },
});