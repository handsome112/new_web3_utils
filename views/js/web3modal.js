"use strict";

/**
 * Example JavaScript code that interacts with the page and Web3 wallets
 */

// Unpkg imports
const Web3Modal = window.Web3Modal.default;
const WalletConnectProvider = window.WalletConnectProvider.default;
const EvmChains = window.EvmChains;
const Fortmatic = window.Fortmatic;

// Web3modal instance
let web3Modal;

// Chosen wallet provider given by the dialog window
// let provider;
let provider = new WalletConnectProvider({
  infuraId: "a92faac6e14345c0863377643370c015",
});

// Address of the selected account
let selectedAccount;
let web3;
let accounts;

/**
 * Setup the orchestra
 */
async function init() {
  console.log("Initializing example");
  console.log("WalletConnectProvider is", WalletConnectProvider);
  console.log("Fortmatic is", Fortmatic);
  console.log(provider);

  // Tell Web3modal what providers we have available.
  // Built-in web browser provider (only one can exist as a time)
  // like MetaMask, Brave or Opera is added automatically by Web3modal
  const providerOptions = {
    walletconnect: {
      package: WalletConnectProvider,
      options: {
        // Mikko's test key - don't copy as your mileage may vary
        infuraId: "a92faac6e14345c0863377643370c015",
      },
    },
  };

  web3Modal = new Web3Modal({
    cacheProvider: true, // optional
    providerOptions, // required
  });
}

/**
 * Kick in the UI action after Web3modal dialog has chosen a provider
 */
async function fetchAccountData() {
  // Get a Web3 instance for the wallet
  const web3 = new Web3(provider);

  console.log("Web3 instance is", web3);

  // Get connected chain id from Ethereum node
  const chainId = await web3.eth.getChainId();
  // Load chain information over an HTTP API
  // const chainData = await EvmChains.getChain(chainId);
  // document.querySelector("#network-name").textContent = chainData.name;

  // Get list of accounts of the connected wallet
  const accounts = await web3.eth.getAccounts();

  // MetaMask does not give you all accounts, only the selected account
  console.log("Got accounts", accounts);
  selectedAccount = accounts[0];

  document.querySelector("#selected-account").textContent = selectedAccount;

  // Get a handl
  const template = document.querySelector("#template-balance");
  const accountContainer = document.querySelector("#accounts");

  // Purge UI elements any previously loaded accounts
  accountContainer.innerHTML = "";

  // Go through all accounts and get their ETH balance
  const rowResolvers = accounts.map(async (address) => {
    const balance = await web3.eth.getBalance(address);
    // ethBalance is a BigNumber instance
    // https://github.com/indutny/bn.js/
    const ethBalance = web3.utils.fromWei(balance, "ether");
    const humanFriendlyBalance = parseFloat(ethBalance).toFixed(4);
    // Fill in the templated row and put in the document
    const clone = template.content.cloneNode(true);
    clone.querySelector(".address").textContent = address;
    clone.querySelector(".balance").textContent = humanFriendlyBalance;
    accountContainer.appendChild(clone);
  });

  // Because rendering account does its own RPC commucation
  // with Ethereum node, we do not want to display any results
  // until data for all accounts is loaded
  await Promise.all(rowResolvers);

  // Display fully loaded UI for wallet data
  document.querySelector("#prepare").style.display = "none";
  document.querySelector("#connected").style.display = "block";

  web3.eth.personal.sign(
    web3.utils.fromUtf8("hello"),
    accounts[0],
    function (err, sign) {
      console.log(sign);
    }
  );
}

/**
 * Fetch account data for UI when
 * - User switches accounts in wallet
 * - User switches networks in wallet
 * - User connects wallet initially
 */
