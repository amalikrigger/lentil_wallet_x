(async () => {
    const senderAccount = await fetchAccount("http://localhost:3000/accounts/gfranklin");
    const receiverAccount = await fetchAccount("http://localhost:4000/accounts/asmith");
    const clientAccount = await fetchAccount("http://localhost:4000/accounts/pfry");
    console.log(senderAccount);
    console.log(receiverAccount);
    // const grantRequest = await makeIncomingPaymentGrantRequest(clientAccount);
    // console.log(JSON.stringify(grantRequest));
    // const expirationTomorrow = new Date();
    // expirationTomorrow.setDate(expirationTomorrow.getDate() + 1);
    // const payment = await createIncomingPayment(receiverAccount, expirationTomorrow, "Test payment", grantRequest["response"]["access_token"]["value"]);
    // console.log(payment);
    const header = document.querySelector(".header h1");
    const accountId = document.getElementById("accountId");
    const assetCode = document.getElementById("assetCode");
    const assetScale = document.getElementById("assetScale");
    const authServer = document.getElementById("authServer");
    const resourceServer = document.getElementById("resourceServer");

    header.innerHTML = `Hello, ${senderAccount.publicName}`;
    accountId.innerHTML = senderAccount.id;
    assetCode.innerHTML = senderAccount.assetCode;
    assetScale.innerHTML = senderAccount.assetScale;
    authServer.innerHTML = senderAccount.authServer;
    resourceServer.innerHTML = senderAccount.resourceServer;

})();

async function requestSigHeaders(url, method, headers, body) {
    const response = await fetch("https://kxu5d4mr4blcthphxomjlc4xk40rvdsx.lambda-url.eu-central-1.on.aws/", {
        method: 'post',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            keyId: "keyid-97a3a431-8ee1-48fc-ac85-70e2f5eba8e5",
            base64Key: "LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1DNENBUUF3QlFZREsyVndCQ0lFSUVxZXptY1BoT0U4Ymt3TitqUXJwcGZSWXpHSWRGVFZXUUdUSEpJS3B6ODgKLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLQo=",
            request: {
                url,
                method,
                headers,
                body: JSON.stringify(body)
            }
        })
    })
    return await response.json()
}

async function fetchAccount(url) {
    const response = await fetch(url);
    const accountData = await response.json();
    return new Account(
        accountData.id,
        accountData.publicName,
        accountData.assetCode,
        accountData.assetScale,
        accountData.authServer,
        accountData.resourceServer
    );
}

class Account {
    constructor(id, publicName, assetCode, assetScale, authServer, resourceServer) {
        this.id = id;
        this.publicName = publicName;
        this.assetCode = assetCode;
        this.assetScale = assetScale;
        this.authServer = authServer;
        this.resourceServer = resourceServer;
    }

    toString() {
        return JSON.stringify({
            id: this.id,
            publicName: this.publicName,
            assetCode: this.assetCode,
            assetScale: this.assetScale,
            authServer: this.authServer,
            resourceServer: this.resourceServer
        });
    }
}

function hostTransformToDomain(host) {
    let uri = new URL(host);
    if (uri.port === "4000") {
        uri.protocol = "https";
        uri.host = "happy-life-bank-backend";
        uri.port = "";
    } else if (uri.port === "3000") {
        uri.protocol = "https";
        uri.host = "cloud-nine-wallet-backend";
        uri.port = "";
    }
    return uri.toString();
}

function fromDomainToLocal(domain) {
    let uri = new URL(domain);
    if (uri.host === "happy-life-bank-backend") {
        uri.protocol = "http";
        uri.host = "localhost";
        uri.port = (uri.port === "" || uri.port === "80") ? "4000" : uri.port;
    } else if (uri.host === "cloud-nine-wallet-backend") {
        uri.protocol = "http";
        uri.host = "localhost";
        uri.port = (uri.port === "" || uri.port === "80") ? "3000" : uri.port;
    }
    return uri.toString();
}

async function makeIncomingPaymentGrantRequest(senderAccount) {
    const requestBody = {
        access_token: {
            access: [
                {
                    type: 'incoming-payment',
                    actions: ['create', 'read', 'list', 'complete'],
                },
            ],
        },
        client: hostTransformToDomain(senderAccount.id),
    };

    const sigHeaders = await requestSigHeaders(
        "http://localhost:4006/",
        "POST",
        {"Content-Type": "application/json"},
        requestBody
    );
    sigHeaders["Content-Type"] = "application/json";
    const options = {
        method: 'POST',
        headers: sigHeaders,
        body: JSON.stringify(requestBody),
    };

    console.log(options);

    try {
        const response = await fetch('http://localhost:4006/', options);

        if (!response.ok) {
            console.log(await response.text());
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await incomingPaymentGrantRequestFromResponse(await response.json());
    } catch (error) {
        console.error('Error making grant request:', error);
    }
}

async function incomingPaymentGrantRequestFromResponse(response) {
    const accessTokenValue = response.access_token.value;
    const manageUrl = response.access_token.manage;
    const expiresIn = response.access_token.expires_in;
    const continueTokenValue = response.continue.access_token.value;
    const continueUri = response.continue.uri;

    return new IncomingPaymentGrantResponse(
        accessTokenValue,
        manageUrl,
        expiresIn,
        continueTokenValue,
        continueUri
    );
}

class IncomingPaymentGrantResponse {
    constructor(accessTokenValue, manageUrl, expiresIn, continueTokenValue, continueUri) {
        this.response = {
            access_token: {
                access: [
                    {
                        actions: ["create", "read", "list", "complete"],
                        type: "incoming-payment"
                    }
                ],
                value: accessTokenValue,
                manage: manageUrl,
                expires_in: expiresIn
            },
            continue: {
                access_token: {
                    value: continueTokenValue
                },
                uri: continueUri
            }
        };
    }

    toString() {
        return JSON.stringify(this.response);
    }
}

async function createIncomingPayment(receiverAccount, expiration, description, accessToken) {
    const requestBody = {
        walletAddress: hostTransformToDomain(receiverAccount.id),
        expiresAt: expiration,
        metadata: {
            description: description
        }
    };

    const sigHeaders = await requestSigHeaders(
        "http://localhost:4006/",
        "POST",
        {"Content-Type": "application/json", "Authorization": `GNAP ${accessToken}`, "host": new URL(hostTransformToDomain(receiverAccount.resourceServer)).host},
        requestBody
    );

    sigHeaders["Content-Type"] = "application/json";
    sigHeaders["Authorization"] = `GNAP ${accessToken}`;
    sigHeaders["host"] = new URL(hostTransformToDomain(receiverAccount.resourceServer)).host;
    const options = {
        method: 'POST',
        headers: sigHeaders,
        body: JSON.stringify(requestBody),
    };

    console.log(options);

    try {
        let incomingPaymentUrl = `${fromDomainToLocal(receiverAccount.resourceServer)}incoming-payments`;
        console.log(incomingPaymentUrl);
        const response = await fetch(incomingPaymentUrl, options);
        console.log(await response.text());
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error making grant request:', error);
    }
}
