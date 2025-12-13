const request = require('supertest');
const app = require('../index');
const jwt = require('jsonwebtoken');

const makeAccessToken = (claims) =>
  jwt.sign(claims, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

describe('Product routes', () => {
  let adminToken, userToken, productId;

  beforeAll(() => {
    adminToken = makeAccessToken({ user_id: 1, user_role: 'ADMIN' });
    userToken = makeAccessToken({ user_id: 2, user_role: 'USER' });
  });

  test('ADMIN can create a product', async () => {
    const res = await request(app)
      .post('/api/v1/product')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        product_name: 'Test Hat',
        product_price: 19.99,
        product_description: 'Test text',
        product_quantity: 1,
        product_created_datetime: new Date(),
        product_modified_datetime: new Date(),
      });
    expect(res.status).toBe(201);
    productId = res.body.product_id;
  });

  test('USER cannot create a product', async () => {
    const res = await request(app)
      .post('/api/v1/product')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        product_name: 'Sneaky',
        product_price: 9.99,
      });
    expect(res.status).toBe(403);
  });

  test('fetch single product', async () => {
    const res = await request(app).get(`/api/v1/product/${productId}`);
    expect(res.status).toBe(200);
    const resBody = Array.isArray(res.body) ? res.body[0] : res.body;
    expect(resBody).toHaveProperty('product_name', 'Test Hat');
  });

  test('ADMIN can update product', async () => {
    const res = await request(app)
      .put(`/api/v1/product/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ product_name: 'Updated Hat' });
    expect(res.status).toBe(200);
  });

  test('ADMIN can delete any product', async () => {
    const res = await request(app)
      .delete(`/api/v1/product/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});
