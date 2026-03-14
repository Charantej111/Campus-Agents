import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  Plus,
  ArrowLeft,
  FileText,
  Upload,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  Trash2,
  Download,
  ChevronRight,
  BarChart3,
  Eye,
  Copy,
  ExternalLink,
  Loader2,
  X,
  Calendar,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const AssignmentManager = () => {
  const { workspace } = useAuth();
  const toast = useToast();

  const [view, setView] = useState("list"); // list | create | detail
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (workspace) fetchAssignments();
  }, [workspace]);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(
        `${API_URL}/workspaces/${workspace.id}/assignments`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setAssignments(res.data);
    } catch (err) {
      console.error("Failed to fetch assignments", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (id) => {
    setDetailLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(
        `${API_URL}/workspaces/${workspace.id}/assignments/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setSelectedAssignment(res.data);
      setView("detail");
    } catch (err) {
      toast?.showToast?.("Failed to load assignment details", "error");
    } finally {
      setDetailLoading(false);
    }
  };

  const deleteAssignment = async (id) => {
    if (
      !confirm(
        "Are you sure you want to delete this assignment and all its submissions?",
      )
    )
      return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(
        `${API_URL}/workspaces/${workspace.id}/assignments/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      toast?.showToast?.("Assignment deleted", "success");
      fetchAssignments();
      if (view === "detail") setView("list");
    } catch (err) {
      toast?.showToast?.("Failed to delete assignment", "error");
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <AnimatePresence mode="wait">
        {view === "list" && (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <AssignmentList
              assignments={assignments}
              loading={loading}
              onRefresh={fetchAssignments}
              onCreate={() => setView("create")}
              onSelect={fetchDetail}
              onDelete={deleteAssignment}
              detailLoading={detailLoading}
            />
          </motion.div>
        )}
        {view === "create" && (
          <motion.div
            key="create"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <CreateAssignment
              workspaceId={workspace.id}
              onBack={() => setView("list")}
              onCreated={() => {
                setView("list");
                fetchAssignments();
              }}
              toast={toast}
            />
          </motion.div>
        )}
        {view === "detail" && selectedAssignment && (
          <motion.div
            key="detail"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <AssignmentDetail
              assignment={selectedAssignment}
              workspaceId={workspace.id}
              onBack={() => {
                setView("list");
                setSelectedAssignment(null);
                fetchAssignments();
              }}
              onDelete={() => deleteAssignment(selectedAssignment.id)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ──────────────────── ASSIGNMENT LIST ────────────────────

const AssignmentList = ({
  assignments,
  loading,
  onRefresh,
  onCreate,
  onSelect,
  onDelete,
  detailLoading,
}) => {
  const getDeadlineStatus = (deadline) => {
    try {
      const d = new Date(deadline);
      const now = new Date();
      const diff = d - now;
      if (diff < 0)
        return {
          label: "Expired",
          color: "text-red-400",
          bgColor: "bg-red-500/10",
          borderColor: "border-red-500/20",
        };
      if (diff < 24 * 60 * 60 * 1000)
        return {
          label: "Due Soon",
          color: "text-amber-400",
          bgColor: "bg-amber-500/10",
          borderColor: "border-amber-500/20",
        };
      return {
        label: "Active",
        color: "text-emerald-400",
        bgColor: "bg-emerald-500/10",
        borderColor: "border-emerald-500/20",
      };
    } catch {
      return {
        label: "Active",
        color: "text-emerald-400",
        bgColor: "bg-emerald-500/10",
        borderColor: "border-emerald-500/20",
      };
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2
            className="text-2xl font-bold text-white"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            Assignments
          </h2>
          <p className="text-white/40 text-sm mt-1">
            {assignments.length} total assignments
          </p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-indigo-900/30"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
        >
          <Plus className="w-4 h-4" /> New Assignment
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
        </div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
            <FileText className="w-7 h-7 text-white/20" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">
            No assignments yet
          </h3>
          <p className="text-white/40 text-sm mb-6">
            Create your first assignment to get started.
          </p>
          <button
            onClick={onCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            <Plus className="w-4 h-4" /> Create Assignment
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {assignments.map((a, i) => {
            const status = getDeadlineStatus(a.deadline);
            const progress =
              a.total_students > 0
                ? Math.round((a.submitted_count / a.total_students) * 100)
                : 0;
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl p-5 cursor-pointer transition-all hover:border-indigo-500/30 group"
                style={{
                  background: "rgba(22, 22, 29, 0.6)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                onClick={() => onSelect(a.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-base font-bold text-white truncate">
                        {a.title}
                      </h3>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${status.bgColor} ${status.color} ${status.borderColor}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-white/40">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" /> {a.subject_name}
                      </span>
                      {a.section && <span>Section: {a.section}</span>}
                      {a.batch && <span>Batch: {a.batch}</span>}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />{" "}
                        {new Date(a.deadline).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold text-white">
                        {a.submitted_count}
                        <span className="text-white/30 text-sm">
                          /{a.total_students}
                        </span>
                      </p>
                      <p className="text-[10px] text-white/30 uppercase tracking-wider">
                        Submitted
                      </p>
                    </div>
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{
                        background: `conic-gradient(#6366f1 ${progress}%, rgba(255,255,255,0.05) 0%)`,
                      }}
                    >
                      <div className="w-9 h-9 rounded-lg bg-[#16161d] flex items-center justify-center">
                        <span className="text-xs font-bold text-white">
                          {progress}%
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(a.id);
                      }}
                      className="p-2 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.8, delay: i * 0.05 + 0.3 }}
                    className="h-full rounded-full"
                    style={{
                      background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
                    }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ──────────────────── CREATE ASSIGNMENT ────────────────────

const CreateAssignment = ({ workspaceId, onBack, onCreated, toast }) => {
  const [form, setForm] = useState({
    title: "",
    description: "",
    subject_name: "",
    section: "",
    batch: "",
    program_id: "",
    semester: "",
    deadline: "",
  });
  const [programs, setPrograms] = useState([]);
  const [matchedStudents, setMatchedStudents] = useState([]);
  const [checkingStudents, setCheckingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetchPrograms();
  }, [workspaceId]);

  // Fetch student count when filters change
  useEffect(() => {
    const fetchFilteredStudents = async () => {
      setCheckingStudents(true);
      try {
        const token = localStorage.getItem("token");
        const params = {};
        if (form.batch) params.batch_year = form.batch;
        if (form.program_id) params.program_id = form.program_id;
        if (form.semester) params.semester = form.semester;

        const res = await axios.get(
          `${API_URL}/workspaces/${workspaceId}/students/filter`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params,
          },
        );
        setMatchedStudents(res.data);
      } catch (err) {
        console.error("Failed to fetch filtered students", err);
      } finally {
        setCheckingStudents(false);
      }
    };

    fetchFilteredStudents();
  }, [workspaceId, form.batch, form.program_id, form.semester]);

  const fetchPrograms = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(
        `${API_URL}/workspaces/${workspaceId}/programs`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setPrograms(res.data);
    } catch (err) {
      console.error("Failed to fetch programs", err);
    }
  };

  const handleChange = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (matchedStudents.length === 0) {
      toast?.showToast?.(
        "No students match the selected filters. Cannot assign.",
        "error",
      );
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem("token");

      const payload = {
        title: form.title,
        description: form.description,
        subject_name: form.subject_name,
        section: form.section,
        batch: form.batch,
        deadline: form.deadline,
        students: matchedStudents.map((s) => ({
          roll_number: s.roll_number || s.id || "",
          name: s.name || "",
          email: s.email || "",
        })),
      };

      const res = await axios.post(
        `${API_URL}/workspaces/${workspaceId}/assignments`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      setResult(res.data);
      toast?.showToast?.("Assignment created successfully!", "success");
    } catch (err) {
      toast?.showToast?.(
        err.response?.data?.detail || "Failed to create assignment",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div>
        <button
          onClick={onCreated}
          className="flex items-center gap-2 text-sm text-white/50 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Assignments
        </button>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg mx-auto rounded-2xl p-8 text-center"
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
            className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-green-500/15"
          >
            <CheckCircle className="w-8 h-8 text-green-400" />
          </motion.div>
          <h2
            className="text-xl font-bold text-white mb-2"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            Assignment Created!
          </h2>
          <p className="text-white/50 text-sm mb-6">{result.message}</p>

          <div
            className="rounded-xl p-4 text-left mb-4"
            style={{
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <p className="text-xs text-white/30 uppercase tracking-wider mb-2">
              Submission Link
            </p>
            <div className="flex items-center gap-2">
              <code className="text-xs text-indigo-300 flex-1 truncate">
                {result.submission_link}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(result.submission_link);
                  toast?.showToast?.("Link copied!", "success");
                }}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <a
                href={result.submission_link}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Generate dynamic batch years from 2020 to Next Year
  const currentYear = new Date().getFullYear();
  const batchYears = Array.from({ length: 8 }, (_, i) => currentYear + 2 - i);
  // Semesters 1 to 8
  const semesters = [1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-white/50 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Assignments
      </button>

      <div className="max-w-3xl mx-auto">
        <h2
          className="text-2xl font-bold text-white mb-8"
          style={{ fontFamily: "'Syne', sans-serif" }}
        >
          Create Assignment
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title and Subject */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              className="rounded-xl p-6"
              style={{
                background: "rgba(22, 22, 29, 0.6)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <label className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
                Title *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => handleChange("title", e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/20 outline-none focus:border-indigo-500/50 transition-colors"
                placeholder="e.g. Data Structures Assignment 3"
                required
              />
            </div>
            <div
              className="rounded-xl p-6"
              style={{
                background: "rgba(22, 22, 29, 0.6)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <label className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
                Subject *
              </label>
              <input
                type="text"
                value={form.subject_name}
                onChange={(e) => handleChange("subject_name", e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/20 outline-none focus:border-indigo-500/50 transition-colors"
                placeholder="e.g. CS201"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div
            className="rounded-xl p-6"
            style={{
              background: "rgba(22, 22, 29, 0.6)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <label className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/20 outline-none focus:border-indigo-500/50 transition-colors resize-none"
              placeholder="Assignment instructions and details..."
              rows={3}
            />
          </div>

          {/* Target Audience Filters */}
          <div
            className="rounded-xl p-6"
            style={{
              background: "rgba(22, 22, 29, 0.6)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" /> Target Students
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
                  Program
                </label>
                <select
                  value={form.program_id}
                  onChange={(e) => handleChange("program_id", e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500/50 transition-colors appearance-none"
                >
                  <option value="">All Programs</option>
                  {programs.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
                  Batch Year
                </label>
                <select
                  value={form.batch}
                  onChange={(e) => handleChange("batch", e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500/50 transition-colors appearance-none"
                >
                  <option value="">All Batches</option>
                  {batchYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
                  Semester
                </label>
                <select
                  value={form.semester}
                  onChange={(e) => handleChange("semester", e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500/50 transition-colors appearance-none"
                >
                  <option value="">All Semesters</option>
                  {semesters.map((sem) => (
                    <option key={sem} value={sem}>
                      Semester {sem}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-white/5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-white/60">
                  Students matching filters:
                </span>
                {checkingStudents ? (
                  <span className="flex items-center gap-2 text-indigo-400 text-sm font-bold">
                    <Loader2 className="w-4 h-4 animate-spin" /> Calculating...
                  </span>
                ) : (
                  <span
                    className={`text-xl font-bold ${matchedStudents.length > 0 ? "text-green-400" : "text-red-400"}`}
                  >
                    {matchedStudents.length}{" "}
                    <span className="text-sm font-normal text-white/40">
                      students
                    </span>
                  </span>
                )}
              </div>

              {matchedStudents.length > 0 && !checkingStudents && (
                <div className="rounded-xl border border-white/5 bg-black/20 overflow-hidden">
                  <div className="max-h-60 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 sticky top-0 bg-[#1a1a21] z-10">
                          <th className="px-4 py-2 text-[10px] uppercase tracking-wider text-white/30 font-bold">Name</th>
                          <th className="px-4 py-2 text-[10px] uppercase tracking-wider text-white/30 font-bold">Roll Number</th>
                          <th className="px-4 py-2 text-[10px] uppercase tracking-wider text-white/30 font-bold">Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matchedStudents.map((student, idx) => (
                          <tr key={student._id || idx} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-2.5 text-sm text-white/70">{student.name}</td>
                            <td className="px-4 py-2.5 text-sm font-mono text-indigo-300/70">{student.roll_number || student.roll_no}</td>
                            <td className="px-4 py-2.5 text-sm text-white/40 truncate max-w-[150px]">{student.email}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {!checkingStudents && matchedStudents.length === 0 && (
                <div className="py-8 text-center border border-dashed border-white/10 rounded-xl bg-white/5">
                  <p className="text-sm text-white/30">No students found for this filter.</p>
                </div>
              )}
            </div>
          </div>

          {/* Deadline */}
          <div
            className="rounded-xl p-6"
            style={{
              background: "rgba(22, 22, 29, 0.6)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <label className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
              Deadline *
            </label>
            <input
              type="datetime-local"
              value={form.deadline}
              onChange={(e) => handleChange("deadline", e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500/50 transition-colors"
              required
              style={{ colorScheme: "dark" }}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || matchedStudents.length === 0}
            className="w-full py-4 rounded-xl text-white font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-indigo-900/30"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Creating
                Assignment...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" /> Create Assignment & Notify{" "}
                {matchedStudents.length} Students
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

// ──────────────────── ASSIGNMENT DETAIL ────────────────────

const AssignmentDetail = ({ assignment, workspaceId, onBack, onDelete }) => {
  const toast = useToast();
  const [viewingSubmissions, setViewingSubmissions] = useState(false);

  const a = assignment;
  const analytics = a.analytics || {};
  const submissions = a.submissions || [];
  const submissionLink = `${window.location.origin}/submit/${a.id}`;

  const statCards = [
    {
      label: "Total Students",
      value: analytics.total_students,
      icon: Users,
      color: "#6366f1",
    },
    {
      label: "Submitted",
      value: analytics.submitted,
      icon: CheckCircle,
      color: "#22c55e",
    },
    {
      label: "Pending",
      value: analytics.pending,
      icon: Clock,
      color: "#f59e0b",
    },
    {
      label: "Late",
      value: analytics.late,
      icon: AlertCircle,
      color: "#ef4444",
    },
  ];

  return (
    <div>
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Assignments
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(submissionLink);
              toast?.showToast?.("Submission link copied!", "success");
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all border border-white/10"
          >
            <Copy className="w-3.5 h-3.5" /> Copy Link
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all border border-white/10"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>

      {/* Header Card */}
      <div
        className="rounded-2xl p-8 mb-6"
        style={{
          background: "rgba(22, 22, 29, 0.6)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-indigo-400 uppercase tracking-wider mb-1">
              {a.subject_name}
            </p>
            <h1
              className="text-2xl font-bold text-white mb-2"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              {a.title}
            </h1>
            {a.description && (
              <p className="text-sm text-white/50 mb-3 max-w-xl">
                {a.description}
              </p>
            )}
            <div className="flex items-center gap-4 text-xs text-white/30">
              {a.section && (
                <span>
                  Section:{" "}
                  <strong className="text-white/50">{a.section}</strong>
                </span>
              )}
              {a.batch && (
                <span>
                  Batch: <strong className="text-white/50">{a.batch}</strong>
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Deadline:{" "}
                <strong className="text-white/50">
                  {new Date(a.deadline).toLocaleString()}
                </strong>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-center px-4">
              <p
                className="text-3xl font-bold text-white"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                {analytics.submission_rate || 0}%
              </p>
              <p className="text-[10px] text-white/30 uppercase tracking-wider">
                Completion
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="rounded-xl p-5"
            style={{
              background: "rgba(22, 22, 29, 0.6)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <stat.icon className="w-5 h-5 mb-3" style={{ color: stat.color }} />
            <p className="text-2xl font-bold text-white">{stat.value ?? 0}</p>
            <p className="text-[11px] text-white/30 uppercase tracking-wider mt-1">
              {stat.label}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Progress Bar */}
      <div
        className="rounded-xl p-6 mb-6"
        style={{
          background: "rgba(22, 22, 29, 0.6)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-white/60">
            Submission Progress
          </span>
          <span className="text-sm font-bold text-white">
            {analytics.submitted || 0} / {analytics.total_students || 0}
          </span>
        </div>
        <div className="h-3 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${analytics.submission_rate || 0}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{
              background: "linear-gradient(90deg, #6366f1, #8b5cf6, #22c55e)",
            }}
          />
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-white/20">
          <span>{analytics.on_time || 0} on-time</span>
          <span>{analytics.late || 0} late</span>
        </div>
      </div>

      {/* Submissions Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "rgba(22, 22, 29, 0.6)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">Submissions</h3>
            <span className="text-xs text-white/30 ml-1">
              ({submissions.length})
            </span>
          </div>
        </div>

        {a.students && a.students.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-8 h-8 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/30">No students assigned yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-6 py-3 text-[10px] uppercase tracking-wider text-white/25 font-semibold">
                    Roll No.
                  </th>
                  <th className="text-left px-6 py-3 text-[10px] uppercase tracking-wider text-white/25 font-semibold">
                    Name
                  </th>
                  <th className="text-left px-6 py-3 text-[10px] uppercase tracking-wider text-white/25 font-semibold">
                    Submitted At
                  </th>
                  <th className="text-left px-6 py-3 text-[10px] uppercase tracking-wider text-white/25 font-semibold">
                    Status
                  </th>
                  <th className="text-left px-6 py-3 text-[10px] uppercase tracking-wider text-white/25 font-semibold">
                    File
                  </th>
                </tr>
              </thead>
              <tbody>
                {(a.students || []).map((student, idx) => {
                  const sub = submissions.find(
                    (s) => s.roll_number === student.roll_number,
                  );

                  return (
                    <tr
                      key={student.roll_number || idx}
                      className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-mono text-white/70">
                        {student.roll_number}
                      </td>
                      <td className="px-6 py-4 text-sm text-white/80">
                        {student.name}
                      </td>
                      <td className="px-6 py-4 text-xs text-white/40">
                        {sub && sub.submitted_at
                          ? new Date(sub.submitted_at).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-6 py-4">
                        {!sub ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock className="w-2.5 h-2.5" /> Pending
                          </span>
                        ) : sub.is_late ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                            <AlertCircle className="w-2.5 h-2.5" /> Late
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                            <CheckCircle className="w-2.5 h-2.5" /> On Time
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {sub && sub.saved_file ? (
                          <a
                            href={`${API_URL}/uploads/submissions/${sub.saved_file}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                            onClick={(e) => {
                              e.preventDefault();
                              const token = localStorage.getItem("token");
                              window.open(
                                `${API_URL}/uploads/submissions/${sub.saved_file}?token=${token}`,
                                "_blank",
                              );
                            }}
                          >
                            <Download className="w-3 h-3" />{" "}
                            {sub.file_name || "Download"}
                          </a>
                        ) : (
                          <span className="text-xs text-white/20">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignmentManager;
