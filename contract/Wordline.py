# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""Wordline: lock a word only when two dictionaries agree. A lock is never replaced."""

from dataclasses import dataclass
from genlayer import *
import json

PARTS = {
    "n": "noun",
    "noun": "noun",
    "v": "verb",
    "verb": "verb",
    "adj": "adjective",
    "adjective": "adjective",
    "adv": "adverb",
    "adverb": "adverb",
}
CLASSES = ("noun", "verb", "adjective", "adverb", "missing", "unread")


def _body(response) -> str:
    raw = response.body
    return raw.decode("utf-8") if isinstance(raw, bytes) else str(raw)


def _datamuse(word: str) -> str:
    try:
        response = gl.nondet.web.get(
            "https://api.datamuse.com/words?sp=" + word + "&md=d&max=1"
        )
        if getattr(response, "status_code", 200) != 200:
            return "unread"
        data = json.loads(_body(response))
    except Exception:
        return "unread"
    if not isinstance(data, list) or not data or not isinstance(data[0], dict):
        return "missing"
    if str(data[0].get("word", "")).lower() != word:
        return "missing"
    defs = data[0].get("defs")
    if not isinstance(defs, list) or not defs:
        return "missing"
    code, sep, _rest = str(defs[0]).partition("\t")
    if sep == "":
        return "missing"
    return PARTS.get(code, "unread")


def _dictionary(word: str) -> str:
    try:
        response = gl.nondet.web.get(
            "https://en.wiktionary.org/api/rest_v1/page/definition/" + word
        )
        code = getattr(response, "status_code", None)
        if code is None:
            code = getattr(response, "status", 200)
        if code != 200:
            return "missing"
        data = json.loads(_body(response))
    except Exception:
        return "unread"
    if not isinstance(data, dict):
        return "missing"
    entries = data.get("en")
    if not isinstance(entries, list) or not entries or not isinstance(entries[0], dict):
        return "missing"
    return PARTS.get(str(entries[0].get("partOfSpeech", "")).lower(), "unread")


@allow_storage
@dataclass
class TermCase:
    case_id: str
    caller: Address
    word: str
    status: str
    agreed_part: str
    source_a: str
    source_b: str
    lock_ref: str


class Wordline(gl.Contract):
    next_id: u256
    cases: TreeMap[str, TermCase]

    def __init__(self):
        self.next_id = u256(0)

    def _record(self, item: TermCase):
        return {
            "case_id": item.case_id,
            "caller": str(item.caller),
            "word": item.word,
            "status": item.status,
            "agreed_part": item.agreed_part,
            "source_a": item.source_a,
            "source_b": item.source_b,
            "lock_ref": item.lock_ref,
        }

    def _standing_id(self, word: str) -> str:
        found = ""
        for case_id, item in self.cases.items():
            if item.word == word and item.status == "LOCKED":
                if found == "" or int(case_id) < int(found):
                    found = case_id
        return found

    def _save(self, word: str, status: str, agreed: str, source_a: str, source_b: str, lock_ref: str) -> str:
        case_id = str(self.next_id + u256(1))
        self.next_id = self.next_id + u256(1)
        self.cases[case_id] = TermCase(
            case_id=case_id,
            caller=gl.message.sender_address,
            word=word,
            status=status,
            agreed_part=agreed,
            source_a=source_a,
            source_b=source_b,
            lock_ref=lock_ref,
        )
        return case_id

    @gl.public.view
    def get_case_count(self):
        return str(self.next_id)

    @gl.public.view
    def get_case(self, case_id: str):
        case_id = "" if case_id is None else str(case_id).strip()
        if case_id not in self.cases:
            raise gl.vm.UserError("unknown case")
        return self._record(self.cases[case_id])

    @gl.public.view
    def get_standing(self, word: str):
        word = "" if word is None else str(word).strip().lower()
        standing = self._standing_id(word)
        if standing == "":
            raise gl.vm.UserError("no standing lock")
        return self._record(self.cases[standing])

    @gl.public.view
    def get_my_case_ids(self):
        caller = gl.message.sender_address
        found = []
        for case_id, item in self.cases.items():
            if item.caller == caller:
                found.append(case_id)
        found.sort(key=lambda item: int(item))
        return found

    @gl.public.write
    def propose(self, word: str):
        word = "" if word is None else str(word).strip().lower()
        if len(word) < 2 or len(word) > 20 or not word.isalpha():
            raise gl.vm.UserError("word must be 2 to 20 letters")

        standing = self._standing_id(word)
        if standing != "":
            self._save(
                word,
                "ALREADY_LOCKED",
                self.cases[standing].agreed_part,
                "",
                "",
                standing,
            )
            return

        def compare():
            return json.dumps(
                {"a": _datamuse(word), "b": _dictionary(word)},
                sort_keys=True,
            )

        parsed = json.loads(gl.eq_principle.strict_eq(compare))
        source_a = parsed.get("a", "")
        source_b = parsed.get("b", "")
        if source_a not in CLASSES or source_b not in CLASSES:
            raise gl.vm.UserError("a source returned an unknown class")

        parts = ("noun", "verb", "adjective", "adverb")
        if source_a in parts and source_b in parts and source_a == source_b:
            self._save(word, "LOCKED", source_a, source_a, source_b, "")
        elif source_a in parts and source_b in parts:
            self._save(word, "REFUSED", "", source_a, source_b, "")
        elif source_a == "unread" or source_b == "unread":
            self._save(word, "UNAVAILABLE", "", source_a, source_b, "")
        elif source_a in parts or source_b in parts:
            self._save(word, "UNCONFIRMED", "", source_a, source_b, "")
        else:
            self._save(word, "UNKNOWN", "", source_a, source_b, "")
