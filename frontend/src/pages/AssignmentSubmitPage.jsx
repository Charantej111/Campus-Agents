import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Upload, Clock, CheckCircle, AlertCircle, FileText, Layers, Sparkles, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const AssignmentSubmitPage = () => {
  const { assignmentId } = useParams();
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [rollNumber, setRollNumber] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    fetchAssignment();
  }, [assignmentId]);

  const fetchAssignment = async () => {
    try {
      const res = await axios.get(`${API_URL}/submit/${assignmentId}/info`);
      setAssignment(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Assignment not found.");
    } finally {
      setLoading(false);
    }
  };

  const deadlineInfo = useMemo(() => {
    if (!assignment?.deadline) return { passed: false, text: "", urgency: "" };
    try {
      const deadline = new Date(assignment.deadline);
      const now = new Date();
      const diff = deadline - now;
      const passed = diff < 0;

      if (passed) return { passed: true, text: "Deadline has passed", urgency: "expired" };

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      let text = "";
      if (days > 0) text = `${days}d ${hours}h remaining`;
      else if (hours > 0) text = `${hours}h ${minutes}m remaining`;
      else text = `${minutes}m remaining`;

      let urgency = "safe";
      if (days === 0 && hours < 6) urgency = "critical";
      else if (days <= 1) urgency = "warning";

      return { passed, text, urgency };
    } catch {
      return { passed: false, text: "", urgency: "" };
    }
  }, [assignment]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rollNumber.trim() || !file) return;

    setSubmitting(true);
    setSubmitError(null);
    setSubmitResult(null);

    try {
      const formData = new FormData();
      formData.append("roll_number", rollNumber.trim());
      formData.append("file", file);

      const res = await axios.post(`${API_URL}/submit/${assignmentId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSubmitResult(res.data);
    } catch (err) {
      setSubmitError(err.response?.data?.detail || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0a0a0f 0%, #1a0a1f 50%, #0a0a0f 100%)" }}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          <span className="text-white/60 text-sm font-medium">Loading assignment...</span>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0a0a0f 0%, #1a0a1f 50%, #0a0a0f 100%)" }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Assignment Not Found</h2>
          <p className="text-white/50 text-sm">{error}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #0a0a0f 0%, #1a0a1f 50%, #0a0a0f 100%)", fontFamily: "'DM Sans', sans-serif" }}>
      {/* Background effects */}
      <div style={{ position: "fixed", inset: 0, backgroundImage: "radial-gradient(circle at 20% 50%, rgba(99, 102, 241, 0.08) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.08) 0%, transparent 50%)", pointerEvents: "none", zIndex: 0 }} />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-10">
          <div className="p-2.5 rounded-xl" style={{ background: "linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))" }}>
            <Layers className="w-5 h-5 text-indigo-400" />
          </div>
          <span className="font-bold text-lg text-white tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>Campus Agents</span>
        </motion.div>

        {/* Assignment Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl p-8 mb-8"
          style={{
            background: "rgba(22, 22, 29, 0.6)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-medium text-indigo-400 uppercase tracking-wider mb-2">{assignment.subject_name}</p>
              <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: "'Syne', sans-serif" }}>{assignment.title}</h1>
              {(assignment.section || assignment.batch) && (
                <p className="text-sm text-white/40 mt-1">
                  {assignment.section && `Section: ${assignment.section}`}
                  {assignment.section && assignment.batch && " · "}
                  {assignment.batch && `Batch: ${assignment.batch}`}
                </p>
              )}
            </div>
          </div>

          {assignment.description && (
            <p className="text-white/60 text-sm leading-relaxed mb-6">{assignment.description}</p>
          )}

          {/* Deadline Badge */}
          <div
            className="flex items-center gap-3 p-4 rounded-xl"
            style={{
              background: deadlineInfo.urgency === "critical" ? "rgba(239, 68, 68, 0.1)" :
                deadlineInfo.urgency === "warning" ? "rgba(245, 158, 11, 0.1)" :
                deadlineInfo.passed ? "rgba(239, 68, 68, 0.15)" :
                "rgba(99, 102, 241, 0.1)",
              border: `1px solid ${deadlineInfo.urgency === "critical" ? "rgba(239, 68, 68, 0.2)" :
                deadlineInfo.urgency === "warning" ? "rgba(245, 158, 11, 0.2)" :
                deadlineInfo.passed ? "rgba(239, 68, 68, 0.25)" :
                "rgba(99, 102, 241, 0.15)"}`,
            }}
          >
            <Clock className={`w-5 h-5 ${deadlineInfo.passed ? "text-red-400" : deadlineInfo.urgency === "critical" ? "text-red-400" : deadlineInfo.urgency === "warning" ? "text-amber-400" : "text-indigo-400"}`} />
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-0.5">Deadline</p>
              <p className={`text-sm font-semibold ${deadlineInfo.passed ? "text-red-400" : "text-white"}`}>
                {new Date(assignment.deadline).toLocaleString()}
              </p>
              {deadlineInfo.text && (
                <p className={`text-xs mt-0.5 ${deadlineInfo.urgency === "critical" ? "text-red-400" : deadlineInfo.urgency === "warning" ? "text-amber-400" : deadlineInfo.passed ? "text-red-400" : "text-indigo-400"}`}>
                  {deadlineInfo.text}
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Result or Form */}
        <AnimatePresence mode="wait">
          {submitResult ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl p-8 text-center"
              style={{
                background: "rgba(22, 22, 29, 0.6)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(34, 197, 94, 0.2)",
              }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(34, 197, 94, 0.15)" }}
              >
                <CheckCircle className="w-8 h-8 text-green-400" />
              </motion.div>
              <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "'Syne', sans-serif" }}>Submitted Successfully!</h2>
              <p className="text-white/50 text-sm">{submitResult.message}</p>
              {submitResult.is_late && (
                <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <AlertCircle className="w-3 h-3" /> Late Submission
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl p-8"
              style={{
                background: "rgba(22, 22, 29, 0.6)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <h2 className="text-lg font-bold text-white mb-6" style={{ fontFamily: "'Syne', sans-serif" }}>
                <FileText className="w-5 h-5 inline-block mr-2 text-indigo-400" />
                Submit Your Assignment
              </h2>

              {submitError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 rounded-xl text-sm flex items-start gap-3"
                  style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)" }}
                >
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <span className="text-red-300">{submitError}</span>
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-2">Roll Number *</label>
                  <input
                    type="text"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    className="w-full rounded-xl px-4 py-3.5 text-white text-sm font-medium placeholder-white/20 outline-none transition-all focus:ring-2 focus:ring-indigo-500/50"
                    style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}
                    placeholder="Enter your roll number"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-2">Upload Assignment *</label>
                  <div
                    className="relative rounded-xl p-6 text-center cursor-pointer transition-all hover:border-indigo-500/40"
                    style={{
                      background: "rgba(0,0,0,0.3)",
                      border: file ? "2px solid rgba(99, 102, 241, 0.4)" : "2px dashed rgba(255,255,255,0.1)",
                    }}
                    onClick={() => document.getElementById("file-input").click()}
                  >
                    <input
                      id="file-input"
                      type="file"
                      className="hidden"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      required
                    />
                    {file ? (
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-500/15 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium text-white">{file.name}</p>
                          <p className="text-xs text-white/40">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-white/20 mx-auto mb-3" />
                        <p className="text-sm text-white/40">Click to upload your file</p>
                        <p className="text-xs text-white/20 mt-1">PDF, DOCX, ZIP, or any format</p>
                      </>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !rollNumber.trim() || !file}
                  className="w-full py-4 rounded-xl text-white font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{
                    background: submitting || !rollNumber.trim() || !file ? "rgba(99, 102, 241, 0.3)" : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                    boxShadow: submitting || !rollNumber.trim() || !file ? "none" : "0 4px 20px rgba(99, 102, 241, 0.3)",
                  }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Submit Assignment
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="mt-12 text-center text-xs text-white/20 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3 h-3" />
          <span>Powered by Campus Agents</span>
        </div>
      </div>
    </div>
  );
};

export default AssignmentSubmitPage;
