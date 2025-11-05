import sys
from pathlib import Path
from pdfminer.high_level import extract_text


def extract_all_pdfs(root: Path) -> None:
    for pdf_path in root.rglob('*.pdf'):
        try:
            out_path = pdf_path.with_suffix('.txt')
            text = extract_text(str(pdf_path)) or ''
            out_path.write_text(text, encoding='utf-8')
            print(f"Wrote: {out_path}")
        except Exception as e:
            print(f"Failed: {pdf_path} -> {e}", file=sys.stderr)


if __name__ == '__main__':
    root = Path.cwd()
    extract_all_pdfs(root)

