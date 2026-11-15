#!/usr/bin/env python3
"""
Baixa dados públicos da NASA e converte para JSON estático em public/data/.
Downloads public NASA data and converts it to static JSON in public/data/.

Fontes / Sources:
  1. NASA OSDR OSD-575 (Inspiration4, LSDS-8) - Comprehensive Metabolic Panel (glicose mg/dL)
     https://osdr.nasa.gov/bio/repo/data/studies/OSD-575
  2. NASA CCMC DONKI (Space Weather Database Of Notifications, Knowledge, Information)
     https://ccmc.gsfc.nasa.gov/tools/DONKI/  (API: https://ccmc.gsfc.nasa.gov/DONKI-API/)
  3. Taxas de dose de radiação publicadas (MSL/Curiosity RAD e outras), ver radiation_reference.json.

Uso / Usage:  python3 scripts/fetch_nasa_data.py
Requer apenas a biblioteca padrão do Python 3.9+ (urllib). / Standard library only.
"""
from __future__ import annotations

import csv
import io
import json
import sys
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "data"
UA = {"User-Agent": "SISP/0.1 (NASA Space Apps prototype)"}

OSD575_URL = (
    "https://osdr.nasa.gov/geode-py/ws/studies/OSD-575/download?source=datamanager"
    "&file=LSDS-8_Comprehensive_Metabolic_Panel_CMP.upload_SUBMITTED.csv"
)
DONKI_BASE = "https://ccmc.gsfc.nasa.gov/DONKI-API/get"
DONKI_MAX_DAYS = 59  # a API limita a janela a 60 dias / API caps range at 60 days
# Janela histórica conhecida com eventos SEP (tempestade de maio/2024) / known SEP-rich window
DONKI_FALLBACK = (date(2024, 5, 1), date(2024, 6, 28))


def get(url: str, timeout: int = 60) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def write(name: str, payload: dict) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"  -> public/data/{name}")


def timepoint_days(tp: str) -> int:
    """'L-92' -> -92 (dias antes do lançamento); 'R+1' -> +1 (dias após o retorno)."""
    sign = -1 if tp.startswith("L") else 1
    return sign * int(tp[2:])


# ---------------------------------------------------------------- 1. Inspiration4 glucose
def fetch_osd575() -> None:
    print("[1/3] OSDR OSD-575 (Inspiration4) glicose...")
    raw = get(OSD575_URL).decode("utf-8-sig")
    rows = [r for r in csv.DictReader(io.StringIO(raw)) if r["ANALYTE"].strip().upper() == "GLUCOSE"]
    if not rows:
        raise RuntimeError("Nenhuma linha GLUCOSE encontrada no CSV do OSD-575")
    points = []
    for r in rows:
        tp = r["timepoint"].strip()
        points.append(
            {
                "subject": r["SUBJECT_ID"].strip(),
                "sex": r["SEX"].strip(),
                "timepoint": tp,
                "day": timepoint_days(tp),
                "phase": "pre" if tp.startswith("L") else "post",
                "value": float(r["VALUE"]),
                "unit": r["UNITS"].strip(),
                "rangeMin": float(r["RANGE_MIN"]),
                "rangeMax": float(r["RANGE_MAX"]),
            }
        )
    points.sort(key=lambda p: (p["subject"], p["day"]))
    write(
        "inspiration4_glucose.json",
        {
            "source": "NASA Open Science Data Repository (OSDR) OSD-575 / LSDS-8 - Inspiration4 Comprehensive Metabolic Panel",
            "url": "https://osdr.nasa.gov/bio/repo/data/studies/OSD-575",
            "file": "LSDS-8_Comprehensive_Metabolic_Panel_CMP.upload_SUBMITTED.csv",
            "mission": "Inspiration4 (SpaceX, Sep 2021, ~3 days in orbit, 4 civilian crew members)",
            "notes": "L-xx = days before launch; R+xx = days after return. Lab reference range included per sample.",
            "fetchedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "points": points,
        },
    )


# ---------------------------------------------------------------- 2. DONKI space weather
def donki(kind: str, start: date, end: date) -> list:
    url = f"{DONKI_BASE}/{kind}?startDate={start.isoformat()}&endDate={end.isoformat()}"
    body = get(url).decode("utf-8").strip()
    if not body:
        return []
    data = json.loads(body)
    return data if isinstance(data, list) else []


def slim_flr(e: dict) -> dict:
    return {
        "id": e.get("flrID"), "begin": e.get("beginTime"), "peak": e.get("peakTime"),
        "classType": e.get("classType"), "source": e.get("sourceLocation"),
        "activeRegion": e.get("activeRegionNum"), "link": e.get("link"),
    }


def slim_sep(e: dict) -> dict:
    return {
        "id": e.get("sepID"), "time": e.get("eventTime"),
        "instruments": [i.get("displayName") for i in (e.get("instruments") or [])],
        "link": e.get("link"),
    }


def slim_cme(e: dict) -> dict:
    an = next((a for a in (e.get("cmeAnalyses") or []) if a.get("isMostAccurate")), None) or \
        ((e.get("cmeAnalyses") or [None])[0])
    return {
        "id": e.get("activityID"), "start": e.get("startTime"), "source": e.get("sourceLocation"),
        "speedKmS": an.get("speed") if an else None, "type": an.get("type") if an else None,
        "note": (e.get("note") or "")[:280], "link": e.get("link"),
    }


