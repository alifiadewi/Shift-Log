import React, { useState, useRef } from "react";
import { Camera, Mic, Square, RotateCcw, CheckCircle2, Info } from "lucide-react";

const CATEGORIES = [
  { key: "workDone", label: "Pekerjaan yang telah dilakukan", placeholder: "Apa yang Anda kerjakan?" },
  { key: "problem", label: "Temuan masalah", placeholder: "Jelaskan permasalahannya? (foto di atas merupakan bukti masalah)" },
  { key: "solution", label: "Perbaikan yang dilakukan", placeholder: "Apa yang telah dilakukan untuk meemperbaikinya?" },
  { key: "followUp", label: "Catatan untuk shift berikutnya", placeholder: "Apa yang harus diperhatikan oleh shift berikutnya?" },
];

const SHIFTS = ["Pagi", "Siang", "Malam"];

// PENDING
// Mic input sends raw audio to Google/Apple's speech service; AI cleanup sends text to Anthropic
const VOICE_INPUT_ENABLED = false;
const AI_CLEANUP_ENABLED = false;

const CLEANUP_ENDPOINT = "/api/cleanup";

export default function ShiftReportForm() {
  const [name, setName] = useState("");
  const [shift, setShift] = useState("Pagi");
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
      <div className="min-h-screen bg-blue-50 text-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-2 text-emerald-400 mb-4">
            <CheckCircle2 size={22} />
            <span className="font-medium">Report ready</span>
          </div>
          <p className="text-sm text-zinc-400 mb-4">
            There's no server yet, so nothing was actually sent. This is exactly what would go to the
            backend once it exists.
          </p>
          <div className="bg-blue-50 border border-slate-200 rounded-lg p-3 text-xs text-zinc-300 space-y-2 max-h-72 overflow-auto">
            <div><span className="text-slate-500">Name:</span> {submitted.name}</div>
            <div><span className="text-slate-500">Shift:</span> {submitted.shift}</div>
            <div><span className="text-slate-500">Time:</span> {submitted.submittedAt}</div>
            {CATEGORIES.map((c) => (
              <div key={c.key}>
                <span className="text-slate-500">{c.label}:</span>{" "}
                {submitted.fields[c.key] || <em className="text-zinc-600">empty</em>}
              </div>
            ))}
          </div>
          {submitted.photo && (
            <img src={submitted.photo} alt="Report proof" className="w-full rounded-lg mt-3 border border-slate-200" />
          )}
          <button
            onClick={handleNewReport}
            className="w-full mt-4 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-medium rounded-lg py-2.5"
          >
            Start a new report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 text-slate-900 p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-lg font-semibold mb-1">Shift Report</h1>
        <p className="text-xs text-slate-500 mb-4">Fill each section by typing or holding the mic. Edit anything before submitting.</p>

        {!VOICE_INPUT_ENABLED && (
          <div className="flex items-start gap-2 bg-white border border-slate-200 rounded-lg p-3 mb-4 text-xs text-zinc-400">
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>Voice input is temporarily off, please type instead.</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Your name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ahmad Fauzi"
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Shift</label>
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-500"
            >
              {SHIFTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs text-zinc-500 mb-1 block">Photo proof</label>
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
              <img src={photo} alt="Captured proof" className="w-full rounded-lg border border-slate-200" />
              <button
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                className="absolute bottom-2 right-2 bg-blue-50/80 border border-slate-200 rounded-full p-2"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              className="w-full flex flex-col items-center justify-center gap-2 border border-dashed border-slate-200 rounded-lg py-8 text-zinc-500 hover:border-amber-500 hover:text-amber-500"
            >
              <Camera size={22} />
              <span className="text-xs">Tap to capture photo</span>
            </button>
          )}
        </div>

        <div className="space-y-3 mb-6">
          {CATEGORIES.map((c) => (
            <div key={c.key} className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-300">{c.label}</label>
                {speechSupported && (
                  <button
                    onClick={() => toggleRecording(c.key)}
                    className={
                      recordingKey === c.key
                        ? "flex items-center gap-1 bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-pulse"
                        : "flex items-center gap-1 bg-zinc-800 text-zinc-300 text-xs px-2 py-1 rounded-full hover:bg-zinc-700"
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
                className="w-full bg-blue-50 border border-slate-200 rounded-md px-2.5 py-2 text-sm outline-none focus:border-amber-500 resize-none"
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
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-900 text-sm font-medium rounded-lg py-2.5"
              >
                {isCleaning ? "Memproses..." : "Clean up"}
              </button>
              {rawFields && (
                <button onClick={undoCleanup} className="bg-white border border-slate-200 text-zinc-400 text-sm px-4 rounded-lg">
                  Undo
                </button>
              )}
            </div>
            {cleanupError && <p className="text-xs text-amber-500 mb-2">{cleanupError}</p>}
          </>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={
            canSubmit
              ? "w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-medium rounded-lg py-3 mt-2"
              : "w-full bg-zinc-800 text-slate-500 font-medium rounded-lg py-3 cursor-not-allowed mt-2"
          }
        >
          Review report
        </button>
      </div>
    </div>
  );
}
