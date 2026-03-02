import dotenv from "dotenv";
import { API_PORT } from "./config/env.js";
import { createApp } from "./app/createApp.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

const app = createApp();

app.listen(API_PORT, () => {
  console.log(`ORIGO admin API listening on http://localhost:${API_PORT}`);
});
