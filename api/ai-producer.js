const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 25000);

const STYLE = ["hardgroove", "schranz", "acid", "raw", "afro", "peaktime", "hypnotic", "melodic", "industrial"];
const PRESET = ["hardgroove", "schranz", "acid", "raw", "afro", "hard", "melodic", "hypnotic", "industrial"];
const EMOTION = ["melancolia", "esperanza", "epica", "oscuridad", "nostalgia", "grandeza", "tension", "liberacion"];
const SCALE = ["minor", "phrygian", "dorian", "ionian", "lydian"];
const FX = ["none", "riser", "impact", "drop"];
const TRACKS = ["kick", "clap", "chat", "ohat", "bass", "stab"];

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "intent", "signature", "controls", "macros", "sections"],
  properties: {
    title: { type: "string", minLength: 3, maxLength: 80 },
    intent: { type: "string", minLength: 8, maxLength: 260 },
    signature: { type: "string", minLength: 8, maxLength: 80 },
    controls: {
      type: "object",
      additionalProperties: false,
      required: ["preset", "style", "bpm", "root", "emotion", "scale", "energy", "swing", "rumble", "humanize"],
      properties: {
        preset: { type: "string", enum: PRESET },
        style: { type: "string", enum: STYLE },
        bpm: { type: "integer", minimum: 118, maximum: 160 },
        root: { type: "integer", minimum: 0, maximum: 11 },
        emotion: { type: "string", enum: EMOTION },
        scale: { type: "string", enum: SCALE },
        energy: { type: "integer", minimum: 0, maximum: 100 },
        swing: { type: "integer", minimum: 0, maximum: 60 },
        rumble: { type: "integer", minimum: 0, maximum: 100 },
        humanize: { type: "integer", minimum: 0, maximum: 100 }
      }
    },
    macros: {
      type: "object",
      additionalProperties: false,
      required: ["tension", "groove", "dirt", "space"],
      properties: {
        tension: { type: "number", minimum: 0, maximum: 1 },
        groove: { type: "number", minimum: 0, maximum: 1 },
        dirt: { type: "number", minimum: 0, maximum: 1 },
        space: { type: "number", minimum: 0, maximum: 1 }
      }
    },
    sections: {
      type: "array",
      minItems: 4,
      maxItems: 7,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "bars", "transition", "vocal", "hits"],
        properties: {
          name: { type: "string", minLength: 3, maxLength: 36 },
          bars: { type: "integer", minimum: 2, maximum: 16 },
          transition: { type: "string", enum: FX },
          vocal: { type: "boolean" },
          hits: {
            type: "object",
            additionalProperties: false,
            required: ["kick", "clap", "chat", "ohat", "bass", "stab", "mods"],
            properties: {
              kick: { type: "array", maxItems: 16, items: { type: "integer", minimum: 0, maximum: 15 } },
              clap: { type: "array", maxItems: 16, items: { type: "integer", minimum: 0, maximum: 15 } },
              chat: { type: "array", maxItems: 16, items: { type: "integer", minimum: 0, maximum: 15 } },
              ohat: { type: "array", maxItems: 16, items: { type: "integer", minimum: 0, maximum: 15 } },
              bass: {
                type: "array",
                maxItems: 16,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["step", "midi"],
                  properties: {
                    step: { type: "integer", minimum: 0, maximum: 15 },
                    midi: { type: "integer", minimum: 24, maximum: 72 }
                  }
                }
              },
              stab: {
                type: "array",
                maxItems: 12,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["step", "notes"],
                  properties: {
                    step: { type: "integer", minimum: 0, maximum: 15 },
                    notes: {
                      type: "array",
                      minItems: 2,
                      maxItems: 4,
                      items: { type: "integer", minimum: 36, maximum: 84 }
                    }
                  }
                }
              },
              mods: {
                type: "array",
                maxItems: 24,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["track", "step", "p", "r"],
                  properties: {
                    track: { type: "string", enum: TRACKS },
                    step: { type: "integer", minimum: 0, maximum: 15 },
                    p: { type: "number", minimum: 0.05, maximum: 1 },
                    r: { type: "integer", minimum: 1, maximum: 4 }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

function parseBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") return Promise.resolve(JSON.parse(req.body || "{}"));
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); } catch (err) { reject(err); }
    });
    req.on("error", reject);
  });
}

