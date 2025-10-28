const express = require("express");
const router = express.Router();
const openaiController = require("../controllers/openai");

router.post("/describe-cpt", openaiController.postDescription);
router.post("/summarize-visit", openaiController.postVisitSummary);
router.get("/test", openaiController.getTest);

module.exports = router;
