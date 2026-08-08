import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import cookieParser from "cookie-parser";
import problemRoutes from "./routes/problem.routes.js";
import executionRoute from "./routes/executeCode.route.js";
import submissionRoute from "./routes/submission.routes.js";
import playlistRoutes from "./routes/playlist.routes.js";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();

app.use(cors({
    origin: process.env.NODE_ENV === "production" ? process.env.CLIENT_URL : "http://localhost:5173",
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// API routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/problems", problemRoutes);
app.use("/api/v1/execute-code", executionRoute);
app.use("/api/v1/submission", submissionRoute);
app.use("/api/v1/playlist", playlistRoutes);

// Health check — only used in development
if (process.env.NODE_ENV !== "production") {
    app.get("/", (req, res) => {
        res.send("Hello Guys,Welcome to leetlab🔥");
    });
}

// Serve frontend in production
if (process.env.NODE_ENV === "production") {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const frontendDist = path.join(__dirname, "../../frontend/dist");

    app.use(express.static(frontendDist));

    // Catch-all: send index.html for any non-API route (React Router)
    app.get("/{*path}", (req, res) => {
        res.sendFile(path.resolve(frontendDist, "index.html"));
    });
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
