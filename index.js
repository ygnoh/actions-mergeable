const core = require("@actions/core");

console.log(core.getInput("prNumber"));
console.log(core.getInput("pr"));
console.log(process.env.GITHUB_API_URL);
console.log(process.env.GITHUB_HEAD_REF);
console.log(process.env.GITHUB_REF_NAME);
console.log(process.env.GITHUB_REPOSITORY);
