import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import "dotenv/config";

const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use((req, res, next) => {
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json());
app.use(routes);

app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
