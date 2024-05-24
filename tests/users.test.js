const request = require("supertest")
const app = require("../index")

require("dotenv").config();


const reqUser = {
    user_email:"test1@gmail.com", 
    user_password:"password"
}


let user_id;
let token;
let server;


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


describe("GET /users", () => {
    it("should return all users", async () => {
        return request(app)
            .get("/users")
            .set('Authorization', `Bearer ${token}`)
            .expect('Content-Type', /json/)
            .expect(403)
            .then((res) => {
                expect(res.statusCode).toBe(403);
            })
    });
});


describe("GET /user/:user_id", () => {
    it("should return a user", async () => {
        return request(app)
            .get(`/user/${user_id}`)
            .set('Authorization', `Bearer ${token}`)
            .expect('Content-Type', /json/)
            .expect(200)
            .then((res) => {
                expect(res.statusCode).toBe(200);
            })
    });
});

describe("PUT /user", () => {
    it("should update a product", async () => {
        return request(app)
            .put("/user")
            .set('Authorization', `Bearer ${token}`)
            .send({ user_id, user_role: "ADMIN" })
            .expect(200)
            .then((res) => {
                expect(res.statusCode).toBe(200);
            })
    });
});


describe("POST /login", () => {
    test("should login a user", async () => {
        return request(app)
            .post('/login')
            .send(reqUser)
            .expect(200)
            .then(({ body })=>
            {
                user_id = body.user_id;
                token = body.access_token; 
            })
    });
});

describe("GET /users", () => {
    it("should return all users", async () => {
        return request(app)
            .get("/users")
            .set('Authorization', `Bearer ${token}`)
            .expect('Content-Type', /json/)
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

