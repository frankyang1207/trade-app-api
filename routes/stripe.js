const express = require('express');
const Stripe = require('stripe');
require('dotenv').config();
const stripe = Stripe(process.env.STRIPE_KEY);
router = express.Router()
const user_service = require('../services/users');


router.post('/create-checkout-session', async (req, res) => {
  const user = await user_service.getUserById(req.body?.userId);

  const line_items = req.body.cartItems?.map((item) => {
    return {
      price_data: {
        currency: 'cad',
        product_data: {
          name: item.product_name,
          images: [item.product_image_link],
          description: item.product_description,
          metadata:{
            id: item.product_id
          }
        },
        unit_amount: Math.round(item.product_price * 100),
      },
      quantity: item.cartQuantity,
    }
  })
  const session = await stripe.checkout.sessions.create({
    customer_email: user.user_email,
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
  res.send({clientSecret: session.client_secret, sessionId: session.id});
});


router.get('/session-status', async (req, res) => {
  const session = await stripe.checkout.sessions.retrieve(req.query.session_id);  
  res.send({
    status: session.status,
    customer_email: session.customer_email,
  });
});

// Stripe workbook
// This is your Stripe CLI webhook secret for testing your endpoint locally.
let endpointSecret;
endpointSecret = "whsec_e9948b300105df80ef4018dd5faa8d211c7f2ab78b0c54c53d2ee1e9c0e8c435";

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