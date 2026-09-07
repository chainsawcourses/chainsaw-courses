import fitz
import json
import re

pdf_path = "attached_assets/ChainsawCoursesV1.1_1785417123480.pdf"
doc = fitz.open(pdf_path)

print(f"Pages: {doc.page_count}")
print(f"Metadata: {doc.metadata}")
print("=" * 80)

# Extract all text with page numbers
full_text = []
for i, page in enumerate(doc):
    text = page.get_text()
    full_text.append((i + 1, text))

# Write full text to file for reference
with open(".agents/outputs/manual_v1.1_new.txt", "w") as f:
    for page_num, text in full_text:
        f.write(f"\n{'='*60}\nPAGE {page_num}\n{'='*60}\n")
        f.write(text)

print("Full text extracted.")
print()

# ── Targeted checks ──────────────────────────────────────────────────────────

all_text = "\n".join(t for _, t in full_text)

# 1. Learning Outcomes
print("## LEARNING OUTCOMES")
lo_pattern = re.compile(r'(LO\d+.*?)(?=LO\d+|\Z)', re.DOTALL)
# Find pages with learning outcome content
for page_num, text in full_text:
    if re.search(r'learning outcome|LO\s*\d', text, re.IGNORECASE):
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        for j, line in enumerate(lines):
            if re.search(r'learning outcome|^LO\s*\d', line, re.IGNORECASE):
                # Print surrounding context
                start = max(0, j-1)
                end = min(len(lines), j+8)
                print(f"  [Page {page_num}]", " | ".join(lines[start:end]))
        print()

print()

# 2. MHOR 1992
print("## MHOR 1992 MENTIONS")
for page_num, text in full_text:
    if 'mhor' in text.lower() or 'manual handling operations' in text.lower():
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        for line in lines:
            if 'mhor' in line.lower() or 'manual handling operations' in line.lower():
                print(f"  [Page {page_num}] {line}")
print()

# 3. PPE / regulation years
print("## REGULATION YEARS (legislation with year citations)")
reg_pattern = re.compile(r'(PUWER|HSWA|COSHH|RIDDOR|MHOR|Manual Handling|Health and Safety at Work|Provision and Use|Control of Substances|EN 381|BS EN|PPE Regulations).*?(19\d{2}|20\d{2})', re.IGNORECASE)
seen = set()
for page_num, text in full_text:
    for match in reg_pattern.finditer(text):
        snippet = match.group(0).strip()[:120]
        if snippet not in seen:
            seen.add(snippet)
            print(f"  [Page {page_num}] {snippet}")
print()

# 4. US spellings
print("## US SPELLING CHECK")
us_words = {
    'color': 'colour',
    'center': 'centre',
    ' math ': 'maths',
    'analyze': 'analyse',
    'recognized': 'recognised',
    'discoloration': 'discolouration',
    'toward ': 'towards',
    'favor': 'favour',
    'neighbor': 'neighbour',
    'labor': 'labour',
    'fiber': 'fibre',
    'defense': 'defence',
    'practice ': 'practise (verb)',
}
for page_num, text in full_text:
    for us, uk in us_words.items():
        if us in text.lower():
            # Find the actual line
            for line in text.splitlines():
                if us in line.lower():
                    print(f"  [Page {page_num}] US '{us}' (should be '{uk}'): {line.strip()[:120]}")
print()

# 5. guidebar vs guide bar
print("## GUIDEBAR CONSISTENCY")
guidebar_count = len(re.findall(r'\bguidebar\b', all_text, re.IGNORECASE))
guide_bar_count = len(re.findall(r'\bguide bar\b', all_text, re.IGNORECASE))
print(f"  'guidebar': {guidebar_count} occurrences")
print(f"  'guide bar': {guide_bar_count} occurrences")
print()

# 6. LO verb check
print("## LO VERB AUDIT (Understand / Demonstrate flags)")
for page_num, text in full_text:
    if re.search(r'\bunderstand\b|\bdemonstrate\b', text, re.IGNORECASE):
        for line in text.splitlines():
            if re.search(r'\bunderstand\b|\bdemonstrate\b', line, re.IGNORECASE):
                print(f"  [Page {page_num}] {line.strip()[:140]}")
print()

# 7. Version metadata
print("## VERSION METADATA")
for page_num, text in full_text:
    for line in text.splitlines():
        if re.search(r'version|v1\.|revision|rev\b', line, re.IGNORECASE):
            print(f"  [Page {page_num}] {line.strip()[:120]}")
print()

# 8. Disclaimer page
print("## DISCLAIMER LOCATION")
for page_num, text in full_text:
    if 'disclaimer' in text.lower():
        print(f"  Disclaimer found on page {page_num}")
print()

doc.close()
print("Done.")
