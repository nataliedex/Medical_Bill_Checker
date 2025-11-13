const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const parsePdf = pdfParse.default || pdfParse;
const Tesseract = require("tesseract.js");
const { connectDB } = require("../config/database");
const { median } = require("../utils");
const { log } = require("console");


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
    },

    getUpload: (req, res) => {
      res.render("upload.ejs", { title: "Upload your Bill" });
    },
    
    postUpload: async (req, res) => {
      try {
        const file = req.file;
        if (!file) {
          return res.status(400).send("No file uploaded");
        }
    
        const filePath = path.join(__dirname, "../uploads", file.filename);
        const fileExt = path.extname(file.originalname).toLowerCase();
        let textContent = "";
    
        // --- Extract text based on file type ---
        if (fileExt === ".pdf") {
          const dataBuffer = fs.readFileSync(filePath);
          const pdfModule = await import("pdf-parse");
          const pdfParse = pdfModule.default || pdfModule;
          const pdfData = await pdfParse(dataBuffer);
          textContent = pdfData.text;
        } else if ([".jpg", "jpeg", "png"].includes(fileExt)) {
          const { data: { text } } = await Tesseract.recognize(filePath, "eng");
          textContent = text;
        } else {
          textContent = fs.readFileSync(filePath, "utf8");
        }
    
        // --- Delete file after reading ---
        fs.unlinkSync(filePath);
    
        // --- Extract CPT codes ---
        const cptCodes = textContent.match(/\b\d{5}\b/g) || [];
        const uniqueCodes = [...new Set(cptCodes)];
    
        if (uniqueCodes.length === 0) {
          return res.render("compare.ejs", {
            title: "Compare Charges",
            results: [],
            pivotResults: [],
            message: "No CPT codes detected in the upload file"
          });
        }
    
        // --- Extract billed charges near CPT codes ---
        const billedCharges = {};
        uniqueCodes.forEach(code => {
          // Look for a pattern like: "99285 .... 1234.56" or "$1,234.56" nearby
          const regex = new RegExp(`${code}[^\\d$]{0,20}\\$?\\s?([0-9,]+\\.?[0-9]{0,2})`, "i");
          const match = textContent.match(regex);
          if (match && match[1]) {
            billedCharges[code] = parseFloat(match[1].replace(/,/g, ""));
          }
        });
        
        console.log("Extracted CPT codes: ", uniqueCodes);
        console.log("Extracted billed charges:", billedCharges);

        // Redirect to /compare with codes and billed charges in query params
        const codesParam = uniqueCodes.join(',');
        const billedParam = encodeURIComponent(JSON.stringify(billedCharges));
        res.redirect(`/compare?codes=${codesParam}&billed=${billedParam}`);
      } catch (err) {
        console.error("Error processing upload", err);
        res.status(500).send("Error processing uploaded file.");
      }
    },

    getCompare: async (req, res) => {
      try {
        const db = await connectDB();
        const codesParam = req.query.codes || "";
        const codes = codesParam.split(",").map(c => c.trim()).filter(Boolean);
    
        if (!codes.length) {
          return res.render("compare.ejs", { title: "Compare Charges", results: [], pivotResults: [] });
        }

        const billedCharges = req.query.billed ? JSON.parse(req.query.billed) : {};
    
        const collection = db.collection("nch_data");
        const rawRows = await collection
          .find({ cpt_code: { $in: codes } })
          .toArray();
    
        // Build pivot summary
        const grouped = {};
        rawRows.forEach(row => {
          const key = `${row.cpt_code}||${row.setting || 'unknown'}`;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(row);
        });
    
        const pivotResults = Object.keys(grouped).map(key => {
          const rows = grouped[key];
          const [cpt_code, setting] = key.split('||');
    
          const medianStandard = median(rows.map(r => r.standard_charge));
          const medianNegotiated = median(rows.map(r => r.negotiated_charge));
          const description = rows[0].description || '';
          // const billed = billedCharges[cpt_code] || null;
    
          return {
            cpt_code,
            setting,
            description,
            medianStandard,
            medianNegotiated,
            billedCharges: billedCharges.hasOwnProperty(cpt_code) ? billedCharges[cpt_code] : null,
            count: rows.length
          };
        });
    
        console.log("getCompare pivotResults:", pivotResults);
    
        res.render("compare.ejs", {
          title: "Compare Charges",
          results: rawRows,
          pivotResults,
        });
    
      } catch (err) {
        console.error("Error fetching charges for uploaded CPT codes: ", err);
        res.status(500).send("Server error fetching charges");
      }
    },
}