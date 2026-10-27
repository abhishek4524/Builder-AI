import { FileCodeIcon, FileTextIcon, FolderOpenIcon } from 'lucide-react';
import React, { useMemo } from 'react';

function buildTree(paths) {
  const root = [];

  for (const filePath of [...paths].sort()) {
    const parts = filePath.split("/").filter(Boolean);
    if (!parts.length) continue;

    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;
      const fullPath = "/" + parts.slice(0, i + 1).join("/");
      let existing = current.find((node) => node.name === name);

      if (!existing) {
        existing = {
          name,
          path: fullPath,
          isDir: !isLast,
          children: [],
        };
        current.push(existing);
      }

      if (isLast) break;
      current = existing.children;
    }
  }

  return root;
}

function getFileIcon(name) {
  if (name.endsWith(".css")) return <FileTextIcon size={14} className='text-sky-500' />;
  if (name.endsWith(".jsx") || name.endsWith(".js")) return <FileCodeIcon size={14} className='text-amber-500' />;
  if (name.endsWith(".json")) return <FileTextIcon size={14} className='text-emerald-500' />;
  return <FileTextIcon size={14} className="text-zinc-400" />;
}

function TreeItem({ node, activeFile, onFileSelect, depth = 0 }) {
  const isActive = node.path === activeFile;

  if (node.isDir) {
    return (
      <div>
        <div
          className='flex items-center gap-2 py-1 px-2 text-xs text-zinc-400 dark:text-zinc-400 select-none'
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <FolderOpenIcon size={14} className='text-zinc-700 dark:text-zinc-300 opacity-60' />
          <span>{node.name}</span>
        </div>
        {node.children.map((child) => (
          <TreeItem
            key={child.path}
            node={child}
            activeFile={activeFile}
            onFileSelect={onFileSelect}
            depth={depth + 1}
          />
        ))}
      </div>
    );
  }
  return (
    <button
      onClick={() => onFileSelect(node.path)}
      className={`w-full flex items-center gap-2 py-1.5 px-2 text-xs transition-colors rounded-md cursor-pointer ${
        isActive
          ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-white font-medium"
          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-zinc-950 dark:hover:text-zinc-100"
      }`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      {getFileIcon(node.name)}
      <span className='truncate'>{node.name}</span>
    </button>
  );
}

const FileExplorer = ({ files, activeFile, onFileSelect }) => {
  const tree = useMemo(() => buildTree(Object.keys(files || {})), [files]);
  return (
    <div className='py-2 overflow-y-auto hide-scrollbar bg-white dark:bg-zinc-900 h-full transition-colors'>
      <p className='px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500'>
        Files
      </p>
      {tree.map((node) => (
        <TreeItem
          key={node.path}
          node={node}
          activeFile={activeFile}
          onFileSelect={onFileSelect}
          depth={0}
        />
      ))}
    </div>
  );
};

export default FileExplorer;
