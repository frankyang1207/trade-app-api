  // Libraries
  const express = require('express');
  const Stripe = require('stripe');
  require('dotenv').config();
  const stripe = Stripe(process.env.STRIPE_KEY);
  const router = express.Router();
  const user_service = require('../services/users');
  const middleware = require('../middleware/middleware');
  const connection = require('../knexfile')[process.env.NODE_ENV || 'development'];
  const knex = require('knex')(connection);

  /**
   * Stripe Checkout routes.
   */

  // Create Stripe session 
  router.post('/create-checkout-session', middleware.authenticateToken, async (req, res) => {
    const { user_id } = req.user;
    const cartItems = req.body.cartItems;

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart items are required' });
    }

    const quantitiesByProductId = new Map();
    for (const item of cartItems) {
      const productId = Number(item.product_id);
      const quantity = Number(item.cartQuantity);

      if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ error: 'Cart contains an invalid product or quantity' });
      }

      quantitiesByProductId.set(
        productId,
        (quantitiesByProductId.get(productId) || 0) + quantity
      );
    }

    try {
      const user = await user_service.getUserById(user_id);
      if (!user) return res.status(404).json({ error: 'Account not found' });

      const productIds = [...quantitiesByProductId.keys()];
      const products = await knex('products').select('*').whereIn('product_id', productIds);
      if (products.length !== productIds.length) {
        return res.status(400).json({ error: 'Cart contains an unavailable product' });
      }

      const line_items = products.map((item) => {
        const quantity = quantitiesByProductId.get(item.product_id);
        if (quantity > item.product_quantity) {
          throw new RangeError(`Insufficient stock for ${item.product_name}`);
        }

        const product_data = {
          name: item.product_name,
          images: item.product_image_link ? [item.product_image_link] : [],
          metadata: { id: String(item.product_id) },
        };

        const description = (item.product_description ?? '').trim();
        if (description) product_data.description = description;

        return {
          price_data: {
            currency: 'cad',
            product_data,
            unit_amount: Math.round(Number(item.product_price) * 100),
          },
          quantity,
        };
      });

      const session = await stripe.checkout.sessions.create({
        customer_email: user.user_email,
        metadata: { user_id: String(user_id) },
        ui_mode: 'embedded',
        redirect_on_completion: 'never',
        payment_method_types: ['card'],
        shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: {
              amount: 0,
              currency: 'cad',
            },
            display_name: 'Free shipping',
            delivery_estimate: {
              minimum: {
                unit: 'business_day',
                value: 5,
              },  
              maximum: {
                unit: 'business_day',
                value: 7,
              },
            },
          },
        },
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: {
              amount: 1500,
              currency: 'cad',
            },
            display_name: 'Next day air',
            delivery_estimate: {
              minimum: {
                unit: 'business_day',
                value: 1,
              },
              maximum: {
                unit: 'business_day',
                value: 1,
              },
            },
          },
        },
        ],
        line_items,
        mode: 'payment',
      });
      return res.send({clientSecret: session.client_secret, sessionId: session.id});
    } catch (error) {
      if (error instanceof RangeError) return res.status(400).json({ error: error.message });
      console.error('Checkout session error:', error);
      return res.status(500).json({ error: 'Unable to create checkout session' });
    }
  });

  // Fetch Stripe session status 
  router.get('/session-status', middleware.authenticateToken, async (req, res) => {
    const session = await stripe.checkout.sessions.retrieve(req.query.session_id);  
    if (String(session.metadata?.user_id) !== String(req.user.user_id)) {
      return res.status(403).json({ error: 'Checkout session does not belong to this user' });
    }
    return res.send({ status: session.status });
  });

  // Stripe workbook
  // This is your Stripe CLI webhook secret for testing your endpoint locally.
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  router.post('/webhook', express.raw({type: 'application/json'}), (request, response) => {
    const sig = request.headers['stripe-signature'];
    let data;
    let eventType;
    let event;
    
    if (endpointSecret) {
      try {
        event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
        console.log('webhook verified');
      } catch (err) {
        console.log(`webhook Error ${err.message}`);
        response.status(400).send(`Webhook Error: ${err.message}`);
        return;
      }
      
      data = event.data.object;
      eventType = event.type;
    } else {
      data = req.body.data.object;
      eventType = req.body.type
    }

    // Handle the event
    if (eventType === 'checkout.session.completed') {
      stripe.customers.retrieve(data.customer).then((customer) => {
      }).catch((err) => console.log(err.message))
    }

    // Return a 200 response to acknowledge receipt of the event
    response.send().end();
  });

  module.exports = router;
