const core = require("@actions/core");

// console.log(core.getInput("prNumber"));
// console.log(core.getInput("pr"));
// console.log(process.env.GITHUB_API_URL);
// console.log(process.env.GITHUB_REPOSITORY);
console.log(process.env.GITHUB_REF);
console.log(process.env.GITHUB_REF_NAME);
