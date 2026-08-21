import React, { useState, useRef } from "react";
import { Camera, Mic, Square, RotateCcw, Check, CheckCircle2, Info } from "lucide-react";

// LIST DI SINI KALO MAU DITAMBAH/EDIT

const SHIFTS = ["Morning", "Afternoon", "Night"];

const MODULE_OPTIONS = [
  "Wembley (Module A)",
  "Wembley (Module B)",
  "Wembley (Module C)",
  "Wembley (Module D)",
  "Wembley (Module E)",
  "Wembley (Module F)",
  "Main Assy (Module 1)",
  "Main Assy (Module 2)",
  "Main Assy (Module 3)",
  "Main Assy (Module 4)",
];

// OTHER_CATEGORY STAY IN TEXT, LAINNYA DROPDOWN
const OTHER_CATEGORY = "Lainnya";
const CATEGORY_OPTIONS = [
  "Mechanical Jam",
  "Electrical/Power",
  "Software/HMI Error",
  "Material Defect",
  "Strange Noise/Smell",
  "PSC Reject",
  "Hotbar Reject",
  OTHER_CATEGORY,
];

const SEVERITY_OPTIONS = [
  { id: "line_stopped", label: "Line stopped" },
  { id: "slow", label: "Running slow / bottleneck" },
  { id: "cosmetic", label: "Cosmetic / running normally" },
];

const ACTION_OPTIONS = [
  "Cleared jammed material",
  "Power cycled / reset HMI",
  "Reloaded",
  "Resoldering",
  "No action taken",
];

// PENDING MICNYA CONNECT GOOGLE/APPLE'S SPEECH RECOG, LLM CONNECT ANTHROPIC
const VOICE_INPUT_ENABLED = false;
const AI_CLEANUP_ENABLED = false;

const CLEANUP_ENDPOINT = "/api/cleanup";

