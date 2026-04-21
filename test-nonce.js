const crypto = require('crypto');
const rawNonce = "12345";
const hash = crypto.createHash('sha256').update(rawNonce).digest('hex');
console.log(hash);
