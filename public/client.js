const client = function(){
    async function requestSigHeaders(url, method, headers, body) {
        let init = {
            method: 'post',
            headers: {'content-type': 'application/json'},
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
        };
        const response = await fetch("https://kxu5d4mr4blcthphxomjlc4xk40rvdsx.lambda-url.eu-central-1.on.aws/", init)
        const r = await response.json();
        let result = {};
        for (const [key, value] of Object.entries(r)) {
            result[key.toLowerCase()] = value;
        }
        return result;
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
        if (uri.hostname.startsWith("happy-life-bank") && uri.port.startsWith("3")) {
            uri.port = (parseInt(uri.port) + 1000).toString();
        }
        if (uri.port.startsWith("4")) {
            uri.protocol = "https";
            uri.hostname = "happy-life-bank-backend";
            uri.port = uri.port === "4000" ? "" : uri.port;
        } else if (uri.port.startsWith("3")) {
            uri.protocol = "https";
            uri.hostname = "cloud-nine-wallet-backend";
            uri.port = uri.port === "3000" ? "" : uri.port;
        }
        return uri.toString();
    }

    function fromDomainToLocal(domain) {
        const localHost = "localhost";
        // const localHost = "172.17.0.4";
        let uri = new URL(domain);
        if (uri.hostname.startsWith("happy-life-bank") && uri.port.startsWith("3")) {
            uri.port = (parseInt(uri.port) + 1000).toString();
        }
        if(uri.hostname === "localhost"){
            uri.hostname = localHost;
        }
        if (uri.hostname.startsWith("happy-life-bank")) {
            uri.protocol = "http";
            uri.hostname = localHost;
            uri.port = (uri.port === "" || uri.port === "80") ? "4000" : uri.port;
        } else if (uri.hostname.startsWith("cloud-nine-wallet")) {
            uri.protocol = "http";
            uri.hostname = localHost;
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
        console.log("incomingPaymentGrantRequestFromResponse: ", JSON.stringify(response));
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

        let incomingPaymentUrl = `${fromDomainToLocal(receiverAccount.resourceServer)}incoming-payments`;
        const sigHeaders = await requestSigHeaders(
            fromDomainToLocal(incomingPaymentUrl),
            "POST",
            {
                "content-type": "application/json",
                "authorization": `GNAP ${accessToken}`,
                "host": new URL(fromDomainToLocal(receiverAccount.resourceServer)).host
            },
            requestBody
        );

        sigHeaders["content-type"] = "application/json";
        sigHeaders["authorization"] = `GNAP ${accessToken}`;
        sigHeaders["host"] = new URL(fromDomainToLocal(receiverAccount.resourceServer)).host;
        console.log("incomingPaymentHeaders: ", sigHeaders);
        console.log("incomingPaymentBody: ", JSON.stringify(requestBody));
        const options = {
            method: 'POST',
            headers: sigHeaders,
            body: JSON.stringify(requestBody),
        };

        console.log(options);

        try {

            const response = await fetch(incomingPaymentUrl, options);
            if (!response.ok) {
                console.log("incomingPaymentError: ", await response.text());
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error making grant request:', error);
        }
    }

    async function makeOutgoingPaymentGrantRequest(clientAccount, senderAccount) {
        const requestBody = {
            access_token: {
                access: [
                    {
                        type: 'outgoing-payment',
                        actions: ['create', 'read', 'list'],
                        identifier: hostTransformToDomain(senderAccount.id),
                        limits: {
                            debitAmount: {
                                value: '500',
                                assetCode: 'USD',
                                assetScale: 2
                            },
                            receiveAmount: {
                                value: '500',
                                assetCode: 'USD',
                                assetScale: 2
                            }
                        }
                    }
                ]
            },
            client: hostTransformToDomain(clientAccount.id),
            interact: {
                start: ['redirect']
            }
        };

        console.log("Request body: ", JSON.stringify(requestBody));

        const outgoingPaymentUrl = fromDomainToLocal(senderAccount.authServer);
        const sigHeaders = await requestSigHeaders(
            outgoingPaymentUrl,
            "POST",
            {"content-type": "application/json"},
            requestBody
        );
        sigHeaders["content-type"] = "application/json";
        const options = {
            method: 'POST',
            headers: sigHeaders,
            body: JSON.stringify(requestBody),
        };

        try {
            const response = await fetch(outgoingPaymentUrl, options);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await await response.json();
        } catch (error) {
            console.error('Error making grant request:', error);
        }
    }

    async function continueOutgoingPayment(uri, token) {
        let localUri = fromDomainToLocal(uri);
        const sigHeaders = await requestSigHeaders(
            localUri,
            "POST",
            {
                "Content-Type": "application/json",
                "Authorization": `GNAP ${token}`
            });

        sigHeaders["Content-Type"] = "application/json";
        sigHeaders["Authorization"] = `GNAP ${token}`;
        const options = {
            method: 'POST',
            headers: sigHeaders,
        };

        const res = await fetch(localUri, options);
        return await res.json();
    }


    async function createOutgoingPayment(senderAccount, receiverAccount, incomingPaymentUrl, continuationToken) {
        const requestBody = {
            walletAddress: hostTransformToDomain(senderAccount.id),
            incomingPayment: hostTransformToDomain(incomingPaymentUrl),
            debitAmount: {
                value: '500',
                assetCode: 'USD',
                assetScale: 2
            },
            metadata: {
                description: 'Free Money!'
            }
        };
        const outgoingPaymentUrl = `${fromDomainToLocal(senderAccount.resourceServer)}outgoing-payments`;
        const sigHeaders = await requestSigHeaders(
            fromDomainToLocal(outgoingPaymentUrl),
            "POST",
            {
                "content-type": "application/json",
                "authorization": `GNAP ${continuationToken}`,
                "host": new URL(fromDomainToLocal(senderAccount.resourceServer)).host
            },
            requestBody
        );
        sigHeaders["content-type"] = "application/json";
        sigHeaders["authorization"] = `GNAP ${continuationToken}`;
        sigHeaders["host"] = new URL(fromDomainToLocal(senderAccount.resourceServer)).host;
        const options = {
            method: 'POST',
            headers: sigHeaders,
            body: JSON.stringify(requestBody),
        };
        try {
            const response = await fetch(outgoingPaymentUrl, options);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} ${await response.text()}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error making grant request:', error);
        }
    }

    return {
        fetchAccount,
        makeIncomingPaymentGrantRequest,
        createIncomingPayment,
        makeOutgoingPaymentGrantRequest,
        continueOutgoingPayment,
        createOutgoingPayment
    };
}();

module.exports = client;