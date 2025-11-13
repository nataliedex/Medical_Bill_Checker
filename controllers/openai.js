const OpenAI = require("openai");
const { getCPTDescriptionFromDB, saveCPTDescriptionToDB } = require("../models/cptDescription");
const { isPreventativeCareCode } = require("../models/preventativeCareCodes");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

module.exports = {
  
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
        const isPreventative = await isPreventativeCareCode(code);
        const prompt = `Provide a plain-language description of the procedure for CPT code ${code} in 1–2 short sentences. Do not include the CPT code or the word CPT in the description.`;
        
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a medical billing assistant that explains CPT codes in plain language."
            },
            {
              role: "user",
              content: prompt
            }
          ]
        });

        let description = completion.choices[0].message.content;
        if(isPreventative) {
            description = `This is a preventative care procedure. ${description}`;
        }

        summary = description;

        // 3. Save new description to MongoDB
        await saveCPTDescriptionToDB(code, summary);
      }

      res.json({ code, summary });

    } catch (err) {
      console.error("Error in /api/describe-cpt:", err);
      res.status(500).json({ error: "Server error" });
    }
  },

  postVisitSummary: async (req, res) => {
    try {
      const { codes } = req.body;
      if (!codes || !codes.length) return res.status(400).json({ summary: "No CPT codes provided." });

      const prompt = `Summarize a patient visit for these CPT codes in 6-10 sentences, in plain language: ${codes.join(", ")}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a medical billing assistant." },
          { role: "user", content: prompt },
        ],
      });

      const summary = completion.choices[0].message.content;
      res.json({ summary });

    } catch (err) {
      console.error("Error in /api/summarize-visit:", err);
      res.status(500).json({ summary: "Error fetching summary." });
    }
  }
};