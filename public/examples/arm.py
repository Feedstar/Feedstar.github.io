"""Feedstar's original MuJoCo teaching arm. Keep arm.xml next to this file.

Install: python -m pip install mujoco
Run:     python arm.py --example contact
Keys:    Space pause, R reset, 1 home, 2 side, 3 align, G open/close.
"""
import argparse
import math
from pathlib import Path
import time
import mujoco
import mujoco.viewer

POSES = {
    'home': [0, 0.48, 0.7, math.pi - 1.18],
    'inspect': [-0.55, 0.2, 1.0, math.pi - 1.2],
    'grasp': [0, 0.9, 1.4, math.pi - 2.3],
}
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--example', choices=['model', 'control', 'sensors', 'contact'], default='model')
parser.add_argument('--kp', type=float, default=120)
parser.add_argument('--kd', type=float, default=14)
parser.add_argument('--friction', type=float, default=0.8)
parser.add_argument('--no-gravity-comp', action='store_true')
args = parser.parse_args()
if not 20 <= args.kp <= 240 or not 0 <= args.kd <= 30 or not 0 <= args.friction <= 1.2:
    parser.error('Use Kp 20..240, Kd 0..30, and friction 0..1.2.')

model = mujoco.MjModel.from_xml_path(str(Path(__file__).with_name('arm.xml')))
data = mujoco.MjData(model)
settings = {'paused': False, 'reset': False, 'manual': False, 'pose': 'home', 'grip': 0}
for actuator in range(4):
    model.actuator_gainprm[actuator, 0] = args.kp
    model.actuator_biasprm[actuator, 1] = -args.kp
    model.actuator_biasprm[actuator, 2] = -args.kd
for name in ['turntable', 'upper_arm', 'forearm', 'wrist', 'left_finger', 'right_finger']:
    body = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_BODY, name)
    model.body_gravcomp[body] = 0 if args.no_gravity_comp else 1
model.geom_friction[:, 0] = args.friction


def reset():
    mujoco.mj_resetDataKeyframe(model, data, 0)
    data.ctrl[:4] = POSES['home']
    settings.update(pose='home', grip=0, reset=False, manual=False)
    mujoco.mj_forward(model, data)


def read_sensor(name):
    sensor = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_SENSOR, name)
    start = model.sensor_adr[sensor]
    return data.sensordata[start:start + model.sensor_dim[sensor]].copy()


def on_key(key):
    if key == 32:
        settings['paused'] = not settings['paused']
    elif key in [ord('R'), ord('r')]:
        settings['reset'] = True
    elif key in [ord('1'), ord('2'), ord('3')]:
        settings.update(manual=True, pose=['home', 'inspect', 'grasp'][key - ord('1')])
    elif key in [ord('G'), ord('g')]:
        settings.update(manual=True, grip=1 - settings['grip'])


reset()
next_report = 0.0
with mujoco.viewer.launch_passive(model, data, key_callback=on_key) as viewer:
    viewer.cam.lookat[:] = [0.25, 0, 0.45]
    viewer.cam.distance = 2.4
    viewer.cam.azimuth = 135
    viewer.cam.elevation = -20
    while viewer.is_running():
        start = time.perf_counter()
        if settings['reset']:
            reset()
            next_report = 0.0
        if not settings['paused']:
            if not settings['manual']:
                if args.example == 'contact':
                    # Align, close, lift, release: no weld or artificial attachment.
                    settings['pose'] = 'grasp' if 1 <= data.time < 6 else 'home'
                    settings['grip'] = 1 if 4 <= data.time < 10 else 0
                elif args.example in ['control', 'sensors']:
                    settings['pose'] = 'inspect' if int(data.time / 4) % 2 else 'home'
            data.ctrl[:4] = POSES[settings['pose']]
            data.ctrl[4:6] = 0.065 * settings['grip']
            mujoco.mj_step(model, data)
            # Refresh body transforms and sensors at the resulting state.
            mujoco.mj_forward(model, data)
            if data.time >= next_report:
                if args.example == 'sensors':
                    print('tool xyz:', read_sensor('tool_position'),
                          'shoulder sensor / qvel:', read_sensor('shoulder_velocity')[0], data.qvel[1])
                elif args.example == 'contact':
                    print('normal forces (N):', read_sensor('left_pressure')[0], read_sensor('right_pressure')[0])
                else:
                    print('qpos (rad):', data.qpos[:4], 'targets:', data.ctrl[:4])
                next_report += 0.25
        viewer.sync()
        time.sleep(max(0, model.opt.timestep - (time.perf_counter() - start)))
