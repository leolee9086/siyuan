# Chat sequence trie test data

`synthetic_requests.json` only describes a deterministic synthetic request sequence. The tests generate placeholder messages at runtime so the prefix lengths and provider-ordering edge cases remain covered without storing prompts, reasoning, tool arguments, identities, timestamps, or other captured request content.

Raw MAGI or provider request captures may contain private data and must remain outside Git.
