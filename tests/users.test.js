const request = require('supertest');
const app = require('../index'); 
const jwt = require('jsonwebtoken');

// Helper to create tokens
const makeAccessToken = (claims) =>
  jwt.sign(claims, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

describe('User routes', () => {
  let adminToken, userToken;

  beforeAll(() => {
    adminToken = makeAccessToken({ user_id: 1, user_role: 'ADMIN' });
    userToken = makeAccessToken({ user_id: 2, user_role: 'USER' });
  });

  test('signs up a new user', async () => {
    const res = await request(app).post('/api/v1/user').send({
      user_email: 'new@example.com',
      user_password: 'Passw0rd!',
      user_first_name: 'Newbie',
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('access_token');
    expect(res.body).toHaveProperty('refresh_token');
    expect(res.body).not.toHaveProperty('user_password_hash');
  });

  test('forbids USER from reading another user profile', async () => {
    const res = await request(app)
      .get('/api/v1/user/1')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  test('ADMIN can read any user profile', async () => {
    const res = await request(app)
      .get('/api/v1/user/2')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user_email');
  });

  test('login fails with wrong password', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      user_email: 'user1@gmail.com',
      user_password: 'badpass',
    });
    expect(res.status).toBe(401);
  });
});
