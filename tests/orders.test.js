process.env.NODE_ENV = "test";

require("dotenv").config();

const request = require("supertest");
const jwt = require("jsonwebtoken");
const knexConfig = require("../knexfile").test;
const knex = require("knex")(knexConfig);

// --------------------
// Mock Stripe
// --------------------

const mockStripeRetrieve = jest.fn();

jest.mock("stripe", () => {
  return jest.fn(() => ({
    checkout: {
      sessions: {
        retrieve: (...args) => mockStripeRetrieve(...args),
      },
    },
  }));
});

// Require app AFTER NODE_ENV is set to "test"
const app = require("../index");

const makeAccessToken = (claims) =>
  jwt.sign(claims, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "1h",
  });

describe("Order routes", () => {
  let userId;
  let productId;
  let userToken;

  // --------------------
  // Create real test data
  // --------------------

  beforeAll(async () => {
    const now = new Date();

    const [user] = await knex("users")
      .insert({
        user_email: `order-test-${Date.now()}@example.com`,
        user_password_hash: "test-password-hash",
        user_postal_code: "M5V1A1",
        user_role: "USER",
        user_created_datetime: now,
        user_modified_datetime: now,
      })
      .returning("user_id");

    userId = user.user_id;

    const [product] = await knex("products")
      .insert({
        product_name: "Test Product",
        product_description: "Product used for order tests",
        product_price: 25.0,
        product_quantity: 100,
        product_owner: userId,
        product_created_datetime: now,
        product_modified_datetime: now,
      })
      .returning("product_id");

    productId = product.product_id;

    userToken = makeAccessToken({
      user_id: userId,
      user_role: "USER",
    });
  });

  // --------------------
  // Clean orders between tests
  // --------------------

  beforeEach(async () => {
    await knex("orders")
      .where({ user_id: userId })
      .del();

    jest.clearAllMocks();
  });

  // --------------------
  // Clean up test fixtures
  // --------------------

  afterAll(async () => {
    await knex("orders")
      .where({ user_id: userId })
      .del();

    await knex("products")
      .where({ product_id: productId })
      .del();

    await knex("users")
      .where({ user_id: userId })
      .del();

    await knex.destroy();
  });

  // ============================================================
  // TEST 1
  // ============================================================

  test("rejects request without authentication", async () => {
    const res = await request(app)
      .post("/api/v1/orders/confirm")
      .send({
        sessionId: "cs_test_123",
        cartItems: [{ product_id: productId }],
      });

    expect(res.status).toBe(401);
  });

  // ============================================================
  // TEST 2
  // ============================================================

  test("rejects missing sessionId", async () => {
    const res = await request(app)
      .post("/api/v1/orders/confirm")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        cartItems: [{ product_id: productId }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("sessionId is required");
  });

  // ============================================================
  // TEST 3
  // ============================================================

  test("rejects missing cartItems", async () => {
    const res = await request(app)
      .post("/api/v1/orders/confirm")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        sessionId: "cs_test_123",
        cartItems: [],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("cartItems are required");
  });

  // ============================================================
  // TEST 4
  // ============================================================

  test("rejects an unpaid Stripe session", async () => {
    mockStripeRetrieve.mockResolvedValue({
      id: "cs_test_unpaid",
      payment_status: "unpaid",
    });

    const res = await request(app)
      .post("/api/v1/orders/confirm")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        sessionId: "cs_test_unpaid",
        cartItems: [{ product_id: productId }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Payment not completed");
  });

  // ============================================================
  // TEST 5
  // ============================================================

  test("rejects when cart items do not match Stripe line items", async () => {
    mockStripeRetrieve.mockResolvedValue({
      id: "cs_test_mismatch",
      payment_status: "paid",
      amount_total: 2500,
      currency: "cad",

      line_items: {
        data: [
          {
            description: "Test Product",
            quantity: 1,
            amount_total: 2500,
            price: {
              unit_amount: 2500,
            },
          },
        ],
      },
    });

    const res = await request(app)
      .post("/api/v1/orders/confirm")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        sessionId: "cs_test_mismatch",

        // Two cart items, but Stripe has only one
        cartItems: [
          { product_id: productId },
          { product_id: productId },
        ],
      });

    expect(res.status).toBe(400);

    expect(res.body.error).toBe(
      "Cart items do not match Stripe line items"
    );
  });

  // ============================================================
  // TEST 6
  // Most important integration test
  // ============================================================

  test("creates an order and order items for a paid Stripe session", async () => {
    const sessionId = "cs_test_success";

    mockStripeRetrieve.mockResolvedValue({
      id: sessionId,
      payment_status: "paid",
      amount_total: 5000,
      currency: "cad",

      line_items: {
        data: [
          {
            description: "Test Product",
            quantity: 2,
            amount_total: 5000,

            price: {
              unit_amount: 2500,
            },
          },
        ],
      },
    });

    const res = await request(app)
      .post("/api/v1/orders/confirm")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        sessionId,

        cartItems: [
          {
            product_id: productId,
            cartQuantity: 2,
          },
        ],
      });

    // API succeeded
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.order_id).toBeDefined();

    // --------------------
    // Check real orders table
    // --------------------

    const order = await knex("orders")
      .where({
        stripe_session_id: sessionId,
        user_id: userId,
      })
      .first();

    expect(order).toBeDefined();
    expect(order.order_id).toBe(res.body.order_id);

    expect(order.order_status).toBe("paid");
    expect(order.order_total_amount).toBe(5000);

    expect(order.order_currency.toUpperCase()).toBe("CAD");

    // --------------------
    // Check real order_items table
    // --------------------

    const orderItem = await knex("order_items")
      .where({
        order_id: order.order_id,
      })
      .first();

    expect(orderItem).toBeDefined();

    expect(orderItem.product_id).toBe(productId);
    expect(orderItem.product_name).toBe("Test Product");

    expect(orderItem.product_unit_amount).toBe(2500);
    expect(orderItem.product_quantity).toBe(2);

    const lineTotal =
      orderItem.product_unit_amount * orderItem.product_quantity;

    expect(lineTotal).toBe(5000);
  });

  // ============================================================
  // TEST 7
  // Duplicate protection
  // ============================================================

  test("does not create duplicate orders for the same Stripe session", async () => {
    const sessionId = "cs_test_duplicate";

    mockStripeRetrieve.mockResolvedValue({
      id: sessionId,
      payment_status: "paid",
      amount_total: 2500,
      currency: "cad",

      line_items: {
        data: [
          {
            description: "Test Product",
            quantity: 1,
            amount_total: 2500,

            price: {
              unit_amount: 2500,
            },
          },
        ],
      },
    });

    // First confirmation
    const firstRes = await request(app)
      .post("/api/v1/orders/confirm")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        sessionId,
        cartItems: [{ product_id: productId }],
      });

    expect(firstRes.status).toBe(201);

    // Second confirmation with same session
    const secondRes = await request(app)
      .post("/api/v1/orders/confirm")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        sessionId,
        cartItems: [{ product_id: productId }],
      });

    expect(secondRes.status).toBe(200);

    expect(secondRes.body.message).toBe(
      "Order already confirmed"
    );

    // There should still be only ONE database row
    const result = await knex("orders")
      .where({
        stripe_session_id: sessionId,
      })
      .count("* as count")
      .first();

    expect(Number(result.count)).toBe(1);

    // Stripe doesn't even need to be called the second time,
    // because existing-order check happens first
    expect(mockStripeRetrieve).toHaveBeenCalledTimes(1);
  });

  // ============================================================
  // TEST 8
  // Transaction rollback
  // ============================================================

  test("rolls back the order if order item creation fails", async () => {
    const sessionId = "cs_test_rollback";

    mockStripeRetrieve.mockResolvedValue({
      id: sessionId,
      payment_status: "paid",
      amount_total: 2500,
      currency: "cad",

      line_items: {
        data: [
          {
            description: "Invalid Product",
            quantity: 1,
            amount_total: 2500,

            price: {
              unit_amount: 2500,
            },
          },
        ],
      },
    });

    // Use a product ID that doesn't exist.
    // order_items insert should violate the FK constraint.
    const invalidProductId = 2147483647;

    const res = await request(app)
      .post("/api/v1/orders/confirm")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        sessionId,

        cartItems: [
          {
            product_id: invalidProductId,
          },
        ],
      });

    expect(res.status).toBe(500);

    // The order insert happened inside the transaction,
    // so it should have been rolled back too.
    const order = await knex("orders")
      .where({
        stripe_session_id: sessionId,
      })
      .first();

    expect(order).toBeUndefined();
  });
});