(async () => {
    const senderAccount = await client.fetchAccount("http://localhost:3000/accounts/gfranklin");

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