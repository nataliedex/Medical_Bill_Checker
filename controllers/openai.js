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

      const prompt = `Summarize a patient visit for these CPT codes in 6-10 sentences, in plain language: ${codes.join(", ")} 
      Do not talk about the prices in this summary.  Only talk about procedures in plain language for non-medical people.
      Please state the CPT code in the summary.
      If a procedure is normally a preventative service, please note that in the summary.`;

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
        return res.status(400).json({ error: "No charges provided." });
      }
  
      // Build JSON for prompt, now including disputeNote
      const chargeList = flaggedCharges.map(fc => ({
        cpt_code: fc.cpt_code,
        description: fc.description || "",
        billed: fc.billedCharges || fc.billed || 0,
        negotiated: fc.medianNegotiated || fc.negotiated || 0,
        percentAbove: fc.percentAbove || 0,
        disputeNote: fc.disputeNote || ""
      }));
  
      const chargeListJSON = JSON.stringify(chargeList, null, 2);
  
      const prompt = `
You are a professional consumer-advocacy assistant.  
Using ONLY the data in the JSON below, write a complete billing clarification letter.  
Do NOT invent any facts.

Charges (JSON):
${chargeListJSON}

The letter must follow this exact structure:

1. Header block  
   Use placeholders, each on its own line:  
   [Your Name]  
   [Your Address]  
   [City, State, Zip Code]  
   [Your Email Address]  
   [Your Phone Number]  
   [Date]  

   Then leave space and include:  
   [Billing Department Name]  
   [Billing Department Address]  
   [City, State, Zip Code]  

2. Greeting and purpose  
   Include a brief greeting and a sentence stating that the patient is requesting clarification regarding several items on their medical bill.

3. Intro paragraph  
   Explain that the patient reviewed their bill and compared the charges to publicly available hospital pricing information.

4. Charge details section (must use bullet points)  
   The details must be formatted as bullet points exactly like the examples below.  
   Do not convert these into paragraphs or inline sentences.

   For price-flagged charges (percentAbove > 0), list each charge with:  
   - CPT Code:  
   - Billed Amount:  
   - Median Negotiated Price:  
   - Percent Above Median Negotiated Price:  
   - Dispute Note: (Do not include this line if the dispute note field is blank or empty)  

   For dispute-only charges (percentAbove = 0 AND disputeNote exists), list each charge with:  
   - CPT Code:  
   - Description:  
   - Billed Amount:  
   - Dispute Note:  

   Ensure discute notes are full sentences with spelling and grammar corrected automatically.

5. Closing paragraph  
   Include a short, polite paragraph asking for clarification or reconsideration of the listed charges.

6. Signature block  
   Repeat these placeholders, each on its own line:  
   [Your Name]  
   [Your Address]  
   [Your Contact Info]  
   [Date]  
   [Signature Line]

Tone must remain respectful, concise, factual, and professional.  
Do NOT include headings, section titles, or numbered lists in the final letter — only the bullet lists for the charge details.
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