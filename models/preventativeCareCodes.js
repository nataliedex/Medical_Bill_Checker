const { connectDB } = require("../config/database");

async function isPreventativeCareCode(cptCode) {
  const db = await connectDB();
  const collection = db.collection("preventative_care_cpt");

  // Try to find the CPT code
  const preventative = await collection.findOne({ cpt_code: cptCode });
  return !!preventative;
}

module.exports = { isPreventativeCareCode };