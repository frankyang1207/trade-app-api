exports.up = function(knex) {
    return knex.schema
    .createTable('products', function (table) {
        table.increments('product_id');
        table.string('product_name').notNullable();
        table.string('product_description').notNullable();
        table.decimal('product_price').notNullable();
        table.integer('product_owner').references('users.user_id').notNullable();
    })
};


exports.down = function(knex) {
    return knex.schema
    .dropTableIfExists('products');
};
