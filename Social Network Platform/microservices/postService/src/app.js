const express = require("express");
const postRoute = require("./routes/postRoute");
const dotenv = require("dotenv");
const connectToDatabase = require("./config/db");
//There's an error in the path, it's not working with the relative path so balysha be el absolute path. This should be changed with your path
dotenv.config({});
console.log(`Mongo URI from feed service ${process.env.MONGO_URI}`);
connectToDatabase();
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/post", postRoute);
//Middleware will be added here
const PORT = process.env.POST_SERVICE_PORT || 3000;
app.listen(PORT, () =>
  console.log(`Post Service Running on port http://localhost:${PORT}`)
);
