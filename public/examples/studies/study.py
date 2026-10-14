"""Feedstar original studies 08–11. Python 3.10+, mujoco 3.15, numpy.

python study.py --example inverse-kinematics
python study.py --example linkage --open-loop
python study.py --example tendon --stiffness 50 --damping 0.2
python study.py --example scanner --mode fixed --y 0.5
Use --headless --duration 5 to run without a graphical desktop.
"""
from pathlib import Path
import argparse
import json
import time
import mujoco
import numpy as np

DEFAULTS = {
    'inverse-kinematics': dict(x=.55, y=.12, z=.5, damping=.04, rate=.5, mode='point'),
    'linkage': dict(rate=.7, closed=True),
    'tendon': dict(stiffness=120., damping=2., mass=1., amplitude=.1, rate=1.5, mode='step'),
    'scanner': dict(x=.8, y=0., span=150., rate=.8, mode='sweep'),
}
LIMITS = {
    'inverse-kinematics': dict(x=(.15,1.1), y=(-.5,.5), z=(.2,1.15), damping=(.01,.2), rate=(.15,1.2)),
    'linkage': dict(rate=(.2,2.5)),
    'tendon': dict(stiffness=(30,350), damping=(0,10), mass=(.3,3), amplitude=(.03,.13), rate=(.5,4)),
    'scanner': dict(x=(.45,1.1), y=(-.65,.65), span=(30,200), rate=(.2,2)),
}
MODES = {'inverse-kinematics': ('point','circle'), 'tendon': ('step','wave'), 'scanner': ('sweep','fixed')}

class Study:
    def __init__(self, kind, **settings):
        self.kind = kind
        self.settings = DEFAULTS[kind] | settings
        root = Path(__file__).resolve().parent
        path = root / ('arm.xml' if kind == 'inverse-kinematics' else f'{kind}.xml')
        if kind == 'inverse-kinematics' and not path.exists():
            path = root.parent / 'arm.xml'
        self.model = mujoco.MjModel.from_xml_path(str(path))
        self.data = mujoco.MjData(self.model)
        self.home = np.array([0., .48, .7, np.pi-1.18])
        self.solved = self.home.copy()
        self.goal = np.zeros(3)
        self.residual = 0.
        self.control_time = -1.
        if kind == 'inverse-kinematics':
            self.joints = [self.model.joint(n) for n in ('base','shoulder','elbow','wrist')]
            self.qids = np.array([j.qposadr[0] for j in self.joints])
            self.dofs = np.array([j.dofadr[0] for j in self.joints])
            self.bounds = np.array([j.range for j in self.joints])
            self.scratch = mujoco.MjData(self.model)
            self.jac = np.zeros((3, self.model.nv))
            self.tip = self.model.site('tool_tip').id
        self.reset()

    def reset(self):
        m, d, s = self.model, self.data, self.settings
        if self.kind == 'inverse-kinematics':
            mujoco.mj_resetDataKeyframe(m, d, 0)
            self.solved = self.home.copy()
        else:
            mujoco.mj_resetData(m, d)
        if self.kind == 'linkage':
            d.eq_active[0] = s['closed']
        elif self.kind == 'tendon':
            m.tendon_stiffness[0], m.tendon_damping[0] = s['stiffness'], s['damping']
            body = m.body('load').id
            # The original cube is 1 kg; preserve its dimensions while varying mass.
            m.body_inertia[body] = np.full(3, s['mass'] * (0.13**2 + 0.13**2) / 12)
            m.body_mass[body] = s['mass']
            mujoco.mj_setConst(m, mujoco.MjData(m))
        elif self.kind == 'scanner':
            d.mocap_pos[0] = [s['x'], s['y'], .2]
        self.control()
        mujoco.mj_forward(m, d)

    def control(self):
        m, d, s = self.model, self.data, self.settings
        if self.kind == 'inverse-kinematics':
            phase = d.time * s['rate']
            circle = s['mode'] == 'circle'
            self.goal = np.array([s['x'], s['y'] + (.1*np.sin(phase) if circle else 0), s['z'] + (.1*np.cos(phase) if circle else 0)])
            scratch = self.scratch
            scratch.qpos[:] = d.qpos
            scratch.qpos[self.qids] = self.solved
            for _ in range(12):
                mujoco.mj_forward(m, scratch)
                error = self.goal - scratch.site_xpos[self.tip]
                if np.linalg.norm(error) < .00005:
                    break
                mujoco.mj_jacSite(m, scratch, self.jac, None, self.tip)
                J = self.jac[:, self.dofs]
                delta = J.T @ np.linalg.solve(J @ J.T + s['damping']**2*np.eye(3), error)
                scratch.qpos[self.qids] = np.clip(scratch.qpos[self.qids] + np.clip(delta,-.12,.12), self.bounds[:,0], self.bounds[:,1])
            self.solved = scratch.qpos[self.qids].copy()
            mujoco.mj_forward(m, scratch)
            self.residual = np.linalg.norm(self.goal - scratch.site_xpos[self.tip])
            d.ctrl[:4] = self.solved
            m.actuator_gainprm[:4,0] = 180
            m.actuator_biasprm[:4,1] = -180
            m.actuator_biasprm[:4,2] = -20
            d.ctrl[4:] = 0
        elif self.kind == 'linkage':
            d.ctrl[0] = .7 * np.sin(d.time*s['rate'])
        elif self.kind == 'tendon':
            d.ctrl[0] = (0 if d.time < .5 else -s['amplitude']) if s['mode']=='step' else -s['amplitude']*(1-np.cos(d.time*s['rate']))/2
        elif self.kind == 'scanner':
            d.ctrl[0] = 0 if s['mode']=='fixed' else s['span']*np.pi/360*np.sin(d.time*s['rate'])
        self.control_time = d.time

    def step(self):
        if self.data.time-self.control_time >= .01-1e-8:
            self.control()
        mujoco.mj_step(self.model,self.data)

    def observe(self):
        m,d,s = self.model,self.data,self.settings
        mujoco.mj_forward(m,d)
        if self.kind=='inverse-kinematics':
            actual=d.site_xpos[self.tip]
            values=[np.linalg.norm(self.goal-actual)*1000,self.residual*1000,np.rad2deg(np.max(np.abs(self.solved-d.qpos[self.qids])))]
        elif self.kind=='linkage':
            a,b = d.site('closure_a').xpos,d.site('closure_b').xpos
            values=[np.linalg.norm(a-b)*1000,np.rad2deg(d.qpos[0]),np.rad2deg(d.qpos[2])]
        elif self.kind=='tendon':
            length=d.ten_length[0]
            extension=length-m.tendon_lengthspring[0,0]
            force=-s['stiffness']*extension-s['damping']*d.ten_velocity[0]
            values=[length,extension*1000,force]
        else:
            distance=d.sensor('range').data[0]
            values=[distance,np.rad2deg(d.qpos[0]),float(distance>=0)]
        return dict(time=float(d.time),values=[float(v) for v in values],qpos=d.qpos.tolist())

    def annotate(self, viewer):
        if self.kind != 'inverse-kinematics':
            return
        # A goal marker in the native viewer; no body is teleported to the goal.
        scene=viewer.user_scn
        scene.ngeom=1
        mujoco.mjv_initGeom(scene.geoms[0],mujoco.mjtGeom.mjGEOM_SPHERE,np.array([.022]*3),self.goal,np.eye(3).ravel(),np.array([.92,.76,.49,1],dtype=np.float32))


