# Компьютердегі ЖИ

Орнатылған жергілікті нұсқада llama.cpp сервері мен Qwen3-4B-Instruct-2507 моделі қолданылады. Сервер OpenAI-үйлесімді API ұсынады. Cloudflare арқылы ашылған сайт жеке компьютердегі модельге тәуелсіз.

Басқа компьютерге көшіру үшін:

1. [llama.cpp шығарылымдарынан](https://github.com/ggml-org/llama.cpp/releases) Windows құрылғысына тиісті жинақты жүктеп, осы папкадағы runtime ішіне шығарыңыз. runtime/llama-server.exe болуы керек.
2. [GGUF жинағынан](https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/tree/a06e946bb6b655725eafa393f4a9745d460374c9) Qwen3-4B-Instruct-2507-Q4_K_M.gguf файлын жүктеп, model/qwen3-4b.gguf деп сақтаңыз. SHA256: 3605803b982cb64aead44f6c1b2ae36e3acdb41d8e46c8a94c6533bc4c67e597.
3. SmartEdu.cmd арқылы қосыңыз. Дайын модель автоматты түрде іске қосылады. Өз OpenAI-үйлесімді жергілікті серверіңіз үшін SMARTEDU_MODEL_URL айнымалысын оның /v1 мекенжайына орнатыңыз.
