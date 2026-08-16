exports.up = function(knex) {
    return knex.schema
    .createTable('users', function (table) {
        table.increments('user_id').primary();
        table.string('user_image_link');
        table.string('user_email').notNullable().unique();
        table.string('user_password_hash').notNullable();
        table.string('user_first_name');
        table.string('user_last_name');
        table.string('user_phone');
        table.string('user_postal_code').notNullable();
        table.string('user_country');
        table.string('user_province');
        table.string('user_city');
        table.string('user_street_address');
        table.string('user_role');
        table.dateTime('user_created_datetime').notNullable();
        table.dateTime('user_modified_datetime').notNullable();
    })
};


exports.down = function(knex) {
    return knex.schema
    .dropTableIfExists('users');
};
