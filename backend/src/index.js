import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes  from "./routes/auth.routes.js"
import cookieParser from "cookie-parser";
import problemRoutes from "./routes/problem.routes.js";
import executionRoute from "./routes/executeCode.route.js";
import submissionRoute from "./routes/submission.routes.js";
import playlistRoutes from "./routes/playlist.routes.js";
dotenv.config();

const app =express();
app.use(cors({
    origin: process.env.NODE_ENV === "production" ? process.env.CLIENT_URL : "http://localhost:5173",
    credentials: true,
}))
app.use(express.json());
app.use(cookieParser());
app.get("/",(req,res)=>{
res.send("Hello Guys,Welcome to leetlab🔥");
})

import path from "path";
import { fileURLToPath } from "url";

// ... existing code down to routes
app.use("/api/v1/auth",authRoutes);
app.use("/api/v1/problems",problemRoutes);
app.use("/api/v1/execute-code",executionRoute);
app.use("/api/v1/submission", submissionRoute);
app.use("/api/v1/playlist",playlistRoutes);

if (process.env.NODE_ENV === "production") {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    app.use(express.static(path.join(__dirname, "../../frontend/dist")));

    app.get("*", (req, res) => {
        res.sendFile(path.resolve(__dirname, "../../frontend/dist", "index.html"));
    });
}

const PORT = process.env.PORT || 8080;
app.listen(PORT,()=>{
    console.log(`Server is running on port ${PORT}`);
})