export default function ShiftReportForm() {
  const [name, setName] = useState("");
  const [shift, setShift] = useState("Morning");
  const [moduleLocation, setModuleLocation] = useState(""); // required
  const [category, setCategory] = useState(""); // required
  const [customCategory, setCustomCategory] = useState(""); // used for OTHER_CATEGORY
  const [severity, setSeverity] = useState(null); // required SEVERITY_OPTIONS
  const [hmiCode, setHmiCode] = useState("");
  const [actionsTaken, setActionsTaken] = useState([]); // array ACTION_OPTIONS
  const [actionOther, setActionOther] = useState("");
  const [photo, setPhoto] = useState(null);
  const [fields, setFields] = useState({ description: "" }); // kept as an object for AI cleanup
  const [recordingKey, setRecordingKey] = useState(null);
  const [submitted, setSubmitted] = useState(null);
  const [rawFields, setRawFields] = useState(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupError, setCleanupError] = useState(null);

  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  const speechSupported =
    VOICE_INPUT_ENABLED &&
    typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  function handlePhotoChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(file);
  }

  function updateField(key, value) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function toggleAction(action) {
    setActionsTaken((prev) =>
      prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]
    );
  }

  function toggleRecording(key) {
    if (!speechSupported) return;

    if (recordingKey === key) {
      recognitionRef.current && recognitionRef.current.stop();
      return;
    }
    if (recognitionRef.current) recognitionRef.current.stop();

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "id-ID";

    rec.onresult = (event) => {
      let chunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) chunk += event.results[i][0].transcript + " ";
      }
      if (chunk.trim()) {
        setFields((f) => ({ ...f, [key]: (f[key] ? f[key] + " " : "") + chunk.trim() }));
      }
    };
    rec.onend = () => setRecordingKey((k) => (k === key ? null : k));
    rec.onerror = () => setRecordingKey((k) => (k === key ? null : k));

    rec.start();
    recognitionRef.current = rec;
    setRecordingKey(key);
  }

  async function cleanUpWithAI() {
    const hasContent = Object.values(fields).some((v) => v.trim());
    if (!hasContent || isCleaning) return;
    setIsCleaning(true);
    setCleanupError(null);
    setRawFields(fields);
    try {
      const response = await fetch(CLEANUP_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!response.ok) throw new Error(`Cleanup endpoint returned ${response.status}`);
      const cleaned = await response.json();
      setFields((f) => ({ ...f, ...cleaned }));
    } catch (err) {
      console.error("Cleanup failed:", err);
      setCleanupError("Couldn't clean up right now — your original text is still here.");
    } finally {
      setIsCleaning(false);
    }
  }

  function undoCleanup() {
    if (rawFields) {
      setFields(rawFields);
      setRawFields(null);
    }
  }

  // REQUIRED-FIELD
  // ADD `&&` AJA KALAU MAU NAMBAH REQ
  const categoryFilled = category && (category !== OTHER_CATEGORY || customCategory.trim());
  const canSubmit = name.trim() && moduleLocation && categoryFilled && !!severity;

  function handleSubmit() {
    if (!canSubmit) return;
    setSubmitted({
      name,
      shift,
      moduleLocation,
      category: category === OTHER_CATEGORY ? customCategory.trim() : category,
      severity,
      hmiCode,
      actionsTaken,
      actionOther,
      photo,
      description: fields.description,
      submittedAt: new Date().toISOString(),
    });
  }

  function handleNewReport() {
    setSubmitted(null);
    setName("");
    setModuleLocation("");
    setCategory("");
    setCustomCategory("");
    setSeverity(null);
    setHmiCode("");
    setActionsTaken([]);
    setActionOther("");
    setPhoto(null);
    setFields({ description: "" });
    setCleanupError(null);
    setRawFields(null);
  }

  // PELABELAN SAMA KOLOM TEXT DAN MIC BUTTON
  function renderField(key, label, placeholder, hint) {
    return (
      <div className="mb-5">
        <label className="text-xs font-medium text-slate-700 mb-1 block">{label}</label>
        {hint && <p className="text-xs text-slate-400 mb-1.5">{hint}</p>}
        <div className="relative">
          <textarea
            value={fields[key]}
            onChange={(e) => updateField(key, e.target.value)}
            placeholder={placeholder}
            rows={2}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 pr-11 text-sm outline-none focus:border-blue-500 resize-none"
          />
          {speechSupported && (
            <button
              type="button"
              onClick={() => toggleRecording(key)}
              className={
                recordingKey === key
                  ? "absolute top-2 right-2 flex items-center justify-center w-7 h-7 rounded-full bg-red-500 text-white animate-pulse"
                  : "absolute top-2 right-2 flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
              }
            >
              {recordingKey === key ? <Square size={13} /> : <Mic size={13} />}
            </button>
          )}
        </div>
      </div>
    );
  }

  // RADIO-CARD PICKER, CUMA PILIH SATU
  // ID=STORED, LABEL=SHOWN
  function renderRadioOption(id, label, selected, onSelect) {
    return (
      <button
        key={id}
        type="button"
        onClick={() => onSelect(id)}
        className={
          selected
            ? "w-full flex items-center gap-3 border-2 border-blue-600 rounded-lg px-4 py-3 text-left bg-white"
            : "w-full flex items-center gap-3 border border-slate-300 rounded-lg px-4 py-3 text-left bg-white hover:border-slate-400"
        }
      >
        <span
          className={
            selected
              ? "flex items-center justify-center w-5 h-5 rounded-full border-2 border-blue-600 shrink-0"
              : "flex items-center justify-center w-5 h-5 rounded-full border-2 border-slate-300 shrink-0"
          }
        >
          {selected && <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
        </span>
        <span className={selected ? "text-sm font-medium text-slate-900" : "text-sm text-slate-600"}>
          {label}
        </span>
      </button>
    );
  }

  // CHECKBOX PICKER, MULTISELECT
  function renderCheckboxOption(label, checked, onToggle) {
    return (
      <button
        key={label}
        type="button"
        onClick={onToggle}
        className={
          checked
            ? "w-full flex items-center gap-3 border-2 border-blue-600 rounded-lg px-4 py-3 text-left bg-white"
            : "w-full flex items-center gap-3 border border-slate-300 rounded-lg px-4 py-3 text-left bg-white hover:border-slate-400"
        }
      >
        <span
          className={
            checked
              ? "flex items-center justify-center w-5 h-5 rounded-md border-2 border-blue-600 bg-blue-600 shrink-0"
              : "flex items-center justify-center w-5 h-5 rounded-md border-2 border-slate-300 shrink-0"
          }
        >
          {checked && <Check size={13} className="text-white" />}
        </span>
        <span className={checked ? "text-sm font-medium text-slate-900" : "text-sm text-slate-600"}>
          {label}
        </span>
      </button>
    );
  }

  if (submitted) {
    const severityLabel = SEVERITY_OPTIONS.find((o) => o.id === submitted.severity)?.label;
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-300 rounded-xl p-6">
          <div className="flex items-center gap-2 text-emerald-600 mb-4">
            <CheckCircle2 size={22} />
            <span className="font-medium">Report ready</span>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            There's no server yet, so nothing was actually sent. This is exactly what would go to the
            backend once it exists.
          </p>
          <div className="bg-slate-50 border border-slate-300 rounded-lg p-3 text-xs text-slate-700 space-y-2 max-h-72 overflow-auto">
            <div><span className="text-slate-500">Name:</span> {submitted.name}</div>
            <div><span className="text-slate-500">Shift:</span> {submitted.shift}</div>
            <div><span className="text-slate-500">Time:</span> {submitted.submittedAt}</div>
            <div><span className="text-slate-500">Location/Module:</span> {submitted.moduleLocation}</div>
            <div><span className="text-slate-500">Category:</span> {submitted.category}</div>
            <div><span className="text-slate-500">Severity:</span> {severityLabel}</div>
            <div>
              <span className="text-slate-500">HMI code:</span>{" "}
              {submitted.hmiCode || <em className="text-slate-400">none</em>}
            </div>
            <div>
              <span className="text-slate-500">Action taken:</span>{" "}
              {[...submitted.actionsTaken, submitted.actionOther].filter(Boolean).join(", ") || (
                <em className="text-slate-400">none logged</em>
              )}
            </div>
            <div>
              <span className="text-slate-500">Description:</span>{" "}
              {submitted.description || <em className="text-slate-400">empty</em>}
            </div>
          </div>
          {submitted.photo && (
            <img src={submitted.photo} alt="Report proof" className="w-full rounded-lg mt-3 border border-slate-300" />
          )}
          <button
            onClick={handleNewReport}
            className="w-full mt-4 bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-lg py-2.5"
          >
            Start a new report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-lg font-semibold mb-1">Shift Report</h1>
        <p className="text-xs text-slate-500 mb-4">Fill in what applies. Location, category, and severity are required.</p>

        {!VOICE_INPUT_ENABLED && (
          <div className="flex items-start gap-2 bg-white border border-slate-300 rounded-lg p-3 mb-4 text-xs text-slate-500">
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>Voice input is temporarily off, please type instead.</span>
          </div>
        )}
        {VOICE_INPUT_ENABLED && !speechSupported && (
          <div className="flex items-start gap-2 bg-white border border-slate-300 rounded-lg p-3 mb-4 text-xs text-slate-500">
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>Voice input isn't supported in this browser — typing still works for every field.</span>
          </div>
        )}

        {/* Name + Shift */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Your name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ahmad Fauzi"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Shift</label>
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            >
              {SHIFTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Location / Module is required */}
        <div className="mb-5">
          <label className="text-xs text-slate-500 mb-1 block">Location / Module *</label>
          <select
            value={moduleLocation}
            onChange={(e) => setModuleLocation(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"
          >
            <option value="" disabled>Select location / module</option>
            {MODULE_OPTIONS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Issue category is required */}
        <div className="mb-5">
          <label className="text-xs text-slate-500 mb-1 block">Issue category *</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"
          >
            <option value="" disabled>Select category</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {category === OTHER_CATEGORY && (
            <input
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="Type the issue category"
              className="w-full mt-2 bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          )}
        </div>

        {/* Severity / line impact is required */}
        <div className="mb-5">
          <label className="text-xs font-medium text-slate-700 block mb-1.5">Severity / line impact *</label>
          <div className="flex flex-col gap-2">
            {SEVERITY_OPTIONS.map((opt) =>
              renderRadioOption(opt.id, opt.label, severity === opt.id, setSeverity)
            )}
          </div>
        </div>

        {/* HMI error code — optional */}
        <div className="mb-5">
          <label className="text-xs text-slate-500 mb-1 block">HMI error code (if shown)</label>
          <input
            value={hmiCode}
            onChange={(e) => setHmiCode(e.target.value)}
            placeholder="e.g. E204 (leave blank if none shown)"
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"
          />
        </div>

        {/* Action taken is optional, multi-select + free text */}
        <div className="mb-5">
          <label className="text-xs font-medium text-slate-700 block mb-1.5">Action taken</label>
          <div className="flex flex-col gap-2">
            {ACTION_OPTIONS.map((a) =>
              renderCheckboxOption(a, actionsTaken.includes(a), () => toggleAction(a))
            )}
          </div>
          <input
            value={actionOther}
            onChange={(e) => setActionOther(e.target.value)}
            placeholder="Other action (optional)"
            className="w-full mt-2 bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"
          />
        </div>

        {/* Visual proof is optional */}
        <div className="mb-5">
          <label className="text-xs text-slate-500 mb-1 block">Visual proof</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            className="hidden"
          />
          {photo ? (
            <div className="relative">
              <img src={photo} alt="Captured proof" className="w-full rounded-lg border border-slate-300" />
              <button
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                className="absolute bottom-2 right-2 bg-zinc-950/80 border border-zinc-700 rounded-full p-2 text-white"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              className="w-full flex flex-col items-center justify-center gap-2 border border-dashed border-slate-400 rounded-lg py-8 text-slate-500 hover:border-blue-500 hover:text-blue-600 bg-white"
            >
              <Camera size={22} />
              <span className="text-xs">Tap to capture photo</span>
            </button>
          )}
        </div>

        {/* Brief description is optional */}
        {renderField(
          "description",
          "Brief description",
          "Anything else worth noting?",
          "Keep it short what the fields above didn't cover."
        )}

        {AI_CLEANUP_ENABLED && (
          <>
            <div className="flex gap-2 mb-1">
              <button
                onClick={cleanUpWithAI}
                disabled={isCleaning || !Object.values(fields).some((v) => v.trim())}
                className="flex-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-900 text-sm font-medium rounded-lg py-2.5"
              >
                {isCleaning ? "Cleaning up..." : "Clean up with AI"}
              </button>
              {rawFields && (
                <button
                  onClick={undoCleanup}
                  className="bg-white border border-slate-300 text-slate-500 text-sm px-4 rounded-lg"
                >
                  Undo
                </button>
              )}
            </div>
            {cleanupError && (
              <p className="text-xs text-red-600 mb-2">{cleanupError}</p>
            )}
          </>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={
            canSubmit
              ? "w-full bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-lg py-3 mt-2"
              : "w-full bg-slate-200 text-slate-400 font-medium rounded-lg py-3 cursor-not-allowed mt-2"
          }
        >
          Review report
        </button>
      </div>
    </div>
  );
}