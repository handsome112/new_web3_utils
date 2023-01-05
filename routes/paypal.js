const { Router } = require('express');
const axios = require('axios');
const r = (p) => require(process.cwd() + p);
const paypalRouter = Router();
const paypal = require('paypal-rest-sdk');
const {paypal : config} = r('/config/keys');

paypal.configure({
    'mode': 'sandbox', //sandbox or live
    'client_id': config.API_CLIENT,
    'client_secret': config.API_SECRET
});

const testCreate = (req, res) => {
    const {amount, currency, seller, app_id} = req.body;
    var create_payment_json = {
        "intent": "sale",
        "payer": {
            "payment_method": "paypal"
        },
        "redirect_urls": {
            "return_url": "http://localhost:4444/paypal/capture-order",
            "cancel_url": "http://localhost:4444/cancel-payment"
        },
        "transactions": [{
            "item_list": {
                "items": [{
                    "name": "item",
                    "sku": "item",
                    "price": "1.00",
                    "currency": "USD",
                    "quantity": 1
                }]
            },
            "amount": {
                "currency": currency,
                "total": amount
            },
            "description": "This is the payment description."
        }]
    };


    paypal.payment.create(create_payment_json, function (error, payment) {
        if (error) {
            console.log("unknown error occured");
            throw error;
            res.json(error);
        } else {
            console.log("Create Payment Response");
            console.log(payment);
            res.json(payment);
        }
    });
}

const createOrder = async (req, res) => {
    console.log('create order');
    const {amount, currency, seller, app_id} = req.body;
    try {
        const order = {
            intent: "CAPTURE",
            purchase_units: [
                {
                    amount: {
                        currency_code: currency,
                        value: amount,
                    },
                    custom_id: app_id,
                    payee: {
                        email_address: seller
                    }
                },
            ],
            application_context: {
                brand_name: "catchy.com",
                landing_page: "NO_PREFERENCE",
                user_action: "PAY_NOW",
                return_url: `http://localhost:4444/paypal/capture-order`,
                cancel_url: `http://localhost:4444/cancel-payment`,
            },
        };


        // format the body
        const params = new URLSearchParams();
        params.append("grant_type", "client_credentials");

        

        // Generate an access token
        const {
            data: { access_token },
        } = await axios.post(
            "https://api-m.sandbox.paypal.com/v1/oauth2/token",
            params,
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                auth: {
                    username: config.API_CLIENT,
                    password: config.API_SECRET,
                },
            }
        );

        // make a request
        const response = await axios.post(
            `${config.API}/v2/checkout/orders`,
            order,
            {
                headers: {
                    Authorization: `Bearer ${access_token}`,
                },
            }
        );

        return res.json(response.data);
    } catch (error) {
        console.log(error.message);
        return res.status(500).json("Something goes wrong");
    }
};

const captureOrder = async (req, res) => {
    const { token } = req.query;

    try {
        const response = await axios.post(
            `${config.API}/v2/checkout/orders/${token}/capture`,
            {},
            {
                auth: {
                    username: config.API_CLIENT,
                    password: config.API_SECRET,
                },
            }
        );

        console.log(response.data);

        res.render("paypal", {
            user: null,
            noti: `Successful Paid; Pay ID is ${token}`
        })
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ message: "Internal Server error" });
    }
};

paypalRouter.get('/', (req, res) => {
    res.render("paypal", {
        user: null,
        noti: null
    })
})

paypalRouter.get('/capture-order', captureOrder)

paypalRouter.post('/create-order', createOrder)

module.exports = paypalRouter;
