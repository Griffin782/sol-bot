"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSubscribeRequest = createSubscribeRequest;
exports.sendSubscribeRequest = sendSubscribeRequest;
exports.isSubscribeUpdateTransaction = isSubscribeUpdateTransaction;
var yellowstone_grpc_1 = require("@triton-one/yellowstone-grpc");
function createSubscribeRequest(dataStreamPrograms, dataStreamWallets, streamMode) {
    var COMMITMENT = yellowstone_grpc_1.CommitmentLevel.PROCESSED;
    /**
     * accountInclude: An array of program IDs (as strings) that the client wants to monitor
     */
    var accountInclude = dataStreamPrograms.filter(function (program) { return program.enabled; }).map(function (program) { return program.key; });
    if (streamMode === "wallet" && dataStreamWallets.length > 0) {
        accountInclude = dataStreamWallets.filter(function (wallet) { return wallet.enabled; }).map(function (wallet) { return wallet.key; });
    }
    return {
        accounts: {},
        slots: {},
        transactions: {
            sniper: {
                accountInclude: accountInclude,
                accountExclude: [],
                accountRequired: [],
            },
        },
        transactionsStatus: {},
        entry: {},
        blocks: {},
        blocksMeta: {},
        commitment: COMMITMENT,
        accountsDataSlice: [],
        ping: undefined,
    };
}
/**
 * Sends a subscription request to the gRPC server and returns a Promise
 *
 * This function takes a gRPC stream and a subscription request, then writes the request
 * to the stream in an asynchronous manner. It wraps the callback-based stream.write()
 * method in a Promise to allow for easier async/await usage in the calling code.
 *
 * @param stream - The bidirectional gRPC stream used for communication with the server
 * @param request - The subscription request containing filter criteria for the data you want to receive
 * @returns A Promise that resolves when the write operation completes successfully, or rejects if an error occurs
 *
 * The function handles the following scenarios:
 * 1. Success: When the stream successfully writes the request, the Promise resolves
 * 2. Failure: When the stream encounters an error during writing, the Promise rejects with that error
 *
 * This Promise-based approach allows the calling code to use async/await syntax
 * instead of dealing with callbacks, making the code more readable and maintainable.
 */
function sendSubscribeRequest(stream, request) {
    return new Promise(function (resolve, reject) {
        stream.write(request, function (err) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}
/**'
 * Returns if the data is a SubscribeUpdate object with a transaction property
 */
function isSubscribeUpdateTransaction(data) {
    return ("transaction" in data &&
        typeof data.transaction === "object" &&
        data.transaction !== null &&
        "slot" in data.transaction &&
        "transaction" in data.transaction);
}
