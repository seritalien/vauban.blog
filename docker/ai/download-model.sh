#!/bin/bash
# Download additional models for LocalAI
# Usage: ./download-model.sh <model-name>

set -e

MODELS_DIR="/tmp"
CONTAINER="vauban-localai"

# Model definitions: name -> URL, size, config
declare -A MODEL_URLS=(
  ["smollm2-360m"]="https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct-GGUF/resolve/main/smollm2-360m-instruct-q8_0.gguf"
  ["tinyllama"]="https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf"
  ["gemma-2b"]="https://huggingface.co/google/gemma-2b-it-GGUF/resolve/main/gemma-2b-it.q4_k_m.gguf"
  ["phi-3-mini"]="https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf"
  ["llama3-8b"]="https://huggingface.co/QuantFactory/Meta-Llama-3-8B-Instruct-GGUF/resolve/main/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf"
)

declare -A MODEL_FILES=(
  ["smollm2-360m"]="smollm2-360m-instruct-q8_0.gguf"
  ["tinyllama"]="tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf"
  ["gemma-2b"]="gemma-2b-it.q4_k_m.gguf"
  ["phi-3-mini"]="phi-3-mini-4k-instruct-q4.gguf"
  ["llama3-8b"]="Meta-Llama-3-8B-Instruct.Q4_K_M.gguf"
)

declare -A MODEL_SIZES=(
  ["smollm2-360m"]="230MB"
  ["tinyllama"]="670MB"
  ["gemma-2b"]="1.5GB"
  ["phi-3-mini"]="2.4GB"
  ["llama3-8b"]="4.7GB"
)

show_help() {
  echo "Modèles LocalAI - Téléchargement"
  echo ""
  echo "Déjà installés:"
  echo "  ✓ qwen2-1.5b  (941MB)  - Rapide, ~5s"
  echo "  ✓ mistral     (4.1GB)  - Qualité, ~30s"
  echo ""
  echo "Ultra-légers (tags, titres):"
  echo "  - smollm2-360m (230MB) - Le plus rapide, ~1s"
  echo "  - tinyllama    (670MB) - Très rapide, ~3s"
  echo ""
  echo "Légers:"
  echo "  - gemma-2b     (1.5GB) - Google, ~6s"
  echo "  - phi-3-mini   (2.4GB) - Bon compromis, ~8s"
  echo ""
  echo "Qualité max:"
  echo "  - llama3-8b    (4.7GB) - Meilleure qualité, ~40s"
  echo ""
  echo "Usage: $0 <model-name>"
  echo "Exemple: $0 smollm2-360m"
}

if [ -z "$1" ] || [ "$1" == "-h" ] || [ "$1" == "--help" ]; then
  show_help
  exit 0
fi

MODEL=$1

if [ -z "${MODEL_URLS[$MODEL]}" ]; then
  echo "❌ Modèle inconnu: $MODEL"
  show_help
  exit 1
fi

URL="${MODEL_URLS[$MODEL]}"
FILE="${MODEL_FILES[$MODEL]}"
SIZE="${MODEL_SIZES[$MODEL]}"

echo "📥 Téléchargement de $MODEL ($SIZE)..."
curl -L --progress-bar -o "$MODELS_DIR/$FILE" "$URL"

echo "📦 Copie vers LocalAI..."
docker cp "$MODELS_DIR/$FILE" "$CONTAINER:/models/"

echo "📝 Création de la config..."

# Generate model-specific config
case $MODEL in
  smollm2-360m)
    cat > "/tmp/$MODEL.yaml" << 'YAML'
name: smollm2-360m
backend: llama-cpp
parameters:
  model: smollm2-360m-instruct-q8_0.gguf
  temperature: 0.7
  top_p: 0.9
  context_size: 2048
  threads: 4
  stop:
    - "<|im_end|>"
    - "<|endoftext|>"
YAML
    ;;
  tinyllama)
    cat > "/tmp/$MODEL.yaml" << 'YAML'
name: tinyllama
backend: llama-cpp
parameters:
  model: tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf
  temperature: 0.7
  top_p: 0.9
  context_size: 2048
  threads: 4
  stop:
    - "</s>"
    - "<|im_end|>"
YAML
    ;;
  phi-3-mini)
    cat > "/tmp/$MODEL.yaml" << 'YAML'
name: phi-3-mini
backend: llama-cpp
parameters:
  model: phi-3-mini-4k-instruct-q4.gguf
  temperature: 0.7
  top_p: 0.9
  context_size: 4096
  threads: 4
  stop:
    - "<|end|>"
    - "<|endoftext|>"
YAML
    ;;
  gemma-2b)
    cat > "/tmp/$MODEL.yaml" << 'YAML'
name: gemma-2b
backend: llama-cpp
parameters:
  model: gemma-2b-it.q4_k_m.gguf
  temperature: 0.7
  top_p: 0.9
  context_size: 8192
  threads: 4
  stop:
    - "<end_of_turn>"
    - "<eos>"
YAML
    ;;
  llama3-8b)
    cat > "/tmp/$MODEL.yaml" << 'YAML'
name: llama3-8b
backend: llama-cpp
parameters:
  model: Meta-Llama-3-8B-Instruct.Q4_K_M.gguf
  temperature: 0.7
  top_p: 0.9
  context_size: 8192
  threads: 4
  stop:
    - "<|eot_id|>"
    - "<|end_of_text|>"
YAML
    ;;
esac

docker cp "/tmp/$MODEL.yaml" "$CONTAINER:/models/"

echo "🔄 Redémarrage de LocalAI..."
docker restart "$CONTAINER"

echo "✅ $MODEL installé ! Disponible dans ~30s"
