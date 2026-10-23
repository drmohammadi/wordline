import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionHashVariant, TransactionStatus } from "genlayer-js/types";

const addressEl = document.querySelector("#address");
const wordEl = document.querySelector("#word");
const walletEl = document.querySelector("#wallet");
const statusEl = document.querySelector("#status");
const errorEl = document.querySelector("#error");
const partEl = document.querySelector("#part");
const definitionEl = document.querySelector("#definition");

const stored = localStorage.getItem("wordline.address");
if (stored) addressEl.value = stored;

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
    throw new Error("Paste the deployed contract address.");
  }
  localStorage.setItem("wordline.address", address);
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
  partEl.textContent = data.part || "";
  definitionEl.textContent = data.definition || data.status || "";
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

async function readSaved() {
  setError("");
  const address = contractAddress();
  if (!client) await connect();
  setStatus("reading");
  const value = await client.readContract({
    address,
    functionName: "get_result",
    args: [],
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
  });
  showResult(value);
  setStatus(value && value.status ? value.status : "saved");
}

async function lookup() {
  setError("");
  const address = contractAddress();
  const term = word();
  if (!client) await connect();
  setStatus("pending");
  const txId = await client.writeContract({
    address,
    functionName: "define",
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
    throw new Error("The lookup finalized with an error and saved nothing.");
  }
  await readSaved();
}

document.querySelector("#connect").addEventListener("click", () => {
  connect().catch((error) => {
    setStatus("error");
    setError(error.message || String(error));
  });
});
document.querySelector("#read").addEventListener("click", () => {
  readSaved().catch((error) => {
    setStatus("error");
    setError(error.message || String(error));
  });
});
document.querySelector("#submit").addEventListener("click", () => {
  lookup().catch((error) => {
    setStatus("error");
    setError(error.message || String(error));
  });
});
