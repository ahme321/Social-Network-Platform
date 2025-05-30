const axios = require("axios");

describe("API Gateway Health Check", () => {
  it("should return healthy status", async () => {
    const response = await axios.get("http://localhost:8080/health");
    expect(response.status).toBe(200);
    expect(response.data.status).toBe("healthy");
  });
});
