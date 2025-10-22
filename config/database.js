const { MongoClient } = require("mongodb");
require("dotenv").config({ path: "./config/.env" });

let cachedDb = null;

async function connectDB() {
  if (cachedDb) return cachedDb;

  const uri = process.env.DB_STRING;
  if(!uri) throw new Error("DB_STRING not found in .env");

  const client = new MongoClient(uri);
  await client.connect();

  cachedDb = client.db("medbilling"); 
  console.log("Connected to MongoDB");
  return cachedDb;
}

module.exports = { connectDB };