def fetch_donki() -> None:
    print("[2/3] DONKI SEP/FLR/CME...")
    end = date.today()
    start = end - timedelta(days=DONKI_MAX_DAYS)
    out = {}
    for kind, slim in (("SEP", slim_sep), ("FLR", slim_flr), ("CME", slim_cme)):
        events = donki(kind, start, end)
        slimmed = [slim(e) for e in events]
        if kind == "CME":  # mantém o JSON leve: só os 40 mais recentes / keep the 40 most recent
            slimmed = slimmed[-40:]
        out[kind] = {"window": [start.isoformat(), end.isoformat()], "historical": False,
                     "total": len(events), "events": slimmed}
        print(f"   {kind}: {len(events)} eventos ({start} -> {end})")

    if not out["SEP"]["events"]:
        hs, he = DONKI_FALLBACK
        sep_hist = donki("SEP", hs, he)
        flr_hist = donki("FLR", hs, he)
        print(f"   SEP vazio nos últimos 60 dias -> janela histórica {hs} -> {he}: {len(sep_hist)} SEP")
        out["historicalExample"] = {
            "window": [hs.isoformat(), he.isoformat()],
            "label": "May 2024 solar storm (real historical example)",
            "SEP": [slim_sep(e) for e in sep_hist],
            "FLR_X": [slim_flr(e) for e in flr_hist if (e.get("classType") or "").startswith("X")],
        }

    flrs = out["FLR"]["events"]
    strongest = max(flrs, key=lambda f: flare_rank(f.get("classType")), default=None)
    out["summary"] = {
        "sepCount": len(out["SEP"]["events"]),
        "flrCount": len(flrs),
        "xClassCount": sum(1 for f in flrs if (f.get("classType") or "").startswith("X")),
        "mClassCount": sum(1 for f in flrs if (f.get("classType") or "").startswith("M")),
        "cmeCount": out["CME"]["total"],
        "strongestFlare": strongest,
    }
    out.update({
        "source": "NASA CCMC DONKI - Space Weather Database Of Notifications, Knowledge, Information",
        "url": "https://ccmc.gsfc.nasa.gov/tools/DONKI/",
        "api": DONKI_BASE,
        "fetchedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    })
    write("donki_space_weather.json", out)


def flare_rank(c: str | None) -> float:
    if not c:
        return 0
    base = {"A": 1, "B": 10, "C": 100, "M": 1000, "X": 10000}.get(c[0], 0)
    try:
        return base * float(c[1:] or 1)
    except ValueError:
        return base


# ---------------------------------------------------------------- 3. Radiation reference
def write_radiation_reference() -> None:
    """
    Os dados brutos do Curiosity RAD estão no PDS (Planetary Plasma Interactions Node) em
    formato de tabela PDS, por sol/observação; converter isso exige parser específico e está
    fora do escopo do MVP. Usamos as taxas de dose PUBLICADAS (revisadas por pares) derivadas
    desses dados, com a fonte de cada número.
    Raw Curiosity RAD data live in PDS PPI as PDS tables; we use the peer-reviewed published
    dose rates derived from them instead, each with its source.
    """
    print("[3/3] Referência de radiação (valores publicados, com fonte)...")
    write(
        "radiation_reference.json",
        {
            "careerLimitMSv": 600,
            "careerLimitSource": "NASA-STD-3001 Vol. 1 – 600 mSv career effective dose limit",
            "careerLimitUrl": "https://www.nasa.gov/reference/4-0-human-performance/",
            "rawDataNote": "Raw MSL/Curiosity RAD data: PDS PPI Node (https://pds-ppi.igpp.ucla.edu/). Not converted in this MVP; published peer-reviewed dose rates are used instead.",
            "environments": {
                "iss": {"mSvPerDay": 0.35, "range": [0.2, 0.5],
                        "source": "Space agency-specific standards for crew dose and risk assessment of ionising radiation exposures for the ISS (PMC10919966): ~0.2 to ~0.5 mSv/day (midpoint used)",
                        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC10919966/"},
                "marsTransit": {"mSvPerDay": 1.84,
                        "source": "Zeitlin et al. 2013, Science 340:1080 – MSL RAD during Earth–Mars cruise",
                        "url": "https://www.science.org/doi/10.1126/science.1235989"},
                "marsBase": {"mSvPerDay": 0.64,
                        "source": "Hassler et al. 2014, Science 343:1244797 – Curiosity RAD on the Martian surface (Gale crater)",
                        "url": "https://www.science.org/doi/10.1126/science.1244797"},
                "moonBase": {"mSvPerDay": 1.369,
                        "source": "Zhang et al. 2020, Science Advances 6:eaaz1334 – Chang'e-4 LND, lunar surface",
                        "url": "https://www.science.org/doi/10.1126/sciadv.aaz1334"},
            },
        },
    )


def main() -> int:
    failures = 0
    for step in (fetch_osd575, fetch_donki, write_radiation_reference):
        try:
            step()
        except Exception as exc:  # mantém os JSON anteriores se um passo falhar
            failures += 1
            print(f"   ERRO em {step.__name__}: {exc}", file=sys.stderr)
    print("Concluído." if not failures else f"Concluído com {failures} falha(s); JSONs anteriores mantidos.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
