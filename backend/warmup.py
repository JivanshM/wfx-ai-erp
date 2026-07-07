"""Runs during the deployment build step (see Render build command).

Pre-downloads the ~80MB embedding model so it is already on disk when
the server boots - otherwise every deploy would download it at startup,
making the first request painfully slow.
"""

from chromadb.utils.embedding_functions.onnx_mini_lm_l6_v2 import ONNXMiniLM_L6_V2

ONNXMiniLM_L6_V2()(["warmup"])
print("Embedding model downloaded and ready")
