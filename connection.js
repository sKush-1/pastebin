import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: 3306,
  multipleStatements: true,
};

// console.log(dbConfig);

let Mysql_Connection;

async function initDB() {
  try {
    Mysql_Connection = await mysql.createConnection(dbConfig);
    console.log(`Connected to DB ${process.env.DB_NAME}`);
  } catch (err) {
    console.error("Database connection failed:", err);
  }
}

await initDB(); // Use top-level await if in an ES module context

export { Mysql_Connection };
