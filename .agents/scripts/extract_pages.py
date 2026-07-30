import fitz, re

pdf_path = "attached_assets/ChainsawCoursesV1.1_1785417308444.pdf"
doc = fitz.open(pdf_path)

pages_to_check = [3, 4, 5, 18, 19, 20, 21, 128, 131, 132, 135, 136]

for p in pages_to_check:
    page = doc[p - 1]
    text = page.get_text()
    print(f"\n{'='*60}")
    print(f"PAGE {p}")
    print('='*60)
    print(text)

# Also search whole doc for EN 381 / PPE standard
print("\n\n### EN 381 / PPE STANDARD SEARCH ###")
all_text = "".join(doc[i].get_text() for i in range(doc.page_count))
for match in re.finditer(r'.{0,80}(EN\s*381|EN\s*ISO\s*11393|PPE\s+Regulations|Personal\s+Protective\s+Equipment).{0,80}', all_text, re.IGNORECASE):
    print(f"  {match.group(0).strip()}")

print("\n### DISCLAIMER SEARCH ###")
for i in range(doc.page_count):
    t = doc[i].get_text()
    if 'disclaimer' in t.lower() or 'liability' in t.lower():
        print(f"  Page {i+1}: {[l.strip() for l in t.splitlines() if 'disclaimer' in l.lower() or 'liability' in l.lower()]}")

doc.close()
