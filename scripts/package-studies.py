"""Build/check deterministic source bundles for Feedstar studies 08–11."""
from pathlib import Path
import argparse
import zipfile
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check',action='store_true')
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]/'public/examples'
for kind in ('inverse-kinematics','linkage','tendon','scanner'):
    model=root/'arm.xml' if kind=='inverse-kinematics' else root/'studies'/f'{kind}.xml'
    entries={model.name:model.read_bytes(),'study.py':(root/'studies/study.py').read_bytes(), 'RUN.txt':f'''Feedstar / {kind}
Original teaching example. Run locally with Python 3.10+.

pip install mujoco==3.15.0 numpy
python study.py --example {kind}

Headless:
python study.py --example {kind} --headless --duration 12

Use --help for parameters. Only this experiment's model is included.
Read the matching field note: https://feedstar.github.io/journal/{kind}/
'''.encode()}
    bundle=root/'studies'/f'{kind}.zip'
    if args.check:
        with zipfile.ZipFile(bundle) as archive:
            assert archive.namelist()==list(entries)
            for name,content in entries.items():assert archive.read(name)==content,f'{bundle.name}: stale {name}'
    else:
        with zipfile.ZipFile(bundle,'w',zipfile.ZIP_DEFLATED) as archive:
            for name,content in entries.items():
                entry=zipfile.ZipInfo(name,(2026,10,14,0,0,0));entry.compress_type=zipfile.ZIP_DEFLATED
                archive.writestr(entry,content)
print('Four study download bundles match original XML and Python sources.' if args.check else 'Packaged four original study bundles.')
