const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const { connectDB } = require("./config/database");
const mainRoutes = require("./routes/main");
const openaiRoute = require("./routes/openai");


dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

//Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

//EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Routes
app.use("/", mainRoutes);
app.use("/api", openaiRoute);

//Server Running and connect to MongoDB
connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server is running on port ${process.env.PORT || 8000}`);
          });
    })
    .catch((err) => {
        console.error("Failed to connect to MongoDB", err);
    });
