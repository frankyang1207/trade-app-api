// Update with your config settings.
require('dotenv').config();
/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
module.exports = {

  development: {
  client: 'postgresql',
    connection: process.env.DATABASE_URL,
    pool: {
      min: 1,
      max: 3
    },
    migrations: {
      tableName: 'knex_migrations'
    }
  },

  test: {
    client: "postgresql",
    connection: process.env.TEST_DATABASE_URL,
    migrations: {
      tableName: "knex_migrations",
    },
  },

  staging: {
    client: 'postgresql',
    connection: {
      database: 'my_db',
      user:     'username',
      password: 'password'
    },
    pool: {
      min: 1,
      max: 3
    },
    migrations: {
      tableName: 'knex_migrations'
    }
  },

  production: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL,
    pool: {
      min: 1,
      max: 3
    },
    migrations: {
      tableName: 'knex_migrations'
    }
  }

};
