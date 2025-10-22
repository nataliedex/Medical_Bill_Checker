const { connectDB } = require("../config/database");

module.exports = {
    getIndex: async(req, res) => {
        try {
            res.render("index.ejs", { results: [], title: "Nationwide Children's Hospital - Medical Bill Checker" });
        } catch(err) {
            res.status(500).send("can not render the index.ejs file");
        }
    },

    getAbout: async(req, res) => {
        res.render("about.ejs", { results: [] });
    },

    searchProcedures: async (req, res) => {
        try {
          const db = await connectDB();
          const collection = db.collection("procedures");
      
          const query = {};
      
          if (req.query.code) {
            const codes = req.query.code.split(",").map(c => c.trim());
            query.cpt_code = { $in: codes };
          }

      
          const results = await collection
            .find(query)
            .sort({ cpt_code: 1, negotiated_charge: 1 }) 
            .toArray();
      
          res.render("index.ejs", { results, title: "Medical Bill Checker" });
        } catch (err) {
          console.error("Error fetching procedures: ", err);
          res.status(500).send("Server error while searching procedures.");
        }
      }
}