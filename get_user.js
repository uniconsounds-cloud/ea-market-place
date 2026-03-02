// Read the .env file to see if there are other hints
const fs = require('fs');
try {
    const env = fs.readFileSync('.env.local', 'utf8');
    console.log(env);
} catch (e) {
    console.log("No .env.local found");
}
