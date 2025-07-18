import { createClient } from "redis";

const redisClient = createClient({
  url: `redis://localhost:${process.env.REDIS_PORT}`,
});

redisClient.on("error", (err) => console.error("Redis error:", err));

(async () => {
  await redisClient.connect();
  console.log("Redis connected");
})();

export default redisClient;
