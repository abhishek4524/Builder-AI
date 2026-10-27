import React, { useEffect, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { useNavigate, useParams } from "react-router-dom";
import Loading from "../components/Loading";
import BuilderHeader from "../components/BuilderHeader";
import { FolderTreeIcon, MessageSquareIcon } from "lucide-react";
import ChatPanel from "../components/ChatPanel";
import FileExplorer from "../components/FileExplorer";
import PreviewPanel from "../components/PreviewPanel";
import AgentProgressDashboard from "../components/AgentProgressDashboard";
import PublishModel from "../components/PublishModel";
import api from "../api/api";
import toast from "react-hot-toast";
import { exportProjectZip } from "../utils/exportProject";
import { useProjectEvents } from "../hooks/useProjectEvents";

const BuilderPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Connect to SSE stream for real-time progress updates
  useProjectEvents(id);

  const [leftTab, setLeftTab] = useState("chat");
  const [publishing, setPublishing] = useState(false);
  const [publishUrl, setPublishUrl] = useState(null);
  const {
    activeProjects,
    loadingActiveProjects,
    activeFile,
    showCode,
    setActiveFile,
    setShowCode,
    loadProject,
    logout,
    chatLoading,
    handleChat,
    handleCancel,
  } = useAppContext();

  useEffect(() => {
    if (!id) return;
    loadProject(id);
  }, [id, loadProject]);

  const handleOpenPreview = () => {
    if (!id) return;
    window.open(`/preview/${id}`, "_blank");
  };

  const handlePublish = async () => {
    if (!id) return;
    setPublishing(true);
    try {
      await api.post(`/api/projects/${id}/publish`);
      const url = `${window.location.origin}/publish/${id}`;
      setPublishUrl(url);
      toast.success("Website published successfully!");
    } catch (err) {
      console.error("Publish failed:", err);
      toast.error(err?.response?.data?.error || "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  const handleDownload = async () => {
    if (!activeProjects) return;
    exportProjectZip(activeProjects);
  };

  if (loadingActiveProjects || !activeProjects) {
    return <Loading />;
  }

  const isProgressView =
    activeProjects.status === "queued" ||
    activeProjects.status === "pending" ||
    activeProjects.status === "generating" ||
    activeProjects.status === "failed" ||
    activeProjects.status === "cancelled";

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-zinc-950 overflow-hidden text-zinc-900 dark:text-zinc-100 relative transition-colors">
      {/* Top Bar Header */}
      <BuilderHeader
        projectName={activeProjects.name}
        version={activeProjects.version}
        status={activeProjects.status}
        generationDuration={activeProjects.generationDuration}
        generationStartedAt={activeProjects.generationStartedAt}
        createdAt={activeProjects.createdAt}
        showCode={showCode}
        publishing={publishing}
        onToggleShowCode={() => setShowCode(!showCode)}
        onOpenPreview={handleOpenPreview}
        onPublish={handlePublish}
        onDownload={handleDownload}
        onCancel={() => handleCancel(id)}
        onBack={() => navigate("/")}
        onLogout={logout}
      />
      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-[320px] shrink-0 flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-colors">
          {/* Sidebar Tabs */}
          <div className="flex border-b border-zinc-100 dark:border-zinc-800">
            <button
              onClick={() => setLeftTab("chat")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium cursor-pointer transition-colors ${
                leftTab === "chat"
                  ? "border-b-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white font-semibold"
                  : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              <MessageSquareIcon size={13} /> Chat
            </button>
            <button
              onClick={() => setLeftTab("files")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium cursor-pointer transition-colors ${
                leftTab === "files"
                  ? "border-b-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white font-semibold"
                  : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              <FolderTreeIcon size={13} /> Files
            </button>
          </div>
          {/* Sidebar Content */}
          <div className="flex-1 overflow-hidden">
            {leftTab === "chat" ? (
              <ChatPanel
                messages={activeProjects.messages}
                onSend={handleChat}
                loading={chatLoading}
              />
            ) : (
              <FileExplorer
                files={activeProjects.files}
                activeFile={activeFile}
                onFileSelect={(path) => {
                  setActiveFile(path);
                  setShowCode(true);
                }}
              />
            )}
          </div>
        </div>

        {/* Preview / Code Area */}
        <div className="flex-1 overflow-hidden">
          {isProgressView ? (
            <AgentProgressDashboard project={activeProjects} />
          ) : (
            <PreviewPanel
              project={activeProjects}
              activeFile={activeFile}
              showCode={showCode}
            />
          )}
        </div>
      </div>
      {publishUrl && <PublishModel publishUrl={publishUrl} onClose={() => setPublishUrl(null)} />}
    </div>
  );
};

export default BuilderPage;
