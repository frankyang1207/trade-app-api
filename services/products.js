const connection = require('../knexfile')[process.env.NODE_ENV || 'development'];
const knex = require('knex')(connection);
const {formidable} = require('formidable');
const dotenv = require('dotenv');
dotenv.config();

// get all products
const getProducts = async (request, response) => {
    try {
        const products =  await knex('products')
            .select('*');
        return response.status(200).json(products);
    } catch (error) {
        return response.status(500).send(error.message);
    }
}

// get product info
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
        response.status(500).json({ error: error.message });
    }
}

const getProductById = async (product_id) => {
    try {
        const product =  await knex('products')
            .select('*')
            .where('product_id', product_id);
        return product;
    } catch (error) {
        response.status(500).json({ error: error.message });
    }
}


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
    if (!user_role == "ADMIN" || !user_role == "VENDOR") {
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
        response.status(500).json({ error: error.message });
    }
}

const updateProduct = async (request, response) => {
    const { product_id, product_owner, ...rest } = request.body;
    const { user_id, user_role } = request.user;
    if (!product_id) {
        return response.status(400).json({ error: 'Bad request' });
    }
    try {
        const [{product_owner}] = await getProductById(product_id);
        // product can only be updated by admin or owner
        if ((user_id != product_owner) && (user_role != 'ADMIN')) {
            return response.status(403).json({ error: 'User unauthorized' });
        }
        await knex('products')
            .where('product_id', product_id)
            .update({...rest});
        response.status(200).json({ message: `Product(ID: ${product_id}) updated` });
    } catch (error) {
        response.status(500).json({ error: error.message });
    }
}

const deleteProduct = async (request, response) => {
    const { product_id, ...rest } = request.body;
    const { user_id, user_role } = request.user;
    if (!product_id) {
        return response.status(400).json({ error: 'Bad request' });
    }
    try {
        const [{product_owner}] = await getProductById(product_id);
        // product can only be DELETED by admin or owner
        if ((user_id != product_owner) && (user_role != 'ADMIN')) {
            return response.status(403).json({ error: 'User unauthorized' });
        }
        const product = await getProductById(product_id);
        if (product.length == 0) {
            return response.status(401).json({ error: 'Entry not found' });
        }
        await knex('products')
            .where('product_id', product_id)
            .del();
        response.status(200).json({ message: `Product(ID: ${product_id}) removed` });
    } catch (error) {
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
