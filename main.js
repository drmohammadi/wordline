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

function asRecord(value) {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== "object") return {};
  return value;
}

function showResult(value) {
  const data = asRecord(value);
  const status = data.status || "";
  if (!status) {
    partEl.textContent = "";
    definitionEl.textContent = "No lookup saved yet.";
    return;
  }
  partEl.textContent = data.part ? `${status} · ${data.part}` : status;
  if (status === "FOUND") {
    definitionEl.textContent = data.definition || "";
  } else if (status === "MISSING") {
    definitionEl.textContent = "This word is not in the dictionary.";
  } else if (status === "UNAVAILABLE") {
    definitionEl.textContent = "The dictionary could not be read. Nothing was invented.";
  } else {
    definitionEl.textContent = data.definition || "";
  }
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
  const data = asRecord(value);
  setStatus(data.status || "saved");
}

function leaderFailed(receipt) {
  const rows = receipt?.consensus_data?.leader_receipt;
  const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
  return list.some(
    (item) =>
      (item?.mode === "leader" || item?.execution_mode === "leader") &&
      (item?.execution_result === "ERROR" || item?.result === "ERROR"),
  );
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
  if (leaderFailed(receipt)) {
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