function systemPrompt() {
  return [
    "Eres un productor senior de techno y hard/afro techno dentro de TechnoForge.",
    "Devuelve solo JSON que cumpla el esquema. No expliques fuera del JSON.",
    "Crea material original: no copies melodias ni patrones exactos de artistas.",
    "Cada respuesta debe ser distinta a las firmas y huellas evitadas.",
    "Usa estructuras club reales: intro, build, drop, break, segundo drop/outro.",
    "Los arrays kick/clap/chat/ohat son pasos 0-15. Bass usa MIDI. Stab usa acordes MIDI.",
    "Para afro techno prioriza swing, percusion, call/response, bajos con síncopa y espacio.",
    "Para hard groove prioriza drive, rolling bass, hats de semicorchea y drops secos."
  ].join(" ");
}

function userPrompt(input) {
  const brief = String(input.brief || "").slice(0, 1000);
  const avoid = Array.isArray(input.avoid) ? input.avoid.slice(0, 12) : [];
  const current = input.current || {};
  const nonce = input.nonce || Date.now();
  return JSON.stringify({
    task: "Generate a fresh editable techno arrangement for TechnoForge.",
    brief,
    nonce,
    avoidSignatures: avoid,
    currentProject: current,
    noveltyRules: [
      "Do not reuse the same kick ghost steps, bass rhythm, chord hits, bars, or section names from avoidSignatures.",
      "Use a new signature string that summarizes the rhythmic DNA.",
      "Make the result playable and editable, not generic."
    ]
  });
}

function safeJson(content) {
  const text = String(content || "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
  return JSON.parse(text);
}

function optionalJson(text) {
  try { return text ? JSON.parse(text) : {}; } catch (err) { return {}; }
}

function publicOpenAIError(status, data) {
  const provider = data && data.error ? data.error : {};
  const detail = String(provider.message || data.message || "OpenAI request failed").slice(0, 260);
  const providerCode = String(provider.code || provider.type || "").slice(0, 80);
  const lower = `${detail} ${providerCode}`.toLowerCase();

  if (status === 401 || status === 403) {
    return {
      error: "openai_auth_failed",
      message: "OpenAI rechazó la clave configurada. Revisa OPENAI_API_KEY en Vercel.",
      detail,
      providerStatus: status,
      providerCode
    };
  }

  if (status === 429 && /(account is not active|billing|quota|credit|insufficient_quota|inactive)/.test(lower)) {
    return {
      error: "openai_account_inactive",
      message: "OpenAI rechazó la generación porque la cuenta/proyecto no tiene billing o créditos activos.",
      detail,
      providerStatus: status,
      providerCode
    };
  }

  if (status === 429) {
    return {
      error: "openai_rate_limited",
      message: "OpenAI está limitando temporalmente las generaciones. Inténtalo de nuevo en unos segundos.",
      detail,
      providerStatus: status,
      providerCode
    };
  }

  return {
    error: "openai_error",
    message: detail,
    providerStatus: status,
    providerCode
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    res.status(500).json({ error: "missing_openai_api_key" });
    return;
  }

  try {
    const input = await parseBody(req);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
    let response;

    try {
      response = await fetch(OPENAI_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.95,
          messages: [
            { role: "system", content: systemPrompt() },
            { role: "user", content: userPrompt(input) }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "technoforge_ai_track",
              strict: true,
              schema
            }
          }
        })
      });
    } finally {
      clearTimeout(timeout);
    }

    const data = optionalJson(await response.text());
    if (!response.ok) {
      res.status(response.status).json(publicOpenAIError(response.status, data));
      return;
    }

    const content = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : "";
    const plan = safeJson(content);
    res.status(200).json({ source: "openai", model: MODEL, plan });
  } catch (err) {
    if (err && err.name === "AbortError") {
      res.status(504).json({
        error: "openai_timeout",
        message: "OpenAI tardó demasiado en responder. La app puede seguir con el motor local."
      });
      return;
    }
    res.status(500).json({ error: "ai_producer_failed", message: err.message || "Unknown error" });
  }
};
