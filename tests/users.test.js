const request = require('supertest');
const app = require('../index'); 
const jwt = require('jsonwebtoken');
const knex = require('knex')(require('../knexfile').test);
const bcrypt = require('bcrypt');

// Helper to create tokens
const makeAccessToken = (claims) =>
  jwt.sign(claims, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

describe('User routes', () => {
  let adminToken, userToken, createdUserId, createdUserToken;
  let adminId, userId, userEmail;

  beforeAll(async () => {
    const now = new Date();
    userEmail = `user-route-${Date.now()}@example.com`;
    const passwordHash = await bcrypt.hash('CorrectPass1!', 10);
    const users = await knex('users').insert([
      {
        user_email: `user-admin-${Date.now()}@example.com`,
        user_password_hash: passwordHash,
        user_postal_code: 'M5V1A1',
        user_role: 'ADMIN',
        user_created_datetime: now,
        user_modified_datetime: now,
      },
      {
        user_email: userEmail,
        user_password_hash: passwordHash,
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

  test('signs up a new user', async () => {
    const res = await request(app).post('/api/v1/user').send({
      user_email: `new-${Date.now()}@example.com`,
      user_password: 'Passw0rd!',
      user_first_name: 'Newbie',
      user_postal_code: 'M5V1A1',
      user_role: 'ADMIN',
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('access_token');
    expect(res.body).toHaveProperty('refresh_token');
    expect(res.body).not.toHaveProperty('user_password_hash');
    expect(res.body.user_role).toBe('USER');
    createdUserId = res.body.user_id;
    createdUserToken = res.body.access_token;
  });

  test('account owner update uses URL ID and ignores protected fields', async () => {
    const res = await request(app)
      .put(`/api/v1/user/${createdUserId}`)
      .set('Authorization', `Bearer ${createdUserToken}`)
      .send({
        user_id: 1,
        user_role: 'ADMIN',
        user_first_name: 'Updated',
      });

    expect(res.status).toBe(200);

    const profile = await request(app)
      .get(`/api/v1/user/${createdUserId}`)
      .set('Authorization', `Bearer ${createdUserToken}`);
    expect(profile.body.user_first_name).toBe('Updated');
    expect(profile.body.user_role).toBe('USER');
  });

  test('ADMIN receives 404 when updating an unknown account', async () => {
    const res = await request(app)
      .put('/api/v1/user/2147483647')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ user_first_name: 'Nobody' });
    expect(res.status).toBe(404);
  });

  test('forbids USER from reading another user profile', async () => {
    const res = await request(app)
      .get(`/api/v1/user/${adminId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  test('ADMIN can read any user profile', async () => {
    const res = await request(app)
      .get(`/api/v1/user/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user_email');
  });

  test('login fails with wrong password', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      user_email: userEmail,
      user_password: 'badpass',
    });
    expect(res.status).toBe(401);
  });

  test('account owner delete uses the URL ID', async () => {
    const res = await request(app)
      .delete(`/api/v1/user/${createdUserId}`)
      .set('Authorization', `Bearer ${createdUserToken}`)
      .send({ user_id: adminId });

    expect(res.status).toBe(200);
    expect(await knex('users').where('user_id', createdUserId).first()).toBeUndefined();
    expect(await knex('users').where('user_id', adminId).first()).toBeDefined();
    createdUserId = undefined;
  });

  afterAll(async () => {
    if (createdUserId) {
      await knex('tokens').where('token_user_id', createdUserId).del();
      await knex('users').where('user_id', createdUserId).del();
    }
    await knex('users').whereIn('user_id', [adminId, userId]).del();
    await knex.destroy();
  });
});
