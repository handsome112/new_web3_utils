const express = require("express");
const r = (p) => require(process.cwd() + p);
const crypto = require("crypto");
const bodyParser = require("body-parser");
const ethUtil = require("ethereumjs-util");
const sigUtil = require("eth-sig-util");
const mongoose = require("mongoose");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const path = require("path");
const keys = r("/config/keys");
const logger = require("morgan");
const User = r("/models/user-model");
const Invoice = r("/models/invoice-model");
const MongoStore = require("connect-mongo")(session);
const paypalRouter = r("/routes/paypal");
const masspayRouter = r("/routes/masspay");

// @dev: passport.js related
const passport = require("passport");

const app = express();

let userData;
let tempNonce;

// set up view engine
app.set("view engine", "ejs");

app.use(logger("dev"));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(cookieParser());

mongoose.connect(keys.mongodb.dbURI, { useNewUrlParser: true }, () => {
  console.log("connected to mLab MongoDB");
});

app.use(
  session({
    secret: keys.session.cookieKey,
    resave: false,
    saveUninitialized: false, // only create cookies when user is logged in
    // cookie: { secure: true }
    // Persistent Session Store
    store: new MongoStore({
      mongooseConnection: mongoose.connection,
      ttl: 2 * 24 * 60 * 60, // expires after two days
    }),
  })
);

app.use(function (req, res, next) {
  res.locals = {
    pathviews: path.join(__dirname, "views"),
  };
  next();
});

// @dev: passport.js related
app.use(passport.initialize());
app.use(passport.session());
app.use("/css", express.static("views/css"));
app.use("/js", express.static("views/js"));

// @dev: passport.js related
passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

const checkAuth = (req, res, next) => {
  console.log(
    `req.session.passport.user: ${JSON.stringify(req.session.passport)}`
  );

  if (req.isAuthenticated()) {
    req.session.address = "test";
    return next();
  } else {
    console.log("** Not authenticated! **");
    res.redirect("/login");
  }
};

app.get("/", (req, res) => {
  res.render("main", {
    user: null,
  });

  console.log(req.user);
  console.log(req.isAuthenticated());
});

app.get("/login", (req, res) => {
  if (req.isAuthenticated()) {
    // user is already authenticated!
    res.redirect("/profile");
  } else {
    let nonce = crypto.randomBytes(10).toString("hex");
    tempNonce = nonce;
    console.log(tempNonce);
    res.render("login", { nonce: nonce, user: null });
  }
});

app.get("/profile", checkAuth, (req, res) => {
  res.render("profile", {
    user: req.user.address,
    loginCount: req.user.loginCount,
  });
});

app.get("/sign", checkAuth, (req, res) => {
  console.log("req.user", req.user);
  res.render("sign", {
    user: req.user.address,
    wallet: req.user.wallet,
  });
});

app.get("/send", checkAuth, (req, res) => {
  res.render("send", {
    user: req.user.address,
    wallet: req.user.wallet,
  });
});

app.get("/invoice", checkAuth, (req, res) => {
  console.log(req.user.address, req.session.address);
  Invoice.find({ buyer: req.user.address }).then((receivedInvoices) => {
    if (receivedInvoices) {
      Invoice.find({ seller: req.user.address }).then((sentInvoices) => {
        if (sentInvoices) {
          res.render("invoice", {
            receivedInvoices,
            sentInvoices,
            user: req.user.address,
            wallet: req.user.wallet,
          });
        } else {
          res.send(false);
        }
      });
    } else {
      res.send(false);
    }
  });
  // Invoice.find({})
});

app.get("/logout", (req, res) => {
  // req.logout();
  req.session.destroy();
  res.redirect("/login");
});

app.get("/test", (req, res) => {
  res.render("test");
});

app.use('/paypal', paypalRouter)
app.use('/masspay', masspayRouter)

// Verify the signature after the client signs the nonce and passes the signature
app.post("/submit", async (req, res) => {
  // res.render("profile", { user: req.body.address });
  userData = req.body;
  console.log(req.body);

  // Verify the address from the signed signature!
  const msg = `You're about to sign this random string: '${tempNonce}' to prove your identity.`;
  const msgBufferHex = ethUtil.bufferToHex(Buffer.from(msg, "utf8"));
  const recoveredAddress = sigUtil.recoverPersonalSignature({
    data: msgBufferHex,
    sig: userData.signature,
  });

  console.log("=========", recoveredAddress, userData.address);

  if (recoveredAddress.toLowerCase() === userData.address.toLowerCase()) {
    console.log("verified!");
    User.findOne({ address: recoveredAddress }).then((currentUser) => {
      if (currentUser) {
        // if found user in DB
        console.log("Found user: " + currentUser);

        currentUser.loginCount += 1;
        currentUser.wallet = userData?.wallet;
        // TODO: update nonce

        currentUser.save((err, updatedUser) => {
          // after login() function, will call `serializeUser()`
          // and return the userID from database
          console.log("updatedUser", updatedUser);
          req.login(updatedUser, (err) => {
            console.log("*** LOGIN? ***");

            if (err) {
              console.log(err);
            }

            return res.redirect("/profile");
          });
        });
      } else {
        // this account has not logged in before, create new record in DB!
        console.log("Create new User record in DB..");
        new User({
          address: recoveredAddress,
          nonce: tempNonce,
          loginCount: 1,
          wallet: userData?.wallet,
        })
          .save()
          .then((newUser) => {
            console.log("new user created: " + newUser);

            req.login(newUser, (err) => {
              return res.redirect("/profile");
            });
          });
      }
    });
  } else {
    res.send("Opps! The address verification failed!");
    userData = null;
  }
});

app.post("/createInvoice", (req, res) => {
  console.log(req.body);
  new Invoice({
    buyer: req.body.buyer.toLowerCase(),
    seller: req.body.seller.toLowerCase(),
    amount: parseFloat(req.body.amount),
    paid: false,
  })
    .save()
    .then((newInvoice) => {
      console.log("new invoice created: " + newInvoice);
      res.send(newInvoice);
    });
});
app.post("/payInvoice", (req, res) => {
  const pid = req.body._id;
  Invoice.findById(pid).then((invoice) => {
    if (invoice) {
      invoice.paid = true;
      invoice.save((err, newInvoice) => {
        res.send(newInvoice);
      });
    } else {
      res.send(false);
    }
  });
});

app.listen(4444, () => {
  console.log("app now listening on port 4444...");
});

//test
