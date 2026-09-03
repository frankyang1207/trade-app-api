const connection = require('../knexfile')[process.env.NODE_ENV || 'development'];
const knex = require('knex')(connection);

const PRODUCT_FIELDS = [
    'product_image_link', 'product_name', 'product_description', 'product_price',
    'product_quantity', 'product_for_male', 'product_for_female',
];

const pickFields = (body, fields) => Object.fromEntries(
    fields.filter((field) => body[field] !== undefined).map((field) => [field, body[field]])
);

const sendServerError = (response, error) => {
    console.error('Product service error:', error);
    return response.status(500).json({ error: 'Unable to process product request' });
};

const validateProductNumbers = (product, response) => {
    if (product.product_price !== undefined) {
        const price = Number(product.product_price);
        if (!Number.isFinite(price) || price < 0) {
            response.status(400).json({ error: 'Invalid product price' });
            return false;
        }
        product.product_price = price;
    }
    if (product.product_quantity !== undefined) {
        const quantity = Number(product.product_quantity);
        if (!Number.isInteger(quantity) || quantity < 0) {
            response.status(400).json({ error: 'Invalid product quantity' });
            return false;
        }
        product.product_quantity = quantity;
    }
    return true;
};

const getProducts = async (request, response) => {
    try {
        return response.status(200).json(await knex('products').select('*'));
    } catch (error) {
        return sendServerError(response, error);
    }
};

const getProductById = (productId) => knex('products')
    .select('*').where('product_id', productId).first();

const getProduct = async (request, response) => {
    try {
        const product = await getProductById(request.params.product_id);
        if (!product) return response.status(404).json({ error: 'Product not found' });
        return response.status(200).json(product);
    } catch (error) {
        return sendServerError(response, error);
    }
};

const createProduct = async (request, response) => {
    const { user_id, user_role } = request.user;
    if (!(user_role === 'ADMIN' || user_role === 'VENDOR')) {
        return response.status(403).json({ error: 'User unauthorized' });
    }
    const product = pickFields(request.body || {}, PRODUCT_FIELDS);
    if (!product.product_name || !product.product_description || product.product_price === undefined || product.product_quantity === undefined) {
        return response.status(400).json({ error: 'Product name, description, price, and quantity are required' });
    }
    if (!validateProductNumbers(product, response)) return;

    try {
        const [{ product_id }] = await knex('products').insert({
            ...product,
            product_owner: user_id,
            product_created_datetime: new Date(),
            product_modified_datetime: new Date(),
        }).returning('product_id');
        return response.status(201).json({ product_id, message: 'Product added successfully' });
    } catch (error) {
        return sendServerError(response, error);
    }
};

const updateProduct = async (request, response) => {
    const productId = request.params.product_id;
    const { user_id, user_role } = request.user;
    try {
        const existingProduct = await getProductById(productId);
        if (!existingProduct) return response.status(404).json({ error: 'Product not found' });
        if (user_id !== existingProduct.product_owner && user_role !== 'ADMIN') {
            return response.status(403).json({ error: 'User unauthorized' });
        }
        const updates = pickFields(request.body || {}, PRODUCT_FIELDS);
        if (!validateProductNumbers(updates, response)) return;
        await knex('products').where('product_id', productId)
            .update({ ...updates, product_modified_datetime: new Date() });
        return response.status(200).json({ message: `Product(ID: ${productId}) updated` });
    } catch (error) {
        return sendServerError(response, error);
    }
};

const deleteProduct = async (request, response) => {
    const productId = request.params.product_id;
    const { user_id, user_role } = request.user;
    try {
        const product = await getProductById(productId);
        if (!product) return response.status(404).json({ error: 'Product not found' });
        if (user_id !== product.product_owner && user_role !== 'ADMIN') {
            return response.status(403).json({ error: 'User unauthorized' });
        }
        await knex('products').where('product_id', productId).del();
        return response.status(200).json({ message: `Product(ID: ${productId}) removed` });
    } catch (error) {
        return sendServerError(response, error);
    }
};

module.exports = { getProducts, getProduct, createProduct, updateProduct, deleteProduct };
