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
    return response.status(400).json({
      error: "sessionId is required",
    });
  }

  try {
    // 1. Prevent duplicate order creation
    const existing = await knex("orders")
      .select("order_id")
      .where({
        stripe_session_id: sessionId,
        user_id,
      })
      .first();

    if (existing) {
      return response.status(200).json({
        success: true,
        order_id: existing.order_id,
        message: "Order already confirmed",
      });
    }

    // 2. Retrieve the Checkout Session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items.data.price.product"],
    });

    if (!session) {
      return response.status(404).json({
        error: "Stripe session not found",
      });
    }

    // 3. Verify payment
    if (session.payment_status !== "paid") {
      return response.status(400).json({
        error: "Payment not completed",
      });
    }

    if (String(session.metadata?.user_id) !== String(user_id)) {
      return response.status(403).json({
        error: "Checkout session does not belong to this user",
      });
    }

    const stripeItems = session.line_items?.data || [];

    if (stripeItems.length === 0) {
      return response.status(400).json({
        error: "No line items found in Stripe session",
      });
    }

    // 4. Everything DB-related happens in one transaction
    const order_id = await knex.transaction(async (trx) => {
      // Create parent order FIRST
      const [order] = await trx("orders")
        .insert({
          user_id,
          stripe_session_id: session.id,
          order_status: "paid",
          order_total_amount: session.amount_total ?? 0,
          order_currency: session.currency ?? "cad",
          order_created_datetime: knex.fn.now(),
        })
        .returning("order_id");

      const newOrderId = order.order_id;

      // 5. Build order items after we have the order_id
      const orderItems = stripeItems.map((li) => {
        const productId = Number(li.price?.product?.metadata?.id);

        if (!Number.isInteger(productId) || productId < 1) {
          throw new Error("Stripe line item is missing valid product metadata");
        }

        const quantity = Number(li.quantity);
        if (!Number.isInteger(quantity) || quantity < 1) {
          throw new Error("Stripe line item has an invalid quantity");
        }

        const unitAmountCents =
          li.price?.unit_amount != null
            ? Number(li.price.unit_amount)
            : Math.round(
                Number(li.amount_total || 0) / quantity
              );

        return {
          order_id: newOrderId,
          product_id: productId,
          product_name: li.description || "Item",
          product_unit_amount: unitAmountCents,
          product_quantity: quantity,
        };
      });

      // 6. Insert all items
      await trx("order_items").insert(orderItems);

      return newOrderId;
    });

    return response.status(201).json({
      success: true,
      order_id,
    });
  } catch (error) {
    console.error("Order confirmation error:", error);

    return response.status(500).json({
      error: error.message,
    });
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
