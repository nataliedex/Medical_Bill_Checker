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
  },

  getLetter: async (req, res) => {
    try {
      console.log("Incoming body:", req.body); 

      const { flaggedCharges } = req.body;

      if (!flaggedCharges || !Array.isArray(flaggedCharges) || flaggedCharges.length === 0) {
        return res.status(400).json({ error: "No flagged charges provided." });
      }

      const chargeList = flaggedCharges.map(fc => ({
        cpt_code: fc.cpt_code,
        description: fc.description || "",
        billed: fc.billedCharges,
        negotiated: fc.medianNegotiated,
        percentAbove: fc.percentAbove
      }));
      
      const chargeListJSON = JSON.stringify(chargeList, null, 2);

      const prompt = `
You are a professional consumer advocate helping a patient draft a billing clarification letter.

Use ONLY the information provided in the flagged charges JSON below.
You MUST reference every charge, using the actual values (CPT code, description, billed amount, median negotiated price, percent above negotiated). 
Do not use placeholders or invent any information.

Flagged Charges (JSON):
${chargeListJSON}

Write a concise, factual, respectful letter that includes:

1. A heading block with placeholders for the patient’s name, address, contact info, and the date.

2. An introduction explaining that the patient reviewed their bill and compared it to publicly available hospital pricing data.

3. A clearly formatted list of all flagged charges. For each charge, list:
   - CPT Code
   - Billed Amount
   - Median Negotiated Price
   - Percent Above Negotiated

4. A short paragraph requesting clarification or reconsideration of the above charges in light of the pricing data.

5. A polite closing thanking the billing department and leaving space for the patient’s signature.

Keep the tone respectful, factual, and concise. Avoid general medical explanations or assumptions not included in the data.
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a professional letter-writing assistant." },
          { role: "user", content: prompt }
        ],
        temperature: 0.4
      });

      const letter = completion.choices[0].message.content.trim();
      res.json({ letter });
    } catch (error) {
      console.error("Error generating letter:", error);
      res.status(500).json({ error: "Failed to generate letter." });
    }
  },
  
};