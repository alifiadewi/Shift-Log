import React, { useState, useRef } from "react";
import { Camera, Mic, Square, RotateCcw, CheckCircle2, Info } from "lucide-react";

const CATEGORIES = [
  { key: "workDone", label: "Work done this shift", placeholder: "What did you do or change?" },
  { key: "problem", label: "Problem encountered", placeholder: "What went wrong? (photo above is your proof)" },
  { key: "solution", label: "Fix applied", placeholder: "How did you fix it, if you did?" },
  { key: "followUp", label: "Follow-up for next shift", placeholder: "What should the next shift watch or continue?" },
];

const SHIFTS = ["Morning", "Afternoon", "Night"];

// PENDING
// Mic input sends raw audio to Google/Apple's speech service; AI cleanup sends text to Anthropic
const VOICE_INPUT_ENABLED = false;
const AI_CLEANUP_ENABLED = false;

const CLEANUP_ENDPOINT = "/api/cleanup";

export default function ShiftReportForm() {
  const [name, setName] = useState("");
  const [shift, setShift] = useState("Morning");
  const [photo, setPhoto] = useState(null);
  const [fields, setFields] = useState({ workDone: "", problem: "", solution: "", followUp: "" });
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
      setCleanupError("Couldn't Summarize");
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

  const canSubmit = name.trim() && photo && Object.values(fields).some((v) => v.trim());

  function handleSubmit() {
    if (!canSubmit) return;
    setSubmitted({ name, shift, photo, fields, submittedAt: new Date().toISOString() });
  }

  function handleNewReport() {
    setSubmitted(null);
    setName("");
    setPhoto(null);
    setFields({ workDone: "", problem: "", solution: "", followUp: "" });
    setCleanupError(null);
    setRawFields(null);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-600 mb-4">
            <CheckCircle2 size={22} />
            <span className="font-medium">Report ready</span>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            There's no server yet, so nothing was actually sent. This is exactly what would go to the
            backend once it exists.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 space-y-2 max-h-72 overflow-auto">
            <div><span className="text-slate-500">Name:</span> {submitted.name}</div>
            <div><span className="text-slate-500">Shift:</span> {submitted.shift}</div>
            <div><span className="text-slate-500">Time:</span> {submitted.submittedAt}</div>
            {CATEGORIES.map((c) => (
              <div key={c.key}>
                <span className="text-slate-500">{c.label}:</span>{" "}
                {submitted.fields[c.key] || <em className="text-slate-400">empty</em>}
              </div>
            ))}
          </div>
          {submitted.photo && (
            <img src={submitted.photo} alt="Report proof" className="w-full rounded-xl mt-3 border border-slate-200" />
          )}
          <button
            onClick={handleNewReport}
            className="w-full mt-4 bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-xl py-2.5 shadow-sm"
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
        <p className="text-xs text-slate-500 mb-4">Fill each section by typing or holding the mic. Edit anything before submitting.</p>

        {!VOICE_INPUT_ENABLED && (
          <div className="flex items-start gap-2 bg-white border border-slate-200 rounded-xl p-3 mb-4 text-xs text-slate-500 shadow-sm">
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>Voice input is temporarily off pending IT review — please type instead.</span>
          </div>
        )}
        {VOICE_INPUT_ENABLED && !speechSupported && (
          <div className="flex items-start gap-2 bg-white border border-slate-200 rounded-xl p-3 mb-4 text-xs text-slate-500 shadow-sm">
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>Voice input isn't supported in this browser — typing still works for every field.</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Your name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ahmad Fauzi"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500 shadow-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Shift</label>
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500 shadow-sm"
            >
              {SHIFTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs text-slate-500 mb-1 block">Photo proof</label>
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
              <img src={photo} alt="Captured proof" className="w-full rounded-xl border border-slate-200" />
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
              className="w-full flex flex-col items-center justify-center gap-2 border border-dashed border-slate-300 rounded-xl py-8 text-slate-500 hover:border-blue-500 hover:text-blue-600 bg-white shadow-sm"
            >
              <Camera size={22} />
              <span className="text-xs">Tap to capture photo</span>
            </button>
          )}
        </div>

        <div className="space-y-3 mb-6">
          {CATEGORIES.map((c) => (
            <div key={c.key} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-700">{c.label}</label>
                {speechSupported && (
                  <button
                    onClick={() => toggleRecording(c.key)}
                    className={
                      recordingKey === c.key
                        ? "flex items-center gap-1 bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-pulse"
                        : "flex items-center gap-1 bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full hover:bg-slate-200"
                    }
                  >
                    {recordingKey === c.key ? <Square size={12} /> : <Mic size={12} />}
                    {recordingKey === c.key ? "Stop" : "Record"}
                  </button>
                )}
              </div>
              <textarea
                value={fields[c.key]}
                onChange={(e) => updateField(c.key, e.target.value)}
                placeholder={c.placeholder}
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:border-blue-500 resize-none"
              />
            </div>
          ))}
        </div>

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
                  className="bg-white border border-slate-200 text-slate-500 text-sm px-4 rounded-xl shadow-sm"
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
              ? "w-full bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-xl py-3 mt-2 shadow-sm"
              : "w-full bg-slate-200 text-slate-400 font-medium rounded-xl py-3 cursor-not-allowed mt-2"
          }
        >
          Review report
        </button>
      </div>
    </div>
  );
}