def main():
    parser=argparse.ArgumentParser(description=__doc__,formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--example',choices=DEFAULTS,required=True)
    parser.add_argument('--headless',action='store_true')
    parser.add_argument('--duration',type=float,default=12)
    parser.add_argument('--mode')
    parser.add_argument('--open-loop',action='store_true')
    for name in ('x','y','z','damping','rate','stiffness','mass','amplitude','span'):
        parser.add_argument('--'+name,type=float)
    args=parser.parse_args()
    settings={}
    for key,bounds in LIMITS[args.example].items():
        value=getattr(args,key)
        if value is not None:
            if not np.isfinite(value) or not bounds[0]<=value<=bounds[1]:
                parser.error(f'{key} must be in {bounds}')
            settings[key]=value
    for key in ('x','y','z','damping','rate','stiffness','mass','amplitude','span'):
        if getattr(args,key) is not None and key not in LIMITS[args.example]:
            parser.error(f'{key} is not used by {args.example}')
    if args.mode:
        if args.mode not in MODES.get(args.example,()): parser.error('Mode does not belong to this experiment')
        settings['mode']=args.mode
    if args.open_loop:
        if args.example!='linkage': parser.error('--open-loop is only for linkage')
        settings['closed']=False
    if not np.isfinite(args.duration) or args.duration<=0: parser.error('duration must be positive')
    study=Study(args.example,**settings)
    if args.headless:
        for _ in range(round(args.duration/study.model.opt.timestep)):
            study.step()
        print(json.dumps(study.observe(),ensure_ascii=False))
    else:
        import mujoco.viewer
        with mujoco.viewer.launch_passive(study.model,study.data) as viewer:
            viewer.opt.flags[mujoco.mjtVisFlag.mjVIS_RANGEFINDER] = True
            viewer.opt.flags[mujoco.mjtVisFlag.mjVIS_TENDON] = True
            viewer.cam.azimuth=135
            viewer.cam.elevation=-30
            viewer.cam.distance=2.7
            viewer.cam.lookat[:]=[.3,0,.35]
            last_print=-1.
            while viewer.is_running():
                start=time.perf_counter()
                study.step()
                if study.data.time-last_print>=.1:
                    study.annotate(viewer)
                    last_print=study.data.time
                viewer.sync()
                time.sleep(max(0,study.model.opt.timestep-(time.perf_counter()-start)))
if __name__=='__main__':
    main()
