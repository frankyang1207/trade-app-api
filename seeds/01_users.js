/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
const bcrypt = require("bcrypt")
const saltRounds = 10;

exports.seed = async function(knex) {

  // Deletes ALL existing entries
  await knex('user_roles').del();
  
  await knex('users').del();
  await knex('users').insert([
    { 
      user_first_name: 'user1fn',
      user_last_name: 'user1ln', 
      user_phone:'(647) 123-0001', 
      user_email:'user1@gmail.com',
      user_password_hash: await bcrypt.hash('password', saltRounds),
      user_role: 'ADMIN'
    },
    { 
      user_id: 2,
      user_first_name: 'user2fn',
      user_last_name: 'user2ln',
      user_phone:'(647) 123-0002',
      user_email:'user2@gmail.com',
      user_password_hash: await bcrypt.hash('password', saltRounds)
    },
    { 
      user_id: 3,
      user_first_name: 'user3fn',
      user_last_name: 'user3ln',
      user_phone:'(647) 123-0003',
      user_email:'user3@gmail.com',
      user_password_hash: await bcrypt.hash('password', saltRounds)
    },
  ]);

};
