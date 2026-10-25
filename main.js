import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionHashVariant, TransactionStatus } from "genlayer-js/types";

const addressEl = document.querySelector("#address");
const wordEl = document.querySelector("#word");
const caseEl = document.querySelector("#case");
const walletEl = document.querySelector("#wallet");
const statusEl = document.querySelector("#status");
const errorEl = document.querySelector("#error");
const partEl = document.querySelector("#part");
const definitionEl = document.querySelector("#definition");

let client = null;

function setStatus(text) {
  statusEl.textContent = text;
}

function setError(text) {
  errorEl.textContent = text || "";
}

function contractAddress() {
  const address = addressEl.value.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error("Paste the new deployed contract address.");
  }
  return address;
}

function word() {
  const value = wordEl.value.trim().toLowerCase();
  if (!/^[a-z]{2,20}$/.test(value)) {
    throw new Error("Enter one word, 2 to 20 letters.");
  }
  return value;
}

function showResult(value) {
  const data = value && typeof value === "object" ? value : {};
  partEl.textContent = data.status
    ? `${data.status}${data.agreed_part ? " · " + data.agreed_part : ""}`
    : "";
  const lines = [
    data.case_id ? `case ${data.case_id}` : "",
    data.caller ? `caller ${data.caller}` : "",
    data.source_a || data.source_b
      ? `sources ${data.source_a || "-"} / ${data.source_b || "-"}`
      : "",
    data.lock_ref ? `standing case ${data.lock_ref}` : "",
    data.word ? `word ${data.word}` : "",
  ].filter(Boolean);
  definitionEl.textContent = lines.join("\n");
}

async function connect() {
  if (!window.ethereum) throw new Error("No browser wallet found.");
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  client = createClient({
    chain: studionet,
    account: accounts[0],
    provider: window.ethereum,
  });
  await client.connect("studionet");
  walletEl.textContent = accounts[0];
}

async function readOnce(functionName, args) {
  return client.readContract({
    address: contractAddress(),
    functionName,
    args,
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
  });
}

async function readWithRetry(functionName, args) {
  let last = null;
  for (let i = 0; i < 8; i += 1) {
    try {
      return await readOnce(functionName, args);
    } catch (error) {
      last = error;
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }
  }
  throw last;
}

async function readCase() {
  setError("");
  const caseId = caseEl.value.trim();
  if (!/^[1-9][0-9]*$/.test(caseId)) throw new Error("Enter a case id.");
  if (!client) await connect();
  setStatus("reading");
  const value = await readWithRetry("get_case", [caseId]);
  showResult(value);
  setStatus(value && value.status ? value.status : "saved");
}

async function readStanding() {
  setError("");
  const term = word();
  if (!client) await connect();
  setStatus("reading");
  const value = await readWithRetry("get_standing", [term]);
  showResult(value);
  setStatus(value && value.status ? value.status : "saved");
}

async function propose() {
  setError("");
  const address = contractAddress();
  const term = word();
  if (!client) await connect();
  setStatus("pending");
  const txId = await client.writeContract({
    address,
    functionName: "propose",
    args: [term],
    value: 0n,
  });
  setStatus(`pending ${txId}`);
  const receipt = await client.waitForTransactionReceipt({
    hash: txId,
    status: TransactionStatus.FINALIZED,
    interval: 5000,
    retries: 120,
  });
  const leader = receipt?.consensus_data?.leader_receipt?.find(
    (item) => item?.mode === "leader",
  );
  if (leader?.execution_result === "ERROR") {
    throw new Error("The proposal finalized with an error and saved nothing.");
  }
  const count = await readWithRetry("get_case_count", []);
  caseEl.value = String(count);
  await readCase();
}

document.querySelector("#connect").addEventListener("click", () => {
  connect().catch((error) => {
    setStatus("error");
    setError(error.message || String(error));
  });
});
document.querySelector("#read").addEventListener("click", () => {
  readCase().catch((error) => {
    setStatus("error");
    setError(error.message || String(error));
  });
});
document.querySelector("#standing").addEventListener("click", () => {
  readStanding().catch((error) => {
    setStatus("error");
    setError(error.message || String(error));
  });
});
document.querySelector("#submit").addEventListener("click", () => {
  propose().catch((error) => {
    setStatus("error");
    setError(error.message || String(error));
  });
});
