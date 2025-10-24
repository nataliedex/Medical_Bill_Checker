const { connectDB } = require("../config/database");

module.exports = {
    getIndex: async(req, res) => {
        try {
            res.render("index.ejs", { results: [], title: "Medical Bill Checker", hospital: "", codes: "" });
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
    
        // Determine the collection based on the selected hospital
        const hospital = req.query.hospital || "nch_data";
        const collection = db.collection(hospital);
    
        // Build the query
        const query = {};
        if (req.query.code) {
          const codes = req.query.code.split(",").map(c => c.trim());
          query.cpt_code = { $in: codes };
        }
    
        // Fetch results
        const results = await collection
          .find(query)
          .sort({ cpt_code: 1, negotiated_charge: 1 })
          .allowDiskUse(true)
          .toArray();
    
        res.render("index.ejs", { results, title: `Medical Bill Checker`, hospital, codes: req.query.code || ""  });
      } catch (err) {
        console.error("Error fetching procedures: ", err);
        res.status(500).send("Server error while searching procedures.");
      }
    }
}