const express = require("express");
const router = express.Router();
const openaiController = require("../controllers/openai");

router.post("/describe-cpt", openaiController.postDescription);
router.post("/summarize-visit", openaiController.postVisitSummary);
router.post("/generate-letter", openaiController.getLetter);


module.exports = router;