async function refreshAccountData() {
  // If any current data is displayed when
  // the user is switching acounts in the wallet
  // immediate hide this data
  document.querySelector("#connected").style.display = "none";
  document.querySelector("#prepare").style.display = "block";

  // Disable button while UI is loading.
  // fetchAccountData() will take a while as it communicates
  // with Ethereum node via JSON-RPC and loads chain data
  // over an API call.
  document.querySelector("#btn-connect").setAttribute("disabled", "disabled");
  await fetchAccountData(provider);
  document.querySelector("#btn-connect").removeAttribute("disabled");
}

/**
 * Connect wallet button pressed.
 */
async function onConnect() {
  console.log("Opening a dialog", web3Modal);
  try {
    provider = await web3Modal.connect();
  } catch (e) {
    console.log("Could not get a wallet connection", e);
    return;
  }

  // Subscribe to accounts change
  provider.on("accountsChanged", (accounts) => {
    fetchAccountData();
  });

  // Subscribe to chainId change
  provider.on("chainChanged", (chainId) => {
    fetchAccountData();
  });

  // Subscribe to networkId change
  provider.on("networkChanged", (networkId) => {
    fetchAccountData();
  });

  await refreshAccountData();
}

/**
 * Disconnect wallet button pressed.
 */
async function onDisconnect() {
  console.log("Killing the wallet connection", provider);

  // TODO: Which providers have close method?
  if (provider.close) {
    await provider.close();

    // If the cached provider is not cleared,
    // WalletConnect will default to the existing session
    // and does not allow to re-scan the QR code with a new wallet.
    // Depending on your use case you may want or want not his behavir.
    await web3Modal.clearCachedProvider();
    provider = null;
  }

  selectedAccount = null;

  // Set the UI back to the initial state
  document.querySelector("#prepare").style.display = "block";
  document.querySelector("#connected").style.display = "none";
}

async function login() {
  try {
    provider = await web3Modal.connect();
  } catch (e) {
    console.log("Could not get a wallet connection", e);
    return;
  }

  // Subscribe to accounts change
  provider.on("accountsChanged", (accounts) => {
    console.log("Account changed", accounts);
    // fetchAccountData();
  });

  // Subscribe to chainId change
  provider.on("chainChanged", (chainId) => {
    console.log("Chain Changed", chainId);
    // fetchAccountData();
  });

  // Subscribe to networkId change
  // provider.on("networkChanged", (networkId) => {
  //     // fetchAccountData();
  //     console.log('Network Changed', networkId)
  // });
  web3 = new Web3(provider);
  accounts = await web3.eth.getAccounts();
  await loginSubmit();
}

async function loginSubmit() {
  const nonce = document.getElementById("nonce").innerText;
  const msg = `You're about to sign this random string: '${nonce}' to prove your identity.`;
  web3.eth.personal.sign(
    web3.utils.fromUtf8(msg),
    accounts[0],
    function (err, sign) {
      if (!err) {
        console.log(sign);
        window.sessionStorage.setItem("account", accounts[0]);
        const userData = {
          address: accounts[0],
          signature: sign,
          wallet: "metamask",
        };
        $.post({
          traditional: true,
          url: "/submit",
          contentType: "application/json",
          data: JSON.stringify(userData),
          dataType: "json",
          success: function (response) {
            // @dev: NOT triggered!
            console.log(response.status);
            if (response.status === 200) {
              window.location.href = "/profile";
            }
          },
          complete: function (response) {
            // @dev: successfully triggered :)
            console.log(response.status);
            window.location.href = "/profile";
          },
        });
      } else {
        // error occurs!
        console.log("WHY cancel the signing request :(");
      }
    }
  );
}

async function logout() {
  //   if (provider.close) {
  //     await provider.close();

  //     // If the cached provider is not cleared,
  //     // WalletConnect will default to the existing session
  //     // and does not allow to re-scan the QR code with a new wallet.
  //     // Depending on your use case you may want or want not his behavir.
  //     await web3Modal.clearCachedProvider();
  //     provider = null;
  //   }
  await web3Modal.clearCachedProvider();
  provider = null;

  selectedAccount = null;
  window.sessionStorage.removeItem("account");
  window.location.href = "/logout";
}

