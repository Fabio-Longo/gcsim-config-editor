import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base: the build works from any subpath, e.g. https://<user>.github.io/<repo>/.
export default defineConfig({ base: "./", plugins: [react()] });
