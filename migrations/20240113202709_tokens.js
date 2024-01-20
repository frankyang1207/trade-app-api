exports.up = function(knex) {
    return knex.schema
    .createTable('tokens', function (table) {
        table.increments('token_id');
        table.integer('token_user_id').references('users.user_id').notNullable().unique();
        table.string('token_content').notNullable();
    })
};


exports.down = function(knex) {
    return knex.schema
    .dropTableIfExists('tokens');
};
