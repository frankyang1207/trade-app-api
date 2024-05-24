    const connection = require('../knexfile')[process.env.NODE_ENV || 'development'];
    const knex = require('knex')(connection);
    const dotenv = require('dotenv');
    const jwt = require('jsonwebtoken');
    const bcrypt = require("bcrypt");

    const saltRounds = 10;
    dotenv.config();

    // get all users, only accessible to admin
    const getUsers = async (request, response) => {
        const user_role = request.user.user_role;
        if (user_role != 'ADMIN') {
            response.status(403).json({ error: 'User unauthorized' });
            return;
        }
        try {
            const users =  await knex('users')
                .select('*');
            data = users.map(user => {
                delete user.user_password_hash;
            })
            response.status(200).json(users);
        } catch (error) {
            throw error;
        }
    }

    // get user info
    const getUser = async (request, response) => {
        const { user_id, user_role } = request.user;
        const req_user_id = request.params.user_id;
        if ((user_id != req_user_id) && (user_role != 'ADMIN')) {
            response.status(403).json({ error: 'User unauthorized' });
            return;
        }
        try {
            let user = await getUserById(req_user_id);
            if (!user) {
                return response.status(404).json({ error: 'Account not found' });
            }
            delete user.user_password_hash;
            response.status(200).json(user);
        } catch (error) {
            throw error;
        }
    }

    // get user info using user id
    const getUserById = async (user_id) => {
        try {
            let user = await knex('users')
                .select('*')
                .where('user_id', user_id)
                .first();
            return user;
        } catch (error) {
            throw error;
        }
    }

    // get user info using user email
    const getUserByEmail = async (user_email) => {
        try {
            let user = await knex('users')
                .select('*')
                .where('user_email', user_email)
                .first();
            return user;
        } catch (error) {
            throw error;
        }
    }

    // create a new user
    const createUser = async (request, response) => {
        const { user_email, user_password, ...rest } = request.body;
        const user = await getUserByEmail(user_email);
        if (user) {
            return response.status(409).json({ error: 'Account with this email already exists' });
        }
        // hash password
        const user_password_hash = await bcrypt.hash(user_password, saltRounds);
        try {
            //create user
            const [{user_id, user_role}] = await knex('users')
            .returning(['user_id', 'user_role'])
                .insert({
                    user_role: 'USER', 
                    user_email, 
                    user_password_hash, 
                    user_created_datetime: new Date(),
                    user_modified_datetime: new Date(),
                    ...rest 
                });
            // User login
            const data = { user_id, user_role  };
            const access_token = generateAccessToken(data);
            
            const refresh_token = jwt.sign(data, process.env.REFRESH_TOKEN_SECRET);
            await knex('tokens').insert({ token_user_id: user_id, token_content: refresh_token });

            response.status(201).json({
                user_id,
                user_role,
                message: 'Account created and logged in',
                access_token,
                refresh_token
            });
        } catch (error) {
            throw error;
        }
    }

    // update a user
    const updateUser = async (request, response) => {
        const { user_password, ...rest } = request.body;
        const user_email = request.body.user_email;
        const { user_id, user_role } = request.user;
        const req_user_id = request.body.user_id;
        // user can only be updated by admin or the same person
        if ((user_id != req_user_id) && (user_role != 'ADMIN')) {
            response.status(403).json({ error: 'User unauthorized' });
            return;
        }
        // hash the password if it is in the req
        let user_password_hash = "";
        if (user_password) {
            user_password_hash = await bcrypt.hash(user_password, saltRounds);
        }
        // if duplicate email
        if (user_email) {
            const user = await getUserByEmail(user_email);
            if (user) {
                return response.status(409).json({ error: 'Account with this email already exists' });
            }
        }
        try {
            await knex('users')
                .where('user_id', user_id)
                .update((user_password) ? 
                {user_password_hash, user_modified_datetime: new Date(), ...rest} 
                : {user_modified_datetime: new Date(), ...rest});
            response.status(200).json({message: `Account(ID: ${user_id}) updated`});
        } catch (error) {
            throw error;
        }
    }

    const deleteUser = async (request, response) => {
        const { user_id, user_role } = request.user;
        const req_user_id = request.body.user_id;
        // user can only be removed by admin or the same person
        if ((user_id != req_user_id) && (user_role != 'ADMIN')) {
            response.status(403).json({ error: 'User unauthorized' });
            return;
        }
        try {
            await knex('tokens')
                .where('token_user_id', req_user_id)
                .del();
            await knex('products')
                .where('product_owner', req_user_id)
                .del();
            await knex('users')
                .where('user_id', req_user_id)
                .del();
            response.status(200).json({ message: `Account(ID: ${req_user_id}) removed`});
        } catch (error) {
            throw error;
        }
    }

    const login = async (request, response) => {
        const { user_email, user_password } = request.body;
        if (!user_email || !user_password) {
            return response.status(400).json({ error: 'Missing email or password' });
        }
        try {
            const user = await getUserByEmail(user_email);
            // can't find user
            if (!user) {
                return response.status(401).json({ error: 'Account not found' });
            }
            const checkPassword = bcrypt.compareSync(user_password, user.user_password_hash);
            // wrong password
            if (!checkPassword) {
                return response.status(401).json({ error: 'Wrong password' });
            }
            // create then pass access token to client and save refresh token
            const data = { 'user_id': user.user_id, 'user_role': user.user_role };
            const access_token = generateAccessToken(data);
            
            const [token] = await knex('tokens')
                .select('*')
                .where('token_user_id', user.user_id);
            if (token) {
                return response.json({ 
                'message': 'Account logged in',
                'user_id': user.user_id,
                'user_image_link': user.user_image_link,
                'user_role': user.user_role,
                access_token,
                'refresh_token': token.token_content
                });
            }
            const refresh_token = jwt.sign(data, process.env.REFRESH_TOKEN_SECRET)
            await knex('tokens')
                .insert({'token_user_id': user.user_id, 'token_content': refresh_token });
            response.json({ 
                'message': 'Account logged in',
                'user_id': user.user_id,
                'user_image_link': user.user_image_link,
                'user_role': user.user_role,
                access_token,
                refresh_token 
            });
        } catch (error) {
            throw error;
        }
    }

    const logout = async (request, response) => {
        const refresh_token = request.body.token;
        if (!refresh_token) {
            return response.status(401).json({ error: 'Token not found' });
        }
        try {
            const isLoggedIn = await checkLoggedIn(refresh_token);
            if (!isLoggedIn) {
                return response.status(200).json({ message: "Account logged out" });
            }
            const tokens = await knex('tokens')
                .where('token_content', refresh_token)
                .del()
            if (tokens.length == 0) {
                return response.status(200).json({ message: "Account logged out" });
            }
            response.status(200).json({ message: "Account logged out" });
        }
        catch (error) {
            throw error;
        }
    }

    const token = async (request, response) => {
        const refresh_token = request.body.token;
        if (!refresh_token) {
            return response.status(401).json({ error: 'Token not found' });
        }
        try {
            const isLoggedIn = await checkLoggedIn(refresh_token);
            if (!isLoggedIn) {
                return response.status(403).json({ error: 'Invalid session' });
            }
            jwt.verify(refresh_token, process.env.REFRESH_TOKEN_SECRET, (error, user) => {
                if (error) {
                    return response.status(403).json({ error: 'Invalid session' });
                }
                const data = { 'user_id': user.user_id, 'user_role': user.user_role };
                const access_token = generateAccessToken(data);
                response.json({access_token});
            })
        }
        catch (error) {
            throw error;
        }
    }


    const generateAccessToken = (user) => {
        return(jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' }));
    }


    const checkLoggedIn = async (refresh_token) => {
        const tokens = await knex('tokens')
            .select('*')
            .where('token_content', refresh_token);
        return (tokens.length > 0);
    }


    module.exports = {
        getUsers,
        getUserById,
        getUser,
        createUser,
        updateUser,
        deleteUser,
        login,
        token,
        logout
    }
