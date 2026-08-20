import React, { useState, useRef } from "react";
import { Camera, Mic, Square, RotateCcw, CheckCircle2, Info } from "lucide-react";

const SHIFTS = ["Morning", "Afternoon", "Night"];

const FIX_STATUS_OPTIONS = [
  { id: "not_fixed", label: "Not fixed" },
  { id: "maintenance", label: "Under maintenance" },
  { id: "fixed", label: "Fixed" },
];

// PENDING
// Mic input sends raw audio to Google/Apple's speech service; AI cleanup sends text to Anthropic.
const VOICE_INPUT_ENABLED = false;
const AI_CLEANUP_ENABLED = false;

const CLEANUP_ENDPOINT = "/api/cleanup";

export default function ShiftReportForm() {
  const [name, setName] = useState("");
  const [shift, setShift] = useState("Morning");
  const [fields, setFields] = useState({ workDone: "", problem: "", solution: "", followUp: "" });
  const [hasProblem, setHasProblem] = useState(null); // null | true | false
  const [fixStatus, setFixStatus] = useState(null); // null | "not_fixed" | "maintenance" | "fixed"
  const [photo, setPhoto] = useState(null);
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

  function handleSetHasProblem(value) {
    setHasProblem(value);
    if (!value) {
      setFixStatus(null);
      setPhoto(null);
      setFields((f) => ({ ...f, problem: "", solution: "" }));
    }
  }

  const problemStepOk =
    hasProblem === false ||
    (hasProblem === true &&
      fields.problem.trim() &&
      !!photo &&
      fixStatus !== null &&
      (fixStatus !== "fixed" || fields.solution.trim()));

  const canSubmit =
    name.trim() &&
    fields.workDone.trim() &&
    hasProblem !== null &&
    problemStepOk &&
    fields.followUp.trim();

  function handleSubmit() {
    if (!canSubmit) return;
    setSubmitted({ name, shift, photo, fields, hasProblem, fixStatus, submittedAt: new Date().toISOString() });
  }

  function handleNewReport() {
    setSubmitted(null);
    setName("");
    setPhoto(null);
    setFields({ workDone: "", problem: "", solution: "", followUp: "" });
    setHasProblem(null);
    setFixStatus(null);
    setCleanupError(null);
    setRawFields(null);
  }

  function renderField(key, label, placeholder) {
    return (
      <div className="mb-5">
        <label className="text-xs font-medium text-slate-700 mb-1.5 block">{label}</label>
        <div className="relative">
          <textarea
            value={fields[key]}
            onChange={(e) => updateField(key, e.target.value)}
            placeholder={placeholder}
            rows={2}
            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 pr-11 text-sm outline-none focus:border-blue-500 resize-none"
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

  // Yes/No pair for "was there a problem"
  function renderYesNo(selected, onSelect) {
    return (
      <div className="flex gap-2 mt-1.5">
        <button
          type="button"
          onClick={() => onSelect(true)}
          className={
            selected === true
              ? "flex-1 border-2 border-blue-600 bg-blue-50 text-blue-700 text-sm font-medium rounded-xl py-2"
              : "flex-1 border border-slate-300 text-slate-600 text-sm font-medium rounded-xl py-2 hover:border-slate-400"
          }
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onSelect(false)}
          className={
            selected === false
              ? "flex-1 border-2 border-blue-600 bg-blue-50 text-blue-700 text-sm font-medium rounded-xl py-2"
              : "flex-1 border border-slate-300 text-slate-600 text-sm font-medium rounded-xl py-2 hover:border-slate-400"
          }
        >
          No
        </button>
      </div>
    );
  }

  function renderRadioOption(id, label, selected, onSelect) {
    return (
      <button
        key={id}
        type="button"
        onClick={() => onSelect(id)}
        className={
          selected
            ? "w-full flex items-center gap-3 border-2 border-blue-600 rounded-xl px-4 py-3 text-left bg-white"
            : "w-full flex items-center gap-3 border border-slate-300 rounded-xl px-4 py-3 text-left bg-white hover:border-slate-400"
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

  if (submitted) {
    const statusLabel = FIX_STATUS_OPTIONS.find((o) => o.id === submitted.fixStatus)?.label;
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-300 rounded-2xl p-6">
          <div className="flex items-center gap-2 text-emerald-600 mb-4">
            <CheckCircle2 size={22} />
            <span className="font-medium">Report ready</span>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            There's no server yet.
          </p>
          <div className="bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-700 space-y-2 max-h-72 overflow-auto">
            <div><span className="text-slate-500">Name:</span> {submitted.name}</div>
            <div><span className="text-slate-500">Shift:</span> {submitted.shift}</div>
            <div><span className="text-slate-500">Time:</span> {submitted.submittedAt}</div>
            <div><span className="text-slate-500">Work done:</span> {submitted.fields.workDone}</div>
            <div>
              <span className="text-slate-500">Problem:</span>{" "}
              {submitted.hasProblem ? submitted.fields.problem : <em className="text-slate-400">None reported</em>}
            </div>
            {submitted.hasProblem && (
              <>
                <div>
                  <span className="text-slate-500">Fix applied:</span>{" "}
                  {submitted.fields.solution || <em className="text-slate-400">None entered</em>}
                </div>
                <div><span className="text-slate-500">Status:</span> {statusLabel}</div>
              </>
            )}
            <div><span className="text-slate-500">Follow-up:</span> {submitted.fields.followUp}</div>
          </div>
          {submitted.photo && (
            <img src={submitted.photo} alt="Report proof" className="w-full rounded-xl mt-3 border border-slate-300" />
          )}
          <button
            onClick={handleNewReport}
            className="w-full mt-4 bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-xl py-2.5"
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
        <p className="text-xs text-slate-500 mb-4">Answer each step. You can edit before submitting.</p>

        {!VOICE_INPUT_ENABLED && (
          <div className="flex items-start gap-2 bg-white border border-slate-300 rounded-xl p-3 mb-4 text-xs text-slate-500">
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>Voice input is temporarily off, please type instead.</span>
          </div>
        )}
        {VOICE_INPUT_ENABLED && !speechSupported && (
          <div className="flex items-start gap-2 bg-white border border-slate-300 rounded-xl p-3 mb-4 text-xs text-slate-500">
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
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Shift</label>
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            >
              {SHIFTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Step 1: what did you do */}
        {renderField("workDone", "What did you do this shift?", "What did you do or change?")}

        {/* Step 2: was there a problem */}
        <div className="mb-5">
          <label className="text-xs font-medium text-slate-700 block">Was there a problem?</label>
          {renderYesNo(hasProblem, handleSetHasProblem)}
        </div>

        {hasProblem === true && (
          <>
            {renderField("problem", "Describe the problem", "What went wrong?")}

            <div className="mb-5">
              <label className="text-xs text-slate-500 mb-1 block">Photo evidence</label>
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
                  <img src={photo} alt="Captured proof" className="w-full rounded-xl border border-slate-300" />
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
                  className="w-full flex flex-col items-center justify-center gap-2 border border-dashed border-slate-400 rounded-xl py-8 text-slate-500 hover:border-blue-500 hover:text-blue-600 bg-white"
                >
                  <Camera size={22} />
                  <span className="text-xs">Tap to capture photo</span>
                </button>
              )}
            </div>

            {renderField("solution", "Fix applied", "What did you do about it, if anything?")}

            {/* Step 3: current status */}
            <div className="mb-5">
              <label className="text-xs font-medium text-slate-700 block mb-1.5">Is it fixed?</label>
              <div className="flex flex-col gap-2">
                {FIX_STATUS_OPTIONS.map((opt) =>
                  renderRadioOption(opt.id, opt.label, fixStatus === opt.id, setFixStatus)
                )}
              </div>
            </div>
          </>
        )}

        {/* Final step: always asked, regardless of the path above */}
        {renderField("followUp", "Follow-up for next shift", "What should the next shift watch or continue?")}

        {AI_CLEANUP_ENABLED && (
          <>
            <div className="flex gap-2 mb-1">
              <button
                onClick={cleanUpWithAI}
                disabled={isCleaning || !Object.values(fields).some((v) => v.trim())}
                className="flex-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-900 text-sm font-medium rounded-xl py-2.5"
              >
                {isCleaning ? "Cleaning up..." : "Clean up with AI"}
              </button>
              {rawFields && (
                <button
                  onClick={undoCleanup}
                  className="bg-white border border-slate-300 text-slate-500 text-sm px-4 rounded-xl"
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
              ? "w-full bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-xl py-3 mt-2"
              : "w-full bg-slate-200 text-slate-400 font-medium rounded-xl py-3 cursor-not-allowed mt-2"
          }
        >
          Review report
        </button>
      </div>
    </div>
  );
}