exports.up = async function (knex) {
  // ORDERS TABLE
  await knex.schema.createTable("orders", function (table) {
    table.increments("order_id").primary();

    table
      .integer("user_id")
      .notNullable()
      .references("user_id")
      .inTable("users")
      .onDelete("CASCADE");

    table.string("stripe_session_id").notNullable().unique();

    table.string("order_status").notNullable().defaultTo("paid");

    // Stripe-compatible money representation: cents
    table.integer("order_total_amount").notNullable();

    table.string("order_currency", 3).notNullable().defaultTo("CAD");

    table
      .dateTime("order_created_datetime")
      .notNullable()
      .defaultTo(knex.fn.now());

    table.index(["user_id"]);
    table.index(["order_created_datetime"]);
  });

  // ORDER ITEMS TABLE
  await knex.schema.createTable("order_items", function (table) {
    table.increments("order_item_id").primary();

    table
      .integer("order_id")
      .notNullable()
      .references("order_id")
      .inTable("orders")
      .onDelete("CASCADE");

    // Original product reference for traceability.
    // Historical order survives if product is deleted.
    table
      .integer("product_id")
      .nullable()
      .references("product_id")
      .inTable("products")
      .onDelete("SET NULL");

    // Snapshot fields at purchase time
    table.string("product_name").notNullable();

    // Store all money in cents
    table.integer("product_unit_amount").notNullable();

    table.integer("product_quantity").notNullable();

    table.index(["order_id"]);
    table.index(["product_id"]);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("order_items");
  await knex.schema.dropTableIfExists("orders");
};