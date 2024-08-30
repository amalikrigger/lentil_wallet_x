(async () => {
    const senderAccount = await fetchAccount("http://localhost:3000/accounts/gfranklin");

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