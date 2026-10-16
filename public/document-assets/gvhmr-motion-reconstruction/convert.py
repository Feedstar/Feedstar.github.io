# convert_to_smplx_compatible.py
import os
import sys
import pickle
import numpy as np

ROOT = os.path.dirname(os.path.abspath(__file__))
SMPL_BASE = os.path.join(ROOT, "inputs", "checkpoints", "body_models", "SMPL_python_v.1.1.0", "smpl")
MODEL_DIR = os.path.join(SMPL_BASE, "models")
OUT_DIR = os.path.join(ROOT, "inputs", "checkpoints", "body_models", "smpl")
os.makedirs(OUT_DIR, exist_ok=True)

# add legacy smpl package to path so we can import its util
if SMPL_BASE not in sys.path:
    sys.path.insert(0, SMPL_BASE)
if os.path.join(SMPL_BASE, "smpl_webuser") not in sys.path:
    sys.path.insert(0, os.path.join(SMPL_BASE, "smpl_webuser"))

# compatibility for old package that uses cPickle etc (won't hurt if not used)
import pickle as _pickle
sys.modules.setdefault('cPickle', _pickle)

try:
    # legacy loader that returns either an object or a dict
    from smpl.smpl_webuser.serialization import load_model as legacy_load_model
except Exception as e:
    print("无法导入 legacy smpl loader:", e)
    legacy_load_model = None

# source -> dest map
model_map = {
    "basicmodel_m_lbs_10_207_0_v1.1.0.pkl": "SMPL_MALE.pkl",
    "basicmodel_f_lbs_10_207_0_v1.1.0.pkl": "SMPL_FEMALE.pkl",
    "basicmodel_neutral_lbs_10_207_0_v1.1.0.pkl": "SMPL_NEUTRAL.pkl",
}

# helper to extract numpy arrays from legacy object/dict
def extract_data(obj):
    """
    Try to create a plain dict with fields expected by smplx:
    - v_template, shapedirs, posedirs, J_regressor, weights, kintree_table, face_vertex, faces (if any)
    Return dict of numpy arrays.
    """
    out = {}
    # If already a dict, copy known keys
    if isinstance(obj, dict):
        keys = ["v_template", "shapedirs", "posedirs", "J_regressor", "weights", "kintree_table", "kintree_table", "faces"]
        for k, v in obj.items():
            # convert tensors to numpy if needed
            try:
                arr = np.array(v)
            except Exception:
                arr = v
            out[k] = arr
        return out

    # else attempt to read attributes from legacy object
    maybe_attrs = [
        "v_template", "shapedirs", "posedirs", "J_regressor", "weights", "kintree_table",
        "kintree_table", "faces", "f", "BSHAPE_DIM"
    ]
    for a in dir(obj):
        if a.startswith("_"):
            continue
        # pick attributes we care about
        if a in maybe_attrs:
            try:
                val = getattr(obj, a)
                out[a] = np.array(val)
            except Exception:
                try:
                    out[a] = val
                except Exception:
                    pass

    # also try known attribute names used in smpl_webuser models
    for known in ["v_template", "shapedirs", "posedirs", "J_regressor", "weights", "kintree_table", "faces"]:
        if known not in out and hasattr(obj, known):
            try:
                out[known] = np.array(getattr(obj, known))
            except Exception:
                out[known] = getattr(obj, known)

    # If shapedirs stored as a list or a 3D array under other names, try to find it
    if "shapedirs" not in out:
        # try common attribute names
        candidates = ["shapes", "shapedirs_list"]
        for c in candidates:
            if hasattr(obj, c):
                try:
                    out["shapedirs"] = np.array(getattr(obj, c))
                    break
                except Exception:
                    pass

    return out

# Convert each model
for src_name, dst_name in model_map.items():
    src_path = os.path.join(MODEL_DIR, src_name)
    dst_path = os.path.join(OUT_DIR, dst_name)

    if not os.path.exists(src_path):
        print(f"[跳过] 未找到源文件: {src_path}")
        continue

    print(f"[加载] {src_path}")
    # load with legacy loader if available, else try python pickle with latin1
    data_obj = None
    if legacy_load_model is not None:
        try:
            data_obj = legacy_load_model(src_path)
        except Exception as e:
            print("[warn] legacy_load_model 失败，尝试直接用 pickle (latin1):", e)
    if data_obj is None:
        with open(src_path, "rb") as f:
            data_obj = pickle.load(f, encoding="latin1")

    # extract pure numpy dict
    data_dict = extract_data(data_obj)
    if not data_dict:
        print(f"[错误] 无法从 {src_path} 提取必要字段，内容预览类型: {type(data_obj)}")
        # try saving raw to inspect later
        with open(dst_path + ".raw.pkl", "wb") as rf:
            pickle.dump(data_obj, rf, protocol=pickle.HIGHEST_PROTOCOL)
        print(f"[已保存原始对象到 {dst_path}.raw.pkl 以供调试]")
        continue

    # ensure minimal required keys exist for smplx
    required = ["v_template", "shapedirs", "posedirs", "J_regressor", "weights", "kintree_table"]
    missing = [k for k in required if k not in data_dict]
    if missing:
        print(f"[警告] 以下字段缺失 (可能仍可工作但要小心): {missing}")

    # save as clean pickle (python3-compatible) containing only numpy arrays / builtin types
    print(f"[保存] -> {dst_path}")
    with open(dst_path, "wb") as f:
        pickle.dump(data_dict, f, protocol=pickle.HIGHEST_PROTOCOL)

    print(f"✅ 已生成 {dst_path}\n")

print("=== 转换结束 ===")
