import pickle
import numpy as np
import os
from scipy.sparse import csc_matrix

base_dir = "inputs/checkpoints/body_models/smpl"
names = ["SMPL_MALE.pkl", "SMPL_FEMALE.pkl", "SMPL_NEUTRAL.pkl"]

for name in names:
    path = os.path.join(base_dir, name)
    if not os.path.exists(path):
        print(f"[跳过] {path} 不存在")
        continue

    print(f"[加载] {path}")
    with open(path, "rb") as f:
        data = pickle.load(f)

    for k, v in data.items():
        # 解包 object 数组
        if isinstance(v, np.ndarray) and v.shape == () and hasattr(v.item(), "toarray"):
            print(f"  - {k} 是装着 csc_matrix 的 ndarray，展开转换")
            v = v.item()
        if isinstance(v, np.ndarray) and v.shape == () and not np.isscalar(v):
            try:
                v = v.item()
            except Exception:
                pass

        # 转换稀疏矩阵
        if isinstance(v, csc_matrix):
            print(f"  - {k} 是 csc_matrix，转换为 ndarray")
            v = v.toarray().astype(np.float32)

        # 转换 numpy.object arrays
        if isinstance(v, np.ndarray) and v.dtype == object:
            print(f"  - {k} 是 object 数组，尝试转换为 float32")
            try:
                v = np.array(v, dtype=np.float32)
            except Exception:
                v = np.array([np.array(x) for x in v], dtype=object)

        data[k] = v

    # 再次检查 J_regressor
    if "J_regressor" in data and hasattr(data["J_regressor"], "toarray"):
        data["J_regressor"] = data["J_regressor"].toarray().astype(np.float32)
        print("  - 再次修复 J_regressor")

    with open(path, "wb") as f:
        pickle.dump(data, f, protocol=pickle.HIGHEST_PROTOCOL)
    print(f"✅ 已彻底修复并保存 {path}\n")

print("=== 所有模型修复完成 ===")
