#!/usr/bin/env python3
"""
下载并量化 pyannote speaker embedding 模型为 INT8
使用动态量化，只量化 MatMul/Gemm 层，避免 ConvInteger 兼容性问题
"""

from huggingface_hub import hf_hub_download
from onnxruntime.quantization import quantize_dynamic, QuantType
import os

# 下载 pyannote embedding 模型
print("正在下载 pyannote/embedding ONNX 模型...")
model_path = hf_hub_download(repo_id="deepghs/pyannote-embedding-onnx", filename="model.onnx")
print(f"模型已下载到: {model_path}")

# 量化输出路径
output_dir = os.path.join(os.path.dirname(__file__), "..", "client", "public", "models")
quantized_model_path = os.path.join(output_dir, "speaker_embedding_int8.onnx")

# 执行 INT8 动态量化 - 只量化 MatMul 和 Gemm，跳过 Conv（避免 ConvInteger 不支持的问题）
print("正在执行 INT8 动态量化（仅 MatMul/Gemm）...")
quantize_dynamic(
    model_input=model_path,
    model_output=quantized_model_path,
    weight_type=QuantType.QUInt8,  # 使用 QUInt8 更兼容
    op_types_to_quantize=['MatMul', 'Gemm'],  # 只量化这些算子，跳过 Conv
)
print(f"量化完成: {quantized_model_path}")

# 打印大小对比
original_size = os.path.getsize(model_path) / (1024 * 1024)
quantized_size = os.path.getsize(quantized_model_path) / (1024 * 1024)
print(f"原始模型大小: {original_size:.2f} MB")
print(f"量化模型大小: {quantized_size:.2f} MB")
print(f"压缩比: {original_size/quantized_size:.1f}x")
