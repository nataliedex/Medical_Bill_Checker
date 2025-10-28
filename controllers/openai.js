const OpenAI = require("openai");
const { getCPTDescriptionFromDB, saveCPTDescriptionToDB } = require("../models/cptDescription");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

module.exports = {
  getTest: async (req, res) => {
    res.json({ message: "GET route is working!" });
  },

  postDescription: async (req, res) => {
    try {
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ error: "Missing 'code' in request body" });
      }

      // 1. Check MongoDB first
      let summary = await getCPTDescriptionFromDB(code);

      // 2. If not in DB, fetch from OpenAI
      if (!summary) {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a medical billing assistant that explains CPT codes in plain language."
            },
            {
              role: "user",
              content: `Explain CPT code ${code} in 1–2 short sentences.`
            }
          ]
        });

        summary = completion.choices[0].message.content;

        // 3. Save new description to MongoDB
        await saveCPTDescriptionToDB(code, summary);
      }

      res.json({ code, summary });

    } catch (err) {
      console.error("Error in /api/describe-cpt:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
};