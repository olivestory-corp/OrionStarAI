#!/usr/bin/env python3
import onnx

model_path = "client/public/models/speaker_embedding.onnx"
model = onnx.load(model_path)

print("=== 模型输入 ===")
for inp in model.graph.input:
    print(f"  名称: {inp.name}")
    shape = [d.dim_value if d.dim_value else d.dim_param for d in inp.type.tensor_type.shape.dim]
    print(f"  形状: {shape}")

print("\n=== 模型输出 ===")
for out in model.graph.output:
    print(f"  名称: {out.name}")
    shape = [d.dim_value if d.dim_value else d.dim_param for d in out.type.tensor_type.shape.dim]
    print(f"  形状: {shape}")
