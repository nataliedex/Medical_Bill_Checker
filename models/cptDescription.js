const { connectDB } = require("../config/database");

async function getCPTDescriptionFromDB(cptCode) {
  const db = await connectDB();
  const collection = db.collection("cpt_descriptions");

  // Try to find the CPT code
  const doc = await collection.findOne({ cpt_code: cptCode });
  return doc ? doc.description : null;
}

async function saveCPTDescriptionToDB(cptCode, description) {
  const db = await connectDB();
  const collection = db.collection("cpt_descriptions");

  // Upsert (insert if not exists, update if exists)
  await collection.updateOne(
    { cpt_code: cptCode },
    { $set: { description, last_updated: new Date() } },
    { upsert: true }
  );
}

module.exports = { getCPTDescriptionFromDB, saveCPTDescriptionToDB };