const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const AuthController = require("../microservices/user-service/src/controllers/authController");
const User = require("../microservices/user-service/src/models/user");
const pool = require("../microservices/user-service/src/config/database"); // Mocked
require("dotenv").config();

// Mock necessary modules and functions
jest.mock("jsonwebtoken");
jest.mock("google-auth-library");
jest.mock("../microservices/user-service/src/models/user.js", () => {
  return {
    findByEmail: jest.fn(),
    create: jest.fn(),
    validatePassword: jest.fn(),
    updateLastLogin: jest.fn(),
  };
});
jest.mock("../", () => {
  return {
    query: jest.fn(),
  };
});

// Create a mock Express app
const app = express();
app.use(express.json());

// Define routes for the authentication controller
app.post("/register", AuthController.register);
app.post("/login", AuthController.login);
app.post("/logout", AuthController.logout);
app.post("/google-login", AuthController.googleLogin);

// Helper function to create a mock response
const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("Auth Controller Tests", () => {
  let req;
  let res;

  beforeEach(() => {
    req = {
      body: {},
      headers: {},
    };
    res = mockResponse();
    jest.clearAllMocks(); // Clear mock calls before each test
  });

  describe("register", () => {
    it("should register a new user and return 201 status with user and token", async () => {
      // Mock User.findByEmail to indicate user does not exist
      User.findByEmail.mockResolvedValue(null);

      // Mock User.create to return a new user object
      const mockUser = {
        id: "newUserId",
        email: "test@example.com",
        name: "Test User",
      };
      User.create.mockResolvedValue(mockUser);

      // Mock jwt.sign to return a token
      jwt.sign.mockReturnValue("mockedToken");

      // Set the request body
      req.body = {
        email: "test@example.com",
        password: "password123",
        name: "Test User",
        gender: "other",
        preferences: [],
        date_of_birth: "2000-01-01",
      };

      // Call the controller function
      await AuthController.register(req, res);

      // Assertions
      expect(User.findByEmail).toHaveBeenCalledWith("test@example.com");
      expect(User.create).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
        name: "Test User",
        gender: "other",
        preferences: [],
        date_of_birth: "2000-01-01",
      });
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: "newUserId" },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        user: mockUser,
        token: "mockedToken",
      });
    });

    it("should return 400 if any required field is missing", async () => {
      req.body = { email: "test@example.com" }; // Missing password

      await AuthController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "All fields are required",
      });
      expect(User.findByEmail).not.toHaveBeenCalled();
      expect(User.create).not.toHaveBeenCalled();
    });

    it("should return 400 if email already exists", async () => {
      // Mock User.findByEmail to return an existing user
      User.findByEmail.mockResolvedValue({ email: "test@example.com" });

      req.body = {
        email: "test@example.com",
        password: "password123",
        name: "Test User",
        gender: "other",
        preferences: [],
        date_of_birth: "2000-01-01",
      };

      await AuthController.register(req, res);

      expect(User.findByEmail).toHaveBeenCalledWith("test@example.com");
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Email already registered",
      });
      expect(User.create).not.toHaveBeenCalled();
    });

    it("should return 500 if there is an error during user creation", async () => {
      // Mock User.findByEmail
      User.findByEmail.mockResolvedValue(null);
      // Mock User.create to throw an error
      const errorMessage = "Failed to create user";
      User.create.mockRejectedValue(new Error(errorMessage));

      req.body = {
        email: "test@example.com",
        password: "password123",
        name: "Test User",
        gender: "other",
        preferences: [],
        date_of_birth: "2000-01-01",
      };

      await AuthController.register(req, res);

      expect(User.findByEmail).toHaveBeenCalledWith("test@example.com");
      expect(User.create).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
        name: "Test User",
        gender: "other",
        preferences: [],
        date_of_birth: "2000-01-01",
      });
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Error creating user",
        details: errorMessage,
      });
    });
  });

  describe("login", () => {
    it("should log in a user and return 200 status with user and token", async () => {
      // Mock User.findByEmail to return an existing user
      const mockUser = {
        name: "testuser",
        email: "test@example.com",
        password: "hashedPassword",
      };
      User.findByEmail.mockResolvedValue(mockUser);

      // Mock User.validatePassword to return true
      User.validatePassword.mockResolvedValue(true);

      // Mock User.updateLastLogin
      User.updateLastLogin.mockResolvedValue();

      // Mock jwt.sign to return a token
      jwt.sign.mockReturnValue("mockedToken");

      req.body = { email: "test@example.com", password: "password123" };

      await AuthController.login(req, res);

      expect(User.findByEmail).toHaveBeenCalledWith("test@example.com");
      expect(User.validatePassword).toHaveBeenCalledWith(
        "password123",
        "hashedPassword"
      );
      expect(User.updateLastLogin).toHaveBeenCalledWith("existingUserId");
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: "existingUserId" },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        user: { name: "testname", email: "test@example.com" }, // Password should be removed
        token: "mockedToken",
      });
    });

    it("should return 400 if email or password is missing", async () => {
      req.body = { email: "test@example.com" };

      await AuthController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Email and password are required",
      });
      expect(User.findByEmail).not.toHaveBeenCalled();
      expect(User.validatePassword).not.toHaveBeenCalled();
    });

    it("should return 401 if user is not found", async () => {
      // Mock User.findByEmail to return null
      User.findByEmail.mockResolvedValue(null);

      req.body = { email: "test@example.com", password: "password123" };

      await AuthController.login(req, res);

      expect(User.findByEmail).toHaveBeenCalledWith("test@example.com");
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid credentials" });
      expect(User.validatePassword).not.toHaveBeenCalled();
    });

    it("should return 401 if password is invalid", async () => {
      // Mock User.findByEmail to return a user
      User.findByEmail.mockResolvedValue({ email: "test@example.com" });

      // Mock User.validatePassword to return false
      User.validatePassword.mockResolvedValue(false);

      req.body = { email: "test@example.com", password: "wrongPassword" };

      await AuthController.login(req, res);

      expect(User.findByEmail).toHaveBeenCalledWith("test@example.com");
      expect(User.validatePassword).toHaveBeenCalledWith(
        "wrongPassword",
        undefined
      );
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid credentials" });
    });

    it("should return 500 if there is an error during login", async () => {
      // Mock User.findByEmail to throw an error
      const errorMessage = "Login error";
      User.findByEmail.mockRejectedValue(new Error(errorMessage));

      req.body = { email: "test@example.com", password: "password123" };

      await AuthController.login(req, res);

      expect(User.findByEmail).toHaveBeenCalledWith("test@example.com");
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Error during login",
        details: errorMessage,
      });
    });
  });

  describe("logout", () => {
    it("should blacklist the token and return 200 status", async () => {
      // Mock the authorization header
      req.headers["authorization"] = "Bearer validToken";

      // Mock jwt.verify to return a decoded token
      const decodedToken = { userId: "userId", exp: Date.now() / 1000 + 3600 }; // Example expiration
      jwt.verify.mockReturnValue(decodedToken);

      // Mock the database query
      pool.query.mockResolvedValue();

      await AuthController.logout(req, res);

      expect(jwt.verify).toHaveBeenCalledWith(
        "validToken",
        process.env.JWT_SECRET
      );
      expect(pool.query).toHaveBeenCalledWith(
        "INSERT INTO token_blacklist (token, expires_at) VALUES ($1, $2)",
        ["validToken", expect.any(Date)]
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Logged out successfully",
      });
    });

    it("should return 401 if authorization header is missing", async () => {
      await AuthController.logout(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Authorization token required",
      });
      expect(jwt.verify).not.toHaveBeenCalled();
      expect(pool.query).not.toHaveBeenCalled();
    });

    it("should return 403 if the token is invalid", async () => {
      req.headers["authorization"] = "Bearer invalidToken";
      jwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError("Invalid token");
      });

      await AuthController.logout(req, res);

      expect(jwt.verify).toHaveBeenCalledWith(
        "invalidToken",
        process.env.JWT_SECRET
      );
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid token" });
      expect(pool.query).not.toHaveBeenCalled();
    });

    it("should return 403 if the token is expired", async () => {
      req.headers["authorization"] = "Bearer expiredToken";
      jwt.verify.mockImplementation(() => {
        throw new jwt.TokenExpiredError("Token expired", new Date());
      });

      await AuthController.logout(req, res);

      expect(jwt.verify).toHaveBeenCalledWith(
        "expiredToken",
        process.env.JWT_SECRET
      );
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: "Token expired" });
      expect(pool.query).not.toHaveBeenCalled();
    });

    it("should return 500 if there is an error during logout", async () => {
      req.headers["authorization"] = "Bearer validToken";
      jwt.verify.mockReturnValue({
        userId: "userId",
        exp: Date.now() / 1000 + 3600,
      });
      pool.query.mockRejectedValue(new Error("Database error"));

      await AuthController.logout(req, res);

      expect(jwt.verify).toHaveBeenCalledWith(
        "validToken",
        process.env.JWT_SECRET
      );
      expect(pool.query).toHaveBeenCalledWith(
        "INSERT INTO token_blacklist (token, expires_at) VALUES ($1, $2)",
        ["validToken", expect.any(Date)]
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Error during logout" });
    });
  });

  describe("googleLogin", () => {
    it("should log in or register a user with Google and return 200 status", async () => {
      // Mock OAuth2Client and ticket payload
      const mockTokens = { id_token: "mockedIdToken" };
      const mockPayload = {
        email: "test@example.com",
        name: "Test User",
        picture: "http://example.com/picture.jpg",
      };
      const mockTicket = {
        getPayload: () => mockPayload,
      };
      OAuth2Client.prototype.getToken.mockResolvedValue({ tokens: mockTokens });
      OAuth2Client.prototype.verifyIdToken.mockResolvedValue(mockTicket);

      // Mock User.findByEmail
      User.findByEmail.mockResolvedValue(null); // User doesn't exist initially
      // Mock User.create
      const mockUser = {
        id: "googleUserId",
        email: "test@example.com",
        name: "Test User",
      };
      User.create.mockResolvedValue(mockUser);

      // Mock jwt.sign
      jwt.sign.mockReturnValue("mockedToken");

      req.body = { code: "authorizationCode" };

      await AuthController.googleLogin(req, res);

      expect(OAuth2Client.prototype.getToken).toHaveBeenCalledWith(
        "authorizationCode"
      );
      expect(OAuth2Client.prototype.verifyIdToken).toHaveBeenCalledWith({
        idToken: "mockedIdToken",
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      expect(User.findByEmail).toHaveBeenCalledWith("test@example.com");
      expect(User.create).toHaveBeenCalledWith({
        email: "test@example.com",
        password: expect.any(String), // Check that a random password was generated
        name: "Test User",
        gender: "other",
        preferences: [],
        date_of_birth: expect.any(String),
        profile_picture: "http://example.com/picture.jpg",
      });
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: "googleUserId" },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        user: mockUser,
        token: "mockedToken",
      });
    });

    it("should log in an existing user with Google", async () => {
      // Mock OAuth2Client and ticket payload
      const mockTokens = { id_token: "mockedIdToken" };
      const mockPayload = {
        email: "existing@example.com",
        name: "Existing User",
      };
      const mockTicket = { getPayload: () => mockPayload };
      OAuth2Client.prototype.getToken.mockResolvedValue({ tokens: mockTokens });
      OAuth2Client.prototype.verifyIdToken.mockResolvedValue(mockTicket);

      // Mock User.findByEmail to return an existing user
      const mockExistingUser = {
        id: "existingUserId",
        email: "existing@example.com",
        password: "oldPassword",
      };
      User.findByEmail.mockResolvedValue(mockExistingUser);

      // Mock User.updateLastLogin
      User.updateLastLogin.mockResolvedValue();

      // Mock jwt.sign
      jwt.sign.mockReturnValue("mockedToken");

      req.body = { code: "authorizationCode" };

      await AuthController.googleLogin(req, res);

      expect(OAuth2Client.prototype.getToken).toHaveBeenCalledWith(
        "authorizationCode"
      );
      expect(OAuth2Client.prototype.verifyIdToken).toHaveBeenCalledWith({
        idToken: "mockedIdToken",
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      expect(User.findByEmail).toHaveBeenCalledWith("existing@example.com");
      expect(User.updateLastLogin).toHaveBeenCalledWith("existingUserId");
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: "existingUserId" },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        user: { id: "existingUserId", email: "existing@example.com" }, // No password
        token: "mockedToken",
      });
    });

    it("should return 500 if there is an error during Google login", async () => {
      // Mock OAuth2Client to throw an error
      OAuth2Client.prototype.getToken.mockRejectedValue(
        new Error("Failed to get token")
      );

      req.body = { code: "authorizationCode" };

      await AuthController.googleLogin(req, res);

      expect(OAuth2Client.prototype.getToken).toHaveBeenCalledWith(
        "authorizationCode"
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Error during Google login",
      });
    });
  });
});
