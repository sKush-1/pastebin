import express from "express";
import crypto from "crypto";
import "./connection.js";
import redisClient from "./redis.js";
import { Mysql_Connection } from "./connection.js";

const app = express();
app.use(express.json());
const port = 3000;

Mysql_Connection;

// Generate MD5 hash from IP + timestamp
function generateUniqueHash(ip) {
  const timestamp = Date.now();
  const combinedString = `${ip}-${timestamp}`;
  return crypto.createHash("md5").update(combinedString).digest("hex");
}

app.get("/", (req, res) => {
  res.status(200).json({
    message: "server is up!",
  });
});

app.post("/paste", async (req, res) => {
  const { text, expiry } = req.body;

  if (!text || !text.length) {
    return res.status(400).json({
      message: "Text is empty!",
    });
  }

  try {
    const unique_hash = generateUniqueHash(req.ip);
    const insertQuery = `
      INSERT INTO pastes (text,unique_hash, expiry)
      VALUES (?, ?, ?)
    `;

    const expTime = new Date(Date.now() + expiry * 60 * 1000);
    const timestamp = Date.now();
    const [result] = await Mysql_Connection.execute(insertQuery, [
      text,
      unique_hash,
      expTime,
    ]);

    const insertedId = result.insertId;

    return res.status(200).json({
      message: "Paste created successfully!",
      text_link: `http://localhost:${port}/paste/${unique_hash}`,
    });
  } catch (err) {
    console.error("DB Insert Error:", err);
    return res.status(500).json({
      message: "Failed to save pastebin content.",
      error: err.message || err,
    });
  }
});

app.get("/paste/:hash_id", async (req, res) => {
  const { hash_id } = req.params;
  // console.log("params: ", hash_id);

  // 1. Try Redis cache first
  try {
    const cached = await redisClient.get(`paste:${hash_id}`);
    if (cached) {
      return res.json({
        source: "cache",
        data: JSON.parse(cached),
      });
    }
  } catch (err) {
    console.error("Cache read error:", err);
  }

  // 2. Fallback to MySQL
  try {
    const [result] = await Mysql_Connection.execute(
      `SELECT text, expiry FROM pastes
       WHERE unique_hash = ?
       AND (expiry IS NULL OR FROM_UNIXTIME(expiry) > NOW())`,
      [hash_id],
    );

    // console.log("result: ", result);

    if (!result.length) return res.status(404).json({ error: "Not found" });

    // 3. Cache in Redis (TTL = remaining expiry or 24h)
    let ttl = 86400; // default 24h

    if (result[0].expiry) {
      const expiryTimestamp = new Date(result[0].expiry * 1000).getTime(); // FIX HERE
      const now = Date.now();
      const remainingSeconds = Math.floor((expiryTimestamp - now) / 1000);

      if (remainingSeconds > 0) {
        ttl = remainingSeconds;
      }
    }

    // console.log("ttl: ", ttl);
    await redisClient.setEx(`paste:${hash_id}`, ttl, JSON.stringify(result[0]));

    return res.json({
      source: "database",
      data: result[0],
    });
  } catch (err) {
    console.error("Database error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
});

const startServer = async () => {
  try {
    // Wait for DB connection (optional, since initDB() is called in connection.js)
    app.listen(port, () => {
      console.log(`Express app is listening on port: ${port}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
  }
};

startServer();
