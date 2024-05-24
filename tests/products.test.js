const request = require("supertest")
const app = require("../index")

require("dotenv").config();


const reqUser = {
    user_email:"test@gmail.com", 
    user_password:"password"
}

const reqProduct = {
    product_name: "product_test",
    product_description: "product_descption",
    product_price: 10.99
}

let user_id;
let token;
let product_id;

describe("POST /user", () => {
    test("should create a user", async () => {
        return request(app)
            .post('/user')
            .send(reqUser)
            .expect(201)
            .then(({ body })=>
            {
                user_id = body.user_id;
                token = body.access_token; 
            })
    });
});


describe("GET /products", () => {
    it("should return all products", async () => {
        return request(app)
            .get("/products")
            .expect('Content-Type', /json/)
            .expect(200)
            .then((res) => {
                expect(res.statusCode).toBe(200);
            })
    });
});



describe("POST /product", () => {
    it("should create a product", async () => {
        return request(app)
            .post("/product")
            .set('Authorization', `Bearer ${token}`)
            .send(reqProduct)
            .expect(201)
            .then(({ body }) => {
                product_id = body.product_id;
            })
    });
});

describe("GET /product/:product_id", () => {
    it("should return a product", async () => {
        return request(app)
            .get(`/product/${product_id}`)
            .expect('Content-Type', /json/)
            .expect(200)
            .then((res) => {
                expect(res.statusCode).toBe(200);
            })
    });
});

describe("PUT /product", () => {
    it("should update a product", async () => {
        return request(app)
            .put("/product")
            .set('Authorization', `Bearer ${token}`)
            .send({ product_id, product_name: "test" })
            .expect(200)
            .then((res) => {
                expect(res.statusCode).toBe(200);
            })
    });
});

describe("DELETE /product", () => {
    it("should delete a product", async () => {
        return request(app)
            .delete("/product")
            .set('Authorization', `Bearer ${token}`)
            .send({ product_id })
            .expect(200)
            .then((res) => {
                expect(res.statusCode).toBe(200);
            })
    });
});

describe("DELETE /user", () => {
    it("should delete a user", async () => {
        return request(app)
            .delete("/user")
            .set('Authorization', `Bearer ${token}`)
            .send({ user_id })
            .expect(200)
            .then((res) => {
                expect(res.statusCode).toBe(200);
            })
    });
});
