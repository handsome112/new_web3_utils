const { Router } = require('express');
const axios = require('axios');
const r = (p) => require(process.cwd() + p);
const masspayRouter = Router();
const paypal = require('paypal-rest-sdk');
const {paypal : config} = r('/config/keys');

paypal.configure({
    'mode': 'sandbox', //sandbox or live
    'client_id': config.PAYPAL_API_CLIENT,
    'client_secret': config.PAYPAL_API_SECRET
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
    console.log(amount, currency, seller, app_id, req.body)
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
                    username: config.PAYPAL_API_CLIENT,
                    password: config.PAYPAL_API_SECRET,
                },
            }
        );

        console.log(access_token);

        // make a request
        const response = await axios.post(
            `${config.PAYPAL_API}/v2/checkout/orders`,
            order,
            {
                headers: {
                    Authorization: `Bearer ${access_token}`,
                },
            }
        );

        console.log(response.data);

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
            `${config.PAYPAL_API}/v2/checkout/orders/${token}/capture`,
            {},
            {
                auth: {
                    username: config.PAYPAL_API_CLIENT,
                    password: config.PAYPAL_API_SECRET,
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

masspayRouter.get('/', (req, res) => {
    res.render("masspay", {
        user: null,
        noti: null
    })
})

masspayRouter.get('/capture-order', captureOrder)

masspayRouter.post('/create-order', testCreate)
module.exports = masspayRouter;