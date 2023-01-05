const { Router } = require('express');
const axios = require('axios');
const r = (p) => require(process.cwd() + p);
const masspayRouter = Router();
const paypal = require('paypal-rest-sdk');
const { paypal: config } = r('/config/keys');

paypal.configure({
    'mode': 'sandbox', //sandbox or live
    'client_id': config.API_CLIENT,
    'client_secret': config.API_SECRET
});

const testCreate = (req, res) => {
    const { amount, currency, seller, app_id } = req.body;

    var sender_batch_id = Math.random().toString(36).substring(9);

    // var create_payment_json = {
    //     "intent": "sale",
    //     "payer": {
    //         "payment_method": "masspay"
    //     },
    //     "redirect_urls": {
    //         "return_url": "http://localhost:4444/masspay/capture-order",
    //         "cancel_url": "http://localhost:4444/cancel-payment"
    //     },
    //     "transactions": [{
    //         "item_list": {
    //             "items": [{
    //                 "name": "item",
    //                 "sku": "item",
    //                 "price": "1.00",
    //                 "currency": "USD",
    //                 "quantity": 1
    //             }]
    //         },
    //         "amount": {
    //             "currency": currency,
    //             "total": amount
    //         },
    //         "description": "This is the payment description."
    //     }]
    // };

    var create_payout_json = {
        "sender_batch_header": {
            "sender_batch_id": sender_batch_id,
            "email_subject": "You have a payment"
        },
        "items": [
            {
                "recipient_type": "EMAIL",
                "amount": {
                    "value": amount,
                    "currency": currency
                },
                "receiver": "handsome920112@gmail.com",
                "note": "Thank you.",
                "sender_item_id": "item_1"
            }
        ]
    };



    paypal.payout.create(create_payout_json, function (error, payment) {
        if (error) {
            console.log("Error occured during payment pereforming !");
            throw error;
            res.json(error);
        } else {
            console.log("Create Payment Response with Batch");
            console.log(payment);
            res.json(payment);
        }
    });
}

const createOrder = async (req, res) => {
    console.log('create order');
    const { amount, currency, seller, app_id } = req.body;
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

        const {
            data: { access_token },
        } = await axios.post(
            "https://api-3t.sandbox.paypal.com/nvp",
            params,
            {
                USER: config.USER_ID,
                PWD: config.API_CLIENT,
                SIGNATURE: config.API_SECRET,

                METHOD: 'SetExpressCheckout',
                VERSION: 98,
                PAYMENTREQUEST_0_AMT: 10,
                PAYMENTREQUEST_0_CURRENCYCODE: 'USD',
                PAYMENTREQUEST_0_PAYMENTACTION: 'SALE',
                return_url: `http://localhost:4444/paypal/capture-order`,
                cancel_url: `http://localhost:4444/cancel-payment`,
            }
        );

        console.log(access_token);

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
            `${config.API}/v2/checkout/orders/${token}/capture`,
            {},
            {
                auth: {
                    username: config.MASS_API_CLIENT,
                    password: config.MASS_API_SECRET,
                },
            }
        );

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

masspayRouter.post('/create-order', createOrder)
module.exports = masspayRouter;
