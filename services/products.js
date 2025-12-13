const connection = require('../knexfile')[process.env.NODE_ENV || 'development'];
const knex = require('knex')(connection);
const {formidable} = require('formidable');
const dotenv = require('dotenv');
dotenv.config();

// Fetch all products
const getProducts = async (request, response) => {
    try {
        const products =  await knex('products')
            .select('*');
        return response.status(200).json(products);
    } catch (error) {
        console.log(error)
        return response.status(500).send(error.message);
    }
}

// Get a single product by its product_id
const getProduct = async (request, response) => {
    const { product_id } = request.params;
    if (!product_id) {
        return response.status(400).send(`Bad request`);
    }
    try {
        const product =  await knex('products')
            .select('*')
            .where('product_id', product_id);
        response.status(200).json(product);
    } catch (error) {
        console.log(error)
        response.status(500).json({ error: error.message });
    }
}

// Fetch a product by ID (internal helper)
const getProductById = async (product_id) => {
    try {
        const product =  await knex('products')
            .select('*')
            .where('product_id', product_id);
        return product;
    } catch (error) {
        console.log(error)
        response.status(500).json({ error: error.message });
    }
}

// Create a new product (restricted to ADMIN or VENDOR roles)
const createProduct = async (request, response) => {
    const { product_image_link,
            product_name, 
            product_description,
            product_price,
            product_quantity,
            product_for_male,    
            product_for_female
        } = request.body;
    const { user_id, user_role } = request.user;
    if (!product_name || !product_price ) { 
        return response.status(400).json({ error: 'Bad request' });
    }
    if (!(user_role == "ADMIN" || user_role == "VENDOR")) {
        return response.status(403).json({ error: 'User unauthorized' });
    }
    try {
        const [{product_id}] = await knex('products')
            .returning('product_id')
            .insert({
                product_image_link,
                product_name, 
                product_price,
                product_quantity,
                product_for_male,    
                product_for_female,
                product_description, 
                product_created_datetime: new Date(),
                product_modified_datetime: new Date(),
                product_owner: user_id });
        response.status(201).json({ product_id, message: 'Product added successfully' });
    } catch (error) {
        console.log(error)
        response.status(500).json({ error: error.message });
    }
}

// Update a product (restricted to product owner or ADMIN)
const updateProduct = async (request, response) => {
    const { product_id: productIdParam } = request.params;
    const { user_id, user_role } = request.user;
    const {
    product_owner,            // disallow client-side owner changes
    product_created_datetime, // immutable
    product_id,               // id comes from params, not body
    ...updates
  } = request.body || {};
    if (!productIdParam) {
        return response.status(400).json({ error: 'Product ID is required' });
    }
    try {
        const [{product_owner}] = await getProductById(productIdParam);
        if (!product) {
            return response.status(404).json({ error: 'Product not found' });
        }

        // Authorization check: must be owner or ADMIN
        if ((user_id != product_owner) && (user_role != 'ADMIN')) {
            return response.status(403).json({ error: 'User unauthorized' });
        }

        // Input validation for price
        if (updates.product_price != null) {
            const priceNum = Number(updates.product_price);
            if (!Number.isFinite(priceNum) || priceNum < 0) {
                return response.status(400).json({ error: 'Invalid product pirce' });
            }
            updates.product_price = priceNum;
        }

        // Input validation for quantity
        if (updates.product_quantity != null) {
            const qty = Number(updates.product_quantity);
            if (!Number.isInteger(qty) || qty < 0) {
                return response.status(400).json({ error: 'Invalid product quantity' });
            }
            updates.product_quantity = qty;
        }

        // Update modified timestamp
        updates.product_modified_datetime = knex.fn.now();

        await knex('products')
            .where('product_id', productIdParam)
            .update(updates);
        response.status(200).json({ message: `Product(ID: ${productIdParam}) updated` });
    } catch (error) {
        console.log(error)
        response.status(500).json({ error: error.message });
    }
}

// Delete a product (restricted to product owner or ADMIN)
const deleteProduct = async (request, response) => {
    const { product_id: productIdParam } = request.params;
    const { user_id, user_role } = request.user;
    if (!productIdParam) {
        return response.status(400).json({ error: 'Bad request' });
    }
    try {
        const [{product_owner}] = await getProductById(productIdParam);
        // Authorization check: must be owner or ADMIN
        if ((user_id != product_owner) && (user_role != 'ADMIN')) {
            return response.status(403).json({ error: 'User unauthorized' });
        }
        const product = await getProductById(productIdParam);
        if (product.length == 0) {
            return response.status(401).json({ error: 'Entry not found' });
        }
        await knex('products')
            .where('product_id', productIdParam)
            .del();
        response.status(200).json({ message: `Product(ID: ${productIdParam}) removed` });
    } catch (error) {
        console.log(error)
        response.status(500).json({ error: error.message });
    }
}



module.exports = {
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
}
