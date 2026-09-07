import fitz, re

pdf_path = "attached_assets/ChainsawCoursesV1.1_1785417308444.pdf"
doc = fitz.open(pdf_path)

# Pages with residual US spellings + guide bar instances
for p in [128, 131, 132, 135, 136]:
    page = doc[p - 1]
    text = page.get_text()
    print(f"\n{'='*60}\nPAGE {p}\n{'='*60}")
    print(text)

# All "guide bar" (two words) occurrences
print("\n### 'guide bar' (two words) OCCURRENCES ###")
all_pages = [(i+1, doc[i].get_text()) for i in range(doc.page_count)]
for page_num, text in all_pages:
    for match in re.finditer(r'.{0,60}\bguide bar\b.{0,60}', text, re.IGNORECASE):
        print(f"  [P{page_num}] {match.group(0).strip()}")

# Summarize / Summarise
print("\n### 'Summarize' occurrences ###")
for page_num, text in all_pages:
    for match in re.finditer(r'.{0,40}summarize.{0,60}', text, re.IGNORECASE):
        print(f"  [P{page_num}] {match.group(0).strip()}")

doc.close()