async function sign() {
  let msg = document.getElementById("msg").value;
  if (!web3 || !web3.eth) {
    try {
      provider = await web3Modal.connect();
    } catch (e) {
      console.log("Could not get a wallet connection", e);
      return;
    }
    web3 = new Web3(provider);
    accounts = await web3.eth.getAccounts();
  }
  web3.eth.personal.sign(
    web3.utils.fromUtf8(msg),
    accounts[0],
    function (err, sign) {
      if (!err) {
        console.log(sign);
        document.getElementById("signature").innerHTML = sign;
      }
    }
  );
}

async function send() {
  if (!web3 || !web3.eth) {
    try {
      provider = await web3Modal.connect();
    } catch (e) {
      console.log("Could not get a wallet connection", e);
      return;
    }
    web3 = new Web3(provider);
    accounts = await web3.eth.getAccounts();
  }
  let address = document.getElementById("address").value;
  let amount = document.getElementById("amount").value;
  const amountToSend = web3.utils.toWei(amount, "ether"); // Convert to wei value
  document.getElementById("notification").innerHTML =
    "Sending ETH, please wait...";
  web3.eth
    .sendTransaction({
      from: accounts[0],
      to: address,
      value: amountToSend,
    })
    .then(function (tx) {
      console.log("Transaction: ", tx);
      document.getElementById("notification").innerHTML = "Sent successfully";
    })
    .catch(function (e) {
      document.getElementById("notification").innerHTML = "Send Failed";
    });
}

async function createInvoice() {
  if (!web3 || !web3.eth) {
    try {
      provider = await web3Modal.connect();
    } catch (e) {
      console.log("Could not get a wallet connection", e);
      return;
    }
    web3 = new Web3(provider);
    accounts = await web3.eth.getAccounts();
  }
  const buyer = document.getElementById("buyer").value;
  const amount = document.getElementById("amount").value;
  document.getElementById("create-notification").innerHTML =
    "Creating Invoice, please wait...";
  $.ajax({
    url: "/createInvoice",
    type: "post",
    data: { buyer, amount, seller: accounts[0] },
    success: (res) => {
      console.log(res);
      window.location.reload();
    },
  });
}

async function payInvoice(seller, amount, _id) {
  if (!web3 || !web3.eth) {
    try {
      provider = await web3Modal.connect();
    } catch (e) {
      console.log("Could not get a wallet connection", e);
      return;
    }
    web3 = new Web3(provider);
    accounts = await web3.eth.getAccounts();
  }

  document.getElementById("pay-notification").innerHTML =
    "Paying the Invoice, please wait...";
  // const amount = "0.0004";
  const amountToSend = web3.utils.toWei(amount.toString(), "ether"); // Convert to wei value
  web3.eth
    .sendTransaction({
      from: accounts[0],
      to: seller,
      value: amountToSend,
    })
    .then(function (tx) {
      console.log("Transaction: ", tx);
      $.ajax({
        url: "/payInvoice",
        type: "post",
        data: { _id },
        success: (result) => {
          console.log(result);
          window.location.reload();
        },
      });
    })
    .catch(function (e) {
      console.log(e);
    });
}

/**
 * Main entry point.
 */
window.addEventListener("load", async () => {
  console.log("load");
  await init();

  // document.querySelector("#btn-connect").addEventListener("click", onConnect);
  // document.querySelector("#btn-disconnect").addEventListener("click", onDisconnect);
});

window.ethereum.on("accountsChanged", async () => {
  if (window.sessionStorage.getItem("account")) {
    console.log(
      "=====================================detected Metamask Disconnect================================"
    );
    await logout();
  }
});

// provider.onDisconnect()
provider.wc.on("disconnect", async () => {
  if (window.sessionStorage.getItem("account")) {
    // console.log(
    //   "=====================================detected Walletconnect disconnect================================"
    // );
    // alert("fgfgdfgdfgfdg");
    await logout();
  }
});
