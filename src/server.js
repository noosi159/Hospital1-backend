// src/server.js
import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import "dotenv/config";

const app = express();

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));

app.use(express.json());


app.use(routes);

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () =>
  console.log(`API running on http://localhost:${PORT}`)
);
