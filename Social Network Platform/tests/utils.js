const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

module.exports = {
  createTestUser: async () => {
    const email = `test${Date.now()}@example.com`;
    const response = await axios.post(`http://localhost:3002/auth/register`, {
      username: `testuser${Date.now()}`,
      email,
      password: "password123",
    });
    return { ...response.data, email, password: "password123" };
  },

  loginUser: async (email, password) => {
    const response = await axios.post(`http://localhost:3002/auth/login`, {
      email,
      password,
    });
    return response.data.token;
  },

  uploadTestImage: async (token, type = "profile") => {
    const form = new FormData();
    form.append("file", fs.createReadStream("./test/test.jpg"));
    form.append("type", type);

    const response = await axios.post(`http://localhost:6000/upload`, form);

    return response.data;
  },
};
