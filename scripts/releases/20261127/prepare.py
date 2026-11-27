"""Prepare a private, deterministic staging payload from the reviewed local files."""
import collections
import csv
import hashlib
import json
import pathlib
import re
import sys
import uuid

source, output = map(pathlib.Path, sys.argv[1:])
review = source / "合版隔離驗收.yRWrvxVe"
candidate_file = source / "候選人_合版2529欄_待核准.csv"
polling_file = source / "雲林澎湖_村里鍵補證.UEiRejSr" / "隔離驗收輸入.json"
receipt = (review / "合版驗收SHA256.txt").read_text()
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def require(ok, message):
    if not ok:
        raise SystemExit(message)

for f in (candidate_file, polling_file):
    require(f"{sha(f)}  ../{f.relative_to(source)}" in receipt, f"review digest mismatch: {f.name}")
types = {"性別": "gender", "出生日期": "birth_date", "學歷": "education", "經歷": "experience", "政見": "platform"}
races = json.loads((review / "candidate-races.json").read_text())
with candidate_file.open(encoding="utf-8-sig", newline="") as handle:
    rows = list(csv.DictReader(handle))
cands = []
for row in rows:
    typ = types[row["欄位"]]
    cid, pid, rid = [str(uuid.UUID(row[k])) for k in ("候選ID", "人物ID", "正式競賽 ID（已比對）")]
    url, page, digest = [row[k] for k in ("來源網址", "原件頁碼", "原件SHA-256")]
    require(row["年份"] == "2026" and row["職位"] in ("縣市長", "議員") and row["同欄主張數"] == "0", "candidate outside reviewed scope")
    require(re.fullmatch(r"https://(?:ee)?bulletin\.cec\.gov\.tw/[^\r\n]+", url) and re.fullmatch("[a-fA-F0-9]{64}", digest) and page.isdecimal() and int(page) > 0, "missing document provenance")
    require(row["本次正式前值"] == ("unknown" if typ == "gender" else "") and row["正規值"].strip(), "unexpected reviewed before or after value")
    cands.append(dict(cid=cid, pid=pid, rid=rid, eid=str(uuid.UUID(races[rid])),
        name=row["公報完整姓名"], ballot=int(row["號次"]), kind=typ, value=row["正規值"], url=url, page=int(page), sha256=digest.lower()))
require(collections.Counter(x["kind"] for x in cands) == dict(gender=350,birth_date=327,education=365,experience=372,platform=1115), "candidate counts changed")
require(len({x["cid"] for x in cands}) == 1164 and len({(x["cid"] if x["kind"] == "platform" else x["pid"],x["kind"]) for x in cands}) == 2529, "candidate keys changed")

poll = json.loads(polling_file.read_text())
rows = poll["rows"]; holds = set(poll["fallback_village_codes"])
require(collections.Counter(x["county_code"] for x in rows) == {"10009":501,"10016":111}, "polling counts changed")
require(len({(x["county_code"],x["station_no"],x["village_code"]) for x in rows}) == 612
        and len(holds) == 63 and sum(len(x["neighbor_numbers"] or []) for x in rows) == 4152, "polling keys changed")
require("10009010039" in holds and not any(x["hold"] or x["village_code"] in holds for x in rows), "held polling rows would be staged")
# Independent record of the exact reviewed artifacts, kept in Git (not generated from staged output).
for line in pathlib.Path(__file__).with_name("reviewed-relocations.sha256").read_text(encoding="utf-8").splitlines():
    digest, original = line.split("  ", 1)
    require(sha(source / original) == digest, f"reviewed relocation digest mismatch: {original}")

meta = json.loads((source/"站所_兩縣現行快照吻合驗證.json").read_text())
corrections = []
verify_folder = source.parent/"polling-reconciliation-20261124"/"其餘19縣市"/"公告附件"
for county, expected in meta["counties"].items():
    old = json.loads((source/f"站所_{county}_完整舊版測試快照.json").read_text())
    new = json.loads((source/f"站所_{county}_兩地修補測試快照.json").read_text())
    changes = [(x,y) for x,y in zip(old,new,strict=True) if x != y]
    require(len(changes)==1,"unexpected station change")
    before, after = changes[0]
    require({k for k in before if before[k] != after[k]} == {"station_name","address"}, "station geographies changed")
    proof = next(p for p in meta["patches"] if p["county"] == county)["source"]
    filename, page = proof.split("/")[-1].split("#page=")
    pdf = verify_folder/filename
    require(pdf.read_bytes()[:5] == b"%PDF-", "official correction must be an original PDF")
    corrections.append(dict(county=county,before=before,after=after,source=expected["checked_in_source"],
        official_url=proof,official_page=int(page),official_sha256=sha(pdf)))

output.mkdir(mode=0o700, exist_ok=False)
payload = {
 "candidates": cands,
 "polling": dict(rows=rows,fallback_village_codes=sorted(holds),corrections=corrections),
 "provenance": dict(candidate_csv=sha(candidate_file),polling_review=sha(polling_file),
   candidate_published_baseline="14fdb601-fbdf-4587-9804-c949f5ef266f", candidate_baseline_schema="20261104154629",
   candidate_count=len(cands),polling_count=len(rows),candidate_scope="2026 mayor and councilor only",
   polling_lookup_input_sha256=json.loads((polling_file.parent/"驗收計數與來源SHA256.json").read_text())["inputs_sha256"])
}
lines = ["\\set ON_ERROR_STOP on","BEGIN;","SET LOCAL standard_conforming_strings = on;"]
for kind, data in payload.items():
    body = json.dumps(data, ensure_ascii=False,sort_keys=True,separators=(",",":"))
    artifact = output/f"{kind}.json"
    artifact.write_bytes(body.encode())
    literal = "'" + body.replace("'","''") + "'"
    lines.append(f"INSERT INTO pow_release_20261127.input(kind,body,artifact_sha256) SELECT '{kind}', doc::jsonb, encode(sha256(convert_to(doc,'UTF8')),'hex') FROM (VALUES ({literal}::text)) AS v(doc);")
lines += ["COMMIT;",""]
(output/"stage.sql").write_text("\n".join(lines),encoding="utf-8")
files = sorted(output.iterdir())
(output/"SHA256SUMS").write_text("".join(f"{sha(p)}  {p.name}\n" for p in files))
print("STAGING_PAYLOAD_READY fields=2529 candidacies=1164 stations=612 corrections=2 held_villages=63")
