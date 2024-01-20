exports.up = function(knex) {
    return knex.schema
    .createTable('users', function (table) {
        table.increments('user_id').primary();
        table.string('user_email').notNullable().unique();
        table.string('user_password_hash').notNullable();
        table.string('user_first_name');
        table.string('user_last_name');
        table.string('user_phone');
        table.string('user_role');
    })
};


exports.down = function(knex) {
    return knex.schema
    .dropTableIfExists('users');
};
