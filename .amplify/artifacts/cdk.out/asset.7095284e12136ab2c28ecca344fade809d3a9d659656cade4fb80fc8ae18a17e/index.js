var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// amplify/functions/state-machine-trigger/handler.ts
var handler_exports = {};
__export(handler_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(handler_exports);
var import_https = __toESM(require("https"), 1);
var STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN || "";
var AWS_REGION = process.env.AWS_REGION || "eu-west-1";
async function startStateMachine(input) {
  const url = new URL(`https://states.${AWS_REGION}.amazonaws.com/`);
  const postData = JSON.stringify({
    stateMachineArn: STATE_MACHINE_ARN,
    input: JSON.stringify(input),
    // Convert to JSON STRING
    name: `player-cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  });
  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      path: "/",
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.0",
        "X-Amz-Target": "AWSStepFunctions.StartExecution",
        "Content-Length": Buffer.byteLength(postData)
      }
    };
    const req = import_https.default.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`StartExecution failed: ${res.statusCode} ${data}`));
        }
      });
    });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}
var handler = async (event) => {
  console.log("\u{1F4E5} State Machine Trigger invoked:", JSON.stringify(event, null, 2));
  try {
    const result = await startStateMachine(event);
    console.log("\u2705 State Machine started:", result);
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error("\u274C Failed to start State Machine:", error);
    throw error;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
