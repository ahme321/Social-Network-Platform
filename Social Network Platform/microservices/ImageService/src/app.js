const express = require("express");
const imageRoute = require("./routes/imageRoute");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
dotenv.config();
const connectToDatabase = require("./config/db");
connectToDatabase();
const app = express();

//app.use(bodyParser.json());
app.use("/", imageRoute);
//app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const PORT = process.env.IMAGE_SERVCE_PORT || 6002;
app.listen(PORT, () => console.log(`Running on port http://localhost:${PORT}`));
