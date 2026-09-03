const request = require('supertest');
const app = require('../index');
const jwt = require('jsonwebtoken');
const knex = require('knex')(require('../knexfile').test);

const makeAccessToken = (claims) =>
  jwt.sign(claims, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

describe('Product routes', () => {
  let adminToken, userToken, productId, adminId, userId;

  beforeAll(async () => {
    const now = new Date();
    const users = await knex('users').insert([
      {
        user_email: `product-admin-${Date.now()}@example.com`,
        user_password_hash: 'test-hash',
        user_postal_code: 'M5V1A1',
        user_role: 'ADMIN',
        user_created_datetime: now,
        user_modified_datetime: now,
      },
      {
        user_email: `product-user-${Date.now()}@example.com`,
        user_password_hash: 'test-hash',
        user_postal_code: 'M5V1A1',
        user_role: 'USER',
        user_created_datetime: now,
        user_modified_datetime: now,
      },
    ]).returning(['user_id', 'user_role']);

    adminId = users.find((user) => user.user_role === 'ADMIN').user_id;
    userId = users.find((user) => user.user_role === 'USER').user_id;
    adminToken = makeAccessToken({ user_id: adminId, user_role: 'ADMIN' });
    userToken = makeAccessToken({ user_id: userId, user_role: 'USER' });
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
      .send({
        product_name: 'Updated Hat',
        product_id: 2147483647,
        product_owner: 2,
        product_created_datetime: new Date(0),
      });
    expect(res.status).toBe(200);

    const product = await request(app).get(`/api/v1/product/${productId}`);
    expect(product.body.product_name).toBe('Updated Hat');
    expect(product.body.product_owner).toBe(adminId);
  });

  test('USER cannot update another user product', async () => {
    const res = await request(app)
      .put(`/api/v1/product/${productId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ product_name: 'Stolen Hat' });
    expect(res.status).toBe(403);
  });

  test('ADMIN receives 404 for unknown products', async () => {
    const read = await request(app).get('/api/v1/product/2147483647');
    expect(read.status).toBe(404);

    const update = await request(app)
      .put('/api/v1/product/2147483647')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ product_name: 'Missing' });
    expect(update.status).toBe(404);

    const remove = await request(app)
      .delete('/api/v1/product/2147483647')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(remove.status).toBe(404);
  });

  test('ADMIN can delete any product', async () => {
    const res = await request(app)
      .delete(`/api/v1/product/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  afterAll(async () => {
    if (productId) await knex('products').where('product_id', productId).del();
    await knex('users').whereIn('user_id', [adminId, userId]).del();
    await knex.destroy();
  });
});
