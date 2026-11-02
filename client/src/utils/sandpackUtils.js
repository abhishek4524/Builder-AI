// Peer dependencies and implicit requirements map for Sandpack sandbox
const PEER_DEPENDENCIES = {
    "@fortawesome/react-fontawesome": {
        "@fortawesome/fontawesome-svg-core": "latest",
        "@fortawesome/free-solid-svg-icons": "latest",
        "@fortawesome/free-regular-svg-icons": "latest",
        "@fortawesome/free-brands-svg-icons": "latest",
    },
    "@fortawesome/free-solid-svg-icons": {
        "@fortawesome/fontawesome-svg-core": "latest",
        "@fortawesome/react-fontawesome": "latest",
    },
    "@fortawesome/free-regular-svg-icons": {
        "@fortawesome/fontawesome-svg-core": "latest",
        "@fortawesome/react-fontawesome": "latest",
    },
    "@fortawesome/free-brands-svg-icons": {
        "@fortawesome/fontawesome-svg-core": "latest",
        "@fortawesome/react-fontawesome": "latest",
    },
};

// Scans source files to detect npm dependencies from import statements
export function detectDependencies(files) {
    const deps = {};
    if (!files) return deps;

    const allCode = Object.values(files)
        .map(f => (typeof f === "string" ? f : f?.content || ""))
        .join("\n");
    const filePaths = Object.keys(files);

    const isLocalFileOrFolder = (pkgName) => {
        const name = pkgName.startsWith("@/") ? pkgName.substring(2) : pkgName;
        return (
            pkgName.startsWith("@/") ||
            pkgName === "@" ||
            filePaths.some(p => 
                p === `/${name}` || 
                p.startsWith(`/${name}/`) || 
                p.replace(/\.[^/.]+$/, "") === `/${name}`
            )
        );
    };

    // Match both: import ... from 'pkg' and import 'pkg'
    const importRegex = /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?|require\(\s*)['"]([^./][^'"]*)['"]/g;
    let match;
    while ((match = importRegex.exec(allCode)) !== null) {
        const rawImport = match[1];

        // Scoped packages like @scope/package, normal packages like package
        const pkg = rawImport.startsWith("@") && !rawImport.startsWith("@/")
            ? rawImport.split("/").slice(0, 2).join("/")
            : rawImport.split("/")[0];

        // Skip react (included in Sandpack template), react-dom, and local modules
        if (pkg !== "react" && pkg !== "react-dom" && !isLocalFileOrFolder(pkg)) {
            deps[pkg] = "latest";
        }
    }

    // Auto-resolve known peer dependencies
    for (const [dep, peers] of Object.entries(PEER_DEPENDENCIES)) {
        if (deps[dep]) {
            Object.assign(deps, peers);
        }
    }

    // If ANY @fortawesome package or fontawesome reference is detected in imports or code,
    // inject the core runtime dependencies so Sandpack never throws "Could not find dependency"
    const hasFontAwesome = Object.keys(deps).some(p => p.includes("fontawesome")) || allCode.includes("@fortawesome");
    if (hasFontAwesome) {
        deps["@fortawesome/fontawesome-svg-core"] = "latest";
        deps["@fortawesome/free-solid-svg-icons"] = "latest";
        deps["@fortawesome/react-fontawesome"] = "latest";
    }

    return deps;
}
