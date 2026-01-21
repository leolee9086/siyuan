
import { type } from "arktype";

const schemaFailure = type({ hasNonCodeBlock: "false" });
const schemaSuccess = type({ hasNonCodeBlock: "true" });
const input = { hasNonCodeBlock: true };

console.log("Checking 'false' schema against true input:");
const resultFailure = schemaFailure(input);
if (resultFailure instanceof type.errors) {
    console.log("Validation FAILED (Expected)");
    console.log(resultFailure.summary);
} else {
    console.log("Validation SUCCEEDED (UNEXPECTED)");
    console.log(JSON.stringify(resultFailure));
}

console.log("\nChecking 'true' schema against true input:");
const resultSuccess = schemaSuccess(input);
if (resultSuccess instanceof type.errors) {
    console.log("Validation FAILED (UNEXPECTED)");
    console.log(resultSuccess.summary);
} else {
    console.log("Validation SUCCEEDED (Expected)");
    console.log(JSON.stringify(resultSuccess));
}
