const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const invoiceSchema = new Schema({
    seller: String,
    buyer: String,
    amount: Number,
    paid: Boolean
});

const Invoice = mongoose.model("invoice", invoiceSchema);

module.exports = Invoice;
