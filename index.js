const core = require("@actions/core");

console.log(core.getInput("prNumber"));
console.log(core.getInput("pr"));
console.log(process.env.GITHUB_API_URL);
