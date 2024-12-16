from pathlib import Path
import json

# Create required directories
stati_dir = Path("stati")
static_dir = Path("static")
stati_dir.mkdir(exist_ok=True)
static_dir.mkdir(exist_ok=True)

# Create a sample state file
sample_state = """STATO: Albania

REQUISITI DELLE COPPIE ADOTTANTI
- coppie sposate (art. 242 del Codice)
- differenza di età con il minore di almeno 18 anni
- età minima 25 anni
- età massima 45 anni
- durata minima del matrimonio: 3 anni

REQUISITI DEI MINORI ADOTTANDI
- età compresa tra 0 e 15 anni
- dichiarazione di adottabilità
- consenso del minore se maggiore di 10 anni

PASSAGGI DELLA PROCEDURA
- presentazione della domanda presso il Tribunale albanese
- abbinamento proposto dall'autorità albanese
- periodo di affidamento preadottivo
- sentenza di adozione

POST ADOZIONE
- relazioni post-adottive per 2 anni
- visite periodiche dell'assistente sociale

NOTE:
Paese aderente alla Convenzione de L'Aja"""

with open(stati_dir / "Albania.txt", "w", encoding="utf-8") as f:
    f.write(sample_state)

# Create initial state_markings.json if it doesn't exist
if not Path("state_markings.json").exists():
    initial_markings = {
        "markings": {},
        "highlights": {}
    }
    with open("state_markings.json", "w") as f:
        json.dump(initial_markings, f, indent=4)

print("Setup completed successfully!")
