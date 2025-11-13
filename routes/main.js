const express = require("express");
const router = express.Router();
const homeController = require("../controllers/home");
const upload = require("../middleware/uploadMiddleware");

// root routes
router.get("/", homeController.getIndex);
router.get("/about", homeController.getAbout);

// manual query routes
router.get("/search", homeController.searchProcedures);


// file upload routes
router.get("/upload", homeController.getUpload);
router.post("/api/upload", upload.single("billFile"), homeController.postUpload);
router.get("/compare", homeController.getCompare);

module.exports = router;