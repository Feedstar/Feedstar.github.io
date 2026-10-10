"""Rebuild the downloadable original example after editing arm.xml or arm.py.

python3 scripts/package-arm.py
python3 scripts/package-arm.py --check
"""
import argparse
from pathlib import Path
import zipfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
examples = Path(__file__).resolve().parents[1] / 'public/examples'
names = ['arm.xml', 'arm.py']
bundle = examples / 'arm-lab.zip'
if args.check:
    with zipfile.ZipFile(bundle) as archive:
        assert archive.namelist() == names
        for name in names:
            assert archive.read(name) == (examples / name).read_bytes(), f'{name} in archive is stale'
    print('Download bundle matches the current original sources.')
else:
    with zipfile.ZipFile(bundle, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name in names:
            entry = zipfile.ZipInfo(name, (2026, 10, 10, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(entry, (examples / name).read_bytes())
    print(f'Packaged {bundle.name}: {bundle.stat().st_size} bytes')
