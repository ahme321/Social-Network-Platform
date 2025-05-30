const axios = require("axios");
const { createTestUser, loginUser } = require("./utils");

describe("User Service", () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    testUser = await createTestUser();
    authToken = await loginUser(testUser.email, testUser.password);
  });

  it("should register a new user", () => {
    expect(testUser.id).toBeDefined();
    expect(testUser.email).toContain("@example.com");
  });

  it("should login with valid credentials", () => {
    expect(authToken).toBeDefined();
    expect(typeof authToken).toBe("string");
  });

  it("should get user profile with valid token", async () => {
    const response = await axios.get(
      `http://localhost:3002/auth/register`,
      testUser
    );

    expect(response.status).toBe(200);
    expect(response.data.id).toBe(testUser.id);
    expect(response.data.email).toBe(testUser.email);
  });
});
