const connection = require('../knexfile')[process.env.NODE_ENV || 'development'];
const knex = require('knex')(connection);
const Stripe = require('stripe');
require('dotenv').config();
const stripe = Stripe(process.env.STRIPE_KEY);

// Confirm order after Stripe payment success
// Frontend should call this after it gets session_id and sees payment completed
const confirmOrder = async (request, response) => {
  const { sessionId } = request.body;
  const { user_id } = request.user;

  if (!sessionId) {
    return response.status(400).json({ error: 'sessionId is required' });
  }

  try {
    // Prevent duplicates: if session already saved, return existing order
    const existing = await knex('orders')
      .select('order_id')
      .where({ stripe_session_id: sessionId })
      .first();

    if (existing) {
      return response.status(200).json({ success: true, order_id: existing.order_id, message: 'Order already confirmed' });
    }

    // Retrieve session + line items from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items'],
    });

    // Basic safety checks
    if (!session) {
      return response.status(404).json({ error: 'Stripe session not found' });
    }

    // Embedded checkout might show different fields; payment_status is the reliable one
    if (session.payment_status !== 'paid') {
      return response.status(400).json({ error: 'Payment not completed' });
    }

    // Insert into orders (NOTE: store totals in cents to avoid float issues)
    const [{ order_id }] = await knex('orders')
      .returning('order_id')
      .insert({
        user_id,
        stripe_session_id: session.id,
        order_status: 'paid',
        order_total_amount: session.amount_total ?? 0, // cents
        order_currency: session.currency ?? 'cad',
        order_created_datetime: knex.fn.now(),
      });

    // Build order_items from Stripe line items
    // Stripe line_item fields are reliable: description, quantity, amount_total
    // unit_amount is on price (might be null depending on how Stripe returns it)
    const stripeItems = session.line_items?.data || [];

    if (stripeItems.length === 0) {
      // Still keep the order, but warn
      return response.status(201).json({
        success: true,
        order_id,
        warning: 'Order created but no line items found on Stripe session. Check expand: ["line_items"].',
      });
    }

    const orderItems = stripeItems.map((li, index) => {
      if (!productIdByIndex[index]) {
        throw new Error("product_id missing for line item");
      }
      const quantity = Number(li.quantity) || 1;

      // Unit price in cents
      const unitAmountCents =
        (li.price && Number(li.price.unit_amount)) ||
        Math.round((Number(li.amount_total || 0) / quantity));

      const lineTotalCents = Number(li.amount_total || unitAmountCents * quantity);

      return {
        order_id,
        product_id: productIdByIndex[index],

        product_name: li.description || 'Item',
        // store decimals in DB (matches your products.product_price type)
        product_price: (unitAmountCents / 100).toFixed(2),
        product_quantity: quantity,
        line_total: (lineTotalCents / 100).toFixed(2),
      };
    });

    await knex('order_items').insert(orderItems);

    return response.status(201).json({ success: true, order_id });
  } catch (error) {
    console.log(error);
    return response.status(500).json({ error: error.message });
  }
};

// Get current user's orders (for dashboard)
const getMyOrders = async (request, response) => {
  const { user_id } = request.user;

  try {
    // order_total_amount is cents in this design
    // item_count computed from quantities
    const orders = await knex('orders as o')
      .join('order_items as oi', 'oi.order_id', 'o.order_id')
      .where('o.user_id', user_id)
      .groupBy('o.order_id')
      .select(
        'o.order_id',
        'o.order_status',
        'o.order_currency',
        'o.order_total_amount',
        'o.order_created_datetime'
      )
      .sum({ item_count: 'oi.product_quantity' })
      .orderBy('o.order_created_datetime', 'desc');

    return response.status(200).json(orders);
  } catch (error) {
    console.log(error);
    return response.status(500).json({ error: error.message });
  }
};

// Get one order + items (protected by ownership)
const getMyOrderDetail = async (request, response) => {
  const { user_id } = request.user;
  const { order_id } = request.params;

  if (!order_id) return response.status(400).json({ error: 'order_id is required' });

  try {
    const order = await knex('orders')
      .select('*')
      .where({ order_id, user_id })
      .first();

    if (!order) return response.status(404).json({ error: 'Order not found' });

    const items = await knex('order_items')
      .select('*')
      .where({ order_id })
      .orderBy('order_item_id', 'asc');

    return response.status(200).json({ order, items });
  } catch (error) {
    console.log(error);
    return response.status(500).json({ error: error.message });
  }
};

module.exports = {
  confirmOrder,
  getMyOrders,
  getMyOrderDetail,
};
