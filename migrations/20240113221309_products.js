exports.up = function(knex) {
    return knex.schema
    .createTable('products', function (table) {
        table.increments('product_id');
        table.string('product_image_link');
        table.string('product_name').notNullable();
        table.string('product_description').notNullable();
        table.decimal('product_price').notNullable();
        table.integer('product_quantity').notNullable();
        table.boolean('product_for_male');
        table.boolean('product_for_female');
        table.integer('product_owner').references('users.user_id').notNullable();
        table.dateTime('product_created_datetime').notNullable();
        table.dateTime('product_modified_datetime').notNullable();
    })
};


exports.down = function(knex) {
    return knex.schema
    .dropTableIfExists('products');
};
