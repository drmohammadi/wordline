# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""Wordline: store the dictionary entry for one English word."""

from genlayer import *
import json

MAX_DEFINITION_LEN = 400
PARTS = {
    "n": "noun",
    "v": "verb",
    "adj": "adjective",
    "adv": "adverb",
    "u": "interjection",
}


class Wordline(gl.Contract):
    word: str
    status: str
    part: str
    definition: str

    def __init__(self):
        self.word = ""
        self.status = ""
        self.part = ""
        self.definition = ""

    @gl.public.view
    def get_result(self):
        return {
            "word": self.word,
            "status": self.status,
            "part": self.part,
            "definition": self.definition,
        }

    @gl.public.write
    def define(self, word: str):
        word = "" if word is None else str(word).strip().lower()
        if len(word) < 2 or len(word) > 20 or not word.isalpha():
            raise gl.vm.UserError("word must be 2 to 20 letters")

        def lookup():
            try:
                response = gl.nondet.web.get(
                    "https://api.datamuse.com/words?sp=" + word + "&md=d&max=1"
                )
                code = getattr(response, "status_code", 200)
                if code != 200:
                    return json.dumps(
                        {"definition": "", "part": "", "status": "UNAVAILABLE"},
                        sort_keys=True,
                    )
                body = response.body
                text = body.decode("utf-8") if isinstance(body, bytes) else str(body)
                data = json.loads(text)
            except Exception:
                return json.dumps(
                    {"definition": "", "part": "", "status": "UNAVAILABLE"},
                    sort_keys=True,
                )

            if not isinstance(data, list) or not data:
                return json.dumps(
                    {"definition": "", "part": "", "status": "MISSING"},
                    sort_keys=True,
                )
            entry = data[0]
            if not isinstance(entry, dict) or entry.get("word") != word:
                return json.dumps(
                    {"definition": "", "part": "", "status": "MISSING"},
                    sort_keys=True,
                )
            defs = entry.get("defs")
            if not isinstance(defs, list) or not defs:
                return json.dumps(
                    {"definition": "", "part": "", "status": "MISSING"},
                    sort_keys=True,
                )
            raw = str(defs[0])
            code_part, sep, meaning = raw.partition("\t")
            if sep == "":
                meaning = raw
                code_part = ""
            return json.dumps(
                {
                    "definition": meaning.strip()[:MAX_DEFINITION_LEN],
                    "part": PARTS.get(code_part, code_part),
                    "status": "FOUND",
                },
                sort_keys=True,
            )

        parsed = json.loads(gl.eq_principle.strict_eq(lookup))
        if parsed.get("status") not in ("FOUND", "MISSING", "UNAVAILABLE"):
            raise gl.vm.UserError("lookup did not return an allowed status")

        self.word = word
        self.status = parsed["status"]
        self.part = parsed.get("part", "")
        self.definition = parsed.get("definition", "")[:MAX_DEFINITION_LEN]