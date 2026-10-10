"""Run the same MJCF models used by Feedstar's browser experiments.

Usage: python run.py pendulum.xml
       python run.py pendulum.xml --damping 0.8 --angle 0.85
       python run.py actuator.xml --target 0.6 --gain 30
       python run.py contact.xml --friction 0.25
"""
import argparse
import time
from pathlib import Path
import mujoco
import mujoco.viewer

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("model", type=Path)
parser.add_argument("--damping", type=float, default=0.12)
parser.add_argument("--angle", type=float, default=0.85, help="radians")
parser.add_argument("--target", type=float, default=0.6, help="radians")
parser.add_argument("--gain", type=float, default=30)
parser.add_argument("--friction", type=float, default=0.25)
args = parser.parse_args()
model = mujoco.MjModel.from_xml_path(str(args.model.resolve()))
data = mujoco.MjData(model)
mujoco.mj_resetDataKeyframe(model, data, 0)
if args.model.stem == "pendulum":
    model.dof_damping[0] = args.damping
    data.qpos[0] = args.angle
elif args.model.stem == "actuator":
    data.ctrl[0] = args.target
    model.actuator_gainprm[0, 0] = args.gain
    model.actuator_biasprm[0, 1] = -args.gain
elif args.model.stem == "contact":
    model.geom_friction[:, 0] = args.friction
mujoco.mj_forward(model, data)
with mujoco.viewer.launch_passive(model, data) as viewer:
    while viewer.is_running():
        start = time.monotonic()
        mujoco.mj_step(model, data)
        viewer.sync()
        time.sleep(max(0, model.opt.timestep - (time.monotonic() - start)